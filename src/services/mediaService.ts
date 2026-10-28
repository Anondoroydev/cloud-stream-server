import { LRUCache } from 'lru-cache';
import { config } from '../config/env';
import { providerRegistry, type ProviderRegistry } from '../providers/registry';
import { logger } from '../utils/logger';
import type { CatalogOptions, MediaItem, MediaProvider, StreamSource } from '../types/media';

export class ProviderUnavailableError extends Error {
  constructor() {
    super('No compatible media providers are configured');
    this.name = 'ProviderUnavailableError';
  }
}

export class MediaNotFoundError extends Error {
  constructor() {
    super('Media item was not found');
    this.name = 'MediaNotFoundError';
  }
}

export class MediaService {
  private readonly cache = new LRUCache<string, MediaItem[] | MediaItem | StreamSource[]>({
    max: 500,
    ttl: config.cacheTtlMs,
  });

  constructor(private readonly registry: ProviderRegistry = providerRegistry) {}

  listProviders(): ReturnType<ProviderRegistry['describe']> {
    return this.registry.describe();
  }

  async catalog(options: CatalogOptions): Promise<MediaItem[]> {
    const key = `catalog:${JSON.stringify(options)}`;
    return this.cached(key, async () => {
      const providers = this.requireProviders();
      const results = await Promise.allSettled(providers.map((provider) => provider.catalog(options)));
      return this.collectResults(results);
    });
  }

  async search(query: string, type?: 'movie' | 'tv'): Promise<MediaItem[]> {
    const key = `search:${type ?? 'all'}:${query.toLocaleLowerCase()}`;
    return this.cached(key, async () => {
      const providers = this.requireProviders();
      const results = await Promise.allSettled(providers.map((provider) => provider.search(query)));
      return (await this.collectResults(results)).filter((item) => !type || item.type === type);
    });
  }

  async details(id: string): Promise<MediaItem> {
    const { provider, externalId } = this.resolveId(id);
    const key = `details:${id}`;
    return this.cached(key, async () => {
      const item = await provider.getDetails(externalId);
      if (!item) throw new MediaNotFoundError();
      return item;
    });
  }

  async streams(id: string): Promise<StreamSource[]> {
    const { provider, externalId } = this.resolveId(id);
    const key = `streams:${id}`;
    return this.cached(key, () => provider.getStreams(externalId));
  }

  private requireProviders(): MediaProvider[] {
    const providers = this.registry.all();
    if (providers.length === 0) throw new ProviderUnavailableError();
    return providers;
  }

  private resolveId(id: string): { provider: MediaProvider; externalId: string } {
    const separator = id.indexOf(':');
    if (separator <= 0 || separator === id.length - 1) throw new MediaNotFoundError();
    const providerId = id.slice(0, separator);
    const externalId = id.slice(separator + 1);
    const provider = this.registry.get(providerId);
    if (!provider) throw new ProviderUnavailableError();
    return { provider, externalId };
  }

  private async collectResults(
    results: PromiseSettledResult<MediaItem[]>[],
  ): Promise<MediaItem[]> {
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.warn({ err: result.reason }, 'A media provider request failed');
      }
    }
    const items = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    if (items.length === 0 && results.every((result) => result.status === 'rejected')) {
      throw new ProviderUnavailableError();
    }
    return items;
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached as T;
    const value = await load();
    this.cache.set(key, value as MediaItem[] | MediaItem | StreamSource[]);
    return value;
  }
}

export const mediaService = new MediaService();
