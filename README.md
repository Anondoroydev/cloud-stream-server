# CloudStream Server API

Backend-only TypeScript REST API for movie and TV metadata providers. No frontend or sample movie/stream data is included.

## Repository inspection

The provided `CXXX.json` is a CloudStream repository manifest pointing at a plugin list. Its listed plugins identify themselves as adult/NSFW video providers; the inspected source tree is Kotlin/CloudStream code and the `.cs3` artifacts are not Node.js modules. This service therefore does not scrape those sites, execute `.cs3` binaries, or claim to provide authorized streaming URLs. `GET /api/v1/repository` reports the inspected repository metadata only. Add provider implementations only for sources you are authorized to access and distribute.

## Requirements and setup

- Node.js 20+
- `npm install`
- Copy `.env.example` to `.env` and adjust settings

## Commands

- `npm run dev` — run in watch mode
- `npm run typecheck` — TypeScript check
- `npm test` — automated API tests
- `npm run build` — compile to `dist/`
- `npm start` — run compiled server

## API

All responses use `{ "success": boolean, "data"?: ..., "error"?: ..., "meta": { "requestId": string, "timestamp": string } }`.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/v1/health` | Liveness status |
| GET | `/api/v1/repository` | Repository metadata; does not execute plugin code |
| GET | `/api/v1/providers` | Registered TypeScript provider implementations |
| GET | `/api/v1/catalog?type=movie&limit=20&offset=0` | Aggregated catalog |
| GET | `/api/v1/search?q=movie-name&type=tv` | Search across registered providers |
| GET | `/api/v1/movies/:id` | Movie or TV metadata; IDs use `provider-id:external-id` |
| GET | `/api/v1/movies/:id/streams` | Streams returned by the owning provider |

With no providers registered, catalog, search, detail, and stream lookups return `503 PROVIDERS_UNAVAILABLE`; no fake results or stream URLs are returned.

## Provider contract

Implement `MediaProvider` from `src/types/media.ts` in TypeScript and register it with `providerRegistry` during application startup. `catalog`, `search`, `getDetails`, and `getStreams` must return only data the provider actually obtained from an authorized source. Provider-specific networking should use HTTPS, strict host allowlists, timeouts, response-size limits, redirect rejection, and public-address validation; do not accept arbitrary target URLs from API callers.

The API includes input validation, common JSON errors, request IDs, structured logging, in-memory TTL caching, CORS allowlisting, rate limiting, Helmet headers, and request-body limits. The provider layer must apply SSRF defenses before making any outbound requests; no configured provider currently makes outbound network requests.

## Configuration

See `.env.example`. `REPOSITORY_URL` is informational only and is not fetched by the server.
