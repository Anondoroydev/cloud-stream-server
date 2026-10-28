import { lookup } from 'node:dns/promises';
import https from 'node:https';
import { isIP } from 'node:net';

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly code: 'INVALID_URL' | 'UNSAFE_ADDRESS' | 'TIMEOUT' | 'NETWORK' | 'HTTP_STATUS' | 'INVALID_JSON' | 'RESPONSE_TOO_LARGE',
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b, c] = octets as [number, number, number, number];
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function validateUrl(url: URL, allowedHosts: ReadonlySet<string>): void {
  if (
    url.protocol !== 'https:' ||
    (url.port !== '' && url.port !== '443') ||
    url.username !== '' ||
    url.password !== '' ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw new UpstreamError('Upstream URL is not allowed', 'INVALID_URL');
  }
}

export async function safeJsonRequest<T>(
  urlString: string,
  allowedHosts: readonly string[],
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<T> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new UpstreamError('Upstream URL is invalid', 'INVALID_URL');
  }

  const hostAllowlist = new Set(allowedHosts.map((host) => host.toLowerCase()));
  validateUrl(url, hostAllowlist);
  const timeoutMs = options.timeoutMs ?? 5_000;
  let dnsTimer: NodeJS.Timeout | undefined;
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await Promise.race<Array<{ address: string; family: number }>>([
      lookup(url.hostname, { family: 4, all: true, verbatim: true }).catch(() => {
        throw new UpstreamError('Upstream host lookup failed', 'NETWORK');
      }),
      new Promise<never>((_resolve, reject) => {
        dnsTimer = setTimeout(() => reject(new UpstreamError('Upstream host lookup timed out', 'TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (dnsTimer) clearTimeout(dnsTimer);
  }

  const address = addresses.find(({ address: candidate }) => isIP(candidate) === 4 && isPublicIpv4(candidate));
  if (!address || addresses.some(({ address: candidate }) => isIP(candidate) === 4 && !isPublicIpv4(candidate))) {
    throw new UpstreamError('Upstream host resolved to a non-public address', 'UNSAFE_ADDRESS');
  }

  const maxBytes = options.maxBytes ?? 1_000_000;

  return new Promise<T>((resolve, reject) => {
    const request = https.request({
      protocol: 'https:',
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: { accept: 'application/json' },
      timeout: timeoutMs,
      lookup(_hostname, _lookupOptions, callback) {
        callback(null, address.address, 4);
      },
    }, (response) => {
      if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
        response.resume();
        reject(new UpstreamError(`Upstream returned HTTP ${response.statusCode ?? 500}`, 'HTTP_STATUS'));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.byteLength;
        if (totalBytes > maxBytes) {
          request.destroy(new UpstreamError('Upstream response exceeded the size limit', 'RESPONSE_TOO_LARGE'));
          return;
        }
        chunks.push(buffer);
      });

      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T);
        } catch {
          reject(new UpstreamError('Upstream returned invalid JSON', 'INVALID_JSON'));
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new UpstreamError('Upstream request timed out', 'TIMEOUT'));
    });
    request.on('error', (error: Error) => {
      if (error instanceof UpstreamError) {
        reject(error);
      } else {
        reject(new UpstreamError('Upstream network request failed', 'NETWORK'));
      }
    });
    request.end();
  });
}
