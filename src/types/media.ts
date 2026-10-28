export type MediaType = 'movie' | 'tv';

export interface MediaItem {
  id: string;
  providerId: string;
  type: MediaType;
  title: string;
  overview?: string;
  releaseDate?: string;
  posterUrl?: string;
  genres?: string[];
}

export interface StreamSource {
  url: string;
  quality?: string;
  type?: 'hls' | 'dash' | 'file' | 'unknown';
  headers?: Record<string, string>;
}

export interface CatalogOptions {
  type?: MediaType;
  limit: number;
  offset: number;
}

export interface MediaProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  catalog(options: CatalogOptions): Promise<MediaItem[]>;
  search(query: string): Promise<MediaItem[]>;
  getDetails(externalId: string): Promise<MediaItem | null>;
  getStreams(externalId: string): Promise<StreamSource[]>;
}
