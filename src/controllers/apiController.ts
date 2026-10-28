import type { RequestHandler } from 'express';
import { HttpError } from '../middleware/errorHandler';
import { catalogQuerySchema, mediaIdSchema, searchQuerySchema } from '../schemas/media';
import { MediaNotFoundError, mediaService, ProviderUnavailableError } from '../services/mediaService';
import { repositoryService } from '../services/repositoryService';

function respond<T>(res: Parameters<RequestHandler>[1], data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
    meta: {
      requestId: String(res.locals.requestId ?? 'unknown'),
      timestamp: new Date().toISOString(),
    },
  });
}

function normalizeError(error: unknown): unknown {
  if (error instanceof ProviderUnavailableError) {
    return new HttpError(503, 'PROVIDERS_UNAVAILABLE', error.message);
  }
  if (error instanceof MediaNotFoundError) {
    return new HttpError(404, 'MEDIA_NOT_FOUND', error.message);
  }
  return error;
}

export const health: RequestHandler = (_req, res) => {
  respond(res, { status: 'ok', service: 'cloudstream-server', timestamp: new Date().toISOString() });
};

export const repository: RequestHandler = (_req, res) => {
  respond(res, repositoryService.getMetadata());
};

export const providers: RequestHandler = (_req, res) => {
  respond(res, mediaService.listProviders());
};

export const catalog: RequestHandler = async (req, res, next) => {
  try {
    const options = catalogQuerySchema.parse(req.query);
    respond(res, await mediaService.catalog(options));
  } catch (error) {
    next(normalizeError(error));
  }
};

export const search: RequestHandler = async (req, res, next) => {
  try {
    const { q, type } = searchQuerySchema.parse(req.query);
    respond(res, await mediaService.search(q, type));
  } catch (error) {
    next(normalizeError(error));
  }
};

export const details: RequestHandler = async (req, res, next) => {
  try {
    const id = mediaIdSchema.parse(req.params.id);
    respond(res, await mediaService.details(id));
  } catch (error) {
    next(normalizeError(error));
  }
};

export const streams: RequestHandler = async (req, res, next) => {
  try {
    const id = mediaIdSchema.parse(req.params.id);
    respond(res, await mediaService.streams(id));
  } catch (error) {
    next(normalizeError(error));
  }
};
