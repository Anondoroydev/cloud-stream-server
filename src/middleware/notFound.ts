import type { RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
    meta: {
      requestId: String(res.locals.requestId ?? 'unknown'),
      timestamp: new Date().toISOString(),
    },
  });
};
