import { z } from 'zod';

export const catalogQuerySchema = z.object({
  type: z.enum(['movie', 'tv']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  type: z.enum(['movie', 'tv']).optional(),
});

export const mediaIdSchema = z.string().trim().min(3).max(200).regex(/^[a-zA-Z0-9._:-]+$/);

export const providerIdSchema = z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9_-]+$/);
