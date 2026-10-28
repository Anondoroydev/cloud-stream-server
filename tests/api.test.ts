import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import { safeJsonRequest, UpstreamError } from '../src/utils/safeJsonRequest';

describe('API v1', () => {
  let server: Server;
  const app = createApp();

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  it('returns a consistent health response', async () => {
    const response = await request(server).get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'ok', service: 'cloudstream-server' },
    });
    expect(response.body.meta.requestId).toBeTruthy();
    expect(response.headers['x-request-id']).toBe(response.body.meta.requestId);
  });

  it('lists providers without fabricating any', async () => {
    const response = await request(server).get('/api/v1/providers').expect(200);
    expect(response.body).toMatchObject({ success: true, data: [] });
  });

  it('reports repository metadata without loading CloudStream binaries', async () => {
    const response = await request(server).get('/api/v1/repository').expect(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { name: 'CXXX', pluginExecution: 'unsupported' },
    });
  });

  it('returns a clear unavailable error rather than fake catalog data', async () => {
    const response = await request(server).get('/api/v1/catalog').expect(503);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'PROVIDERS_UNAVAILABLE' },
    });
  });

  it('validates search input', async () => {
    const response = await request(server).get('/api/v1/search?q=x').expect(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('returns no stream data when no provider is registered', async () => {
    const response = await request(server)
      .get('/api/v1/movies/provider:external-id/streams')
      .expect(503);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'PROVIDERS_UNAVAILABLE' },
    });
  });

  it('returns a consistent error for malformed JSON requests', async () => {
    const response = await request(server)
      .get('/api/v1/health')
      .set('content-type', 'application/json')
      .send('{')
      .expect(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'INVALID_JSON' },
    });
  });

  it('uses the standard envelope for unknown routes', async () => {
    const response = await request(server).get('/not-a-route').expect(404);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('rejects private network targets before making requests', async () => {
    await expect(
      safeJsonRequest('https://127.0.0.1/private', ['127.0.0.1']),
    ).rejects.toMatchObject<Partial<UpstreamError>>({ code: 'UNSAFE_ADDRESS' });
  });

  it('rejects unapproved hosts', async () => {
    await expect(
      safeJsonRequest('https://example.com/data.json', ['api.example.org']),
    ).rejects.toMatchObject<Partial<UpstreamError>>({ code: 'INVALID_URL' });
  });
});
