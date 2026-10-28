import type { MediaProvider } from '../types/media';

export class ProviderRegistry {
  private readonly providers = new Map<string, MediaProvider>();

  register(provider: MediaProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider "${provider.id}" is already registered`);
    }
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): MediaProvider | undefined {
    return this.providers.get(providerId);
  }

  all(): MediaProvider[] {
    return [...this.providers.values()];
  }

  describe(): Array<{ id: string; name: string; version: string; available: true }> {
    return this.all().map(({ id, name, version }) => ({ id, name, version, available: true }));
  }
}

export const providerRegistry = new ProviderRegistry();
