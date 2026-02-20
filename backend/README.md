# Vapor Backend

Production backend for Vapor (FastAPI + Multipass CLI).

## Local Run

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8100
```

## Test

```bash
cd backend
pytest -q tests
```

## Production Run

Use Gunicorn + Uvicorn workers:

```bash
cd backend
gunicorn -c deploy/gunicorn.conf.py main:app
```

## Architecture

- `main.py`: app entrypoint (`app = create_app()`)
- `app/app_factory.py`: dependency wiring, lifespan, middleware, exception handlers
- `app/multipass_client.py`: async Multipass client with timeout/concurrency/cache
- `app/routers_ui.py`: product API (resource/action endpoints used by UI)
- `app/routers_ws.py`: websocket broadcast (`/ws/instances`)
- `app/activity_store.py`: SQLite activity persistence (WAL)
- `app/metrics_store.py`: in-memory metrics history for charts
- `app/services.py`: poller loop and stats aggregation
- `app/schemas.py`: request/response validation

## Security Defaults

- Authentication/authorization supports read vs write tokens.
- Error responses do not expose `argv/stdout/stderr` unless explicitly enabled.
- Trusted host validation is enabled.
- Basic security headers are injected.
- Max request body size is capped (`VAPOR_MAX_REQUEST_BODY_BYTES`).

## Environment Variables (Main)

- `VAPOR_APP_NAME` (default: `Vapor`)
- `VAPOR_CORS_ORIGINS` (default: `http://localhost:5173,http://127.0.0.1:5173`)
- `VAPOR_TRUSTED_HOSTS` (default: `localhost,127.0.0.1`)
- `VAPOR_POLL_INTERVAL_SECONDS` (default: `5`)
- `VAPOR_METRIC_HISTORY_MAX_POINTS` (default: `60`)
- `VAPOR_MULTIPASS_BINARY` (default: `multipass`)
- `VAPOR_MULTIPASS_TIMEOUT_SECONDS` (default: `45`)
- `VAPOR_MULTIPASS_MAX_CONCURRENCY` (default: `6`)
- `VAPOR_INSTANCES_CACHE_TTL_SECONDS` (default: `2`)
- `VAPOR_ACTIVITY_DB_PATH` (default: `activity.db`)
- `VAPOR_ACTIVITY_RETENTION` (default: `5000`)
- `VAPOR_MAX_REQUEST_BODY_BYTES` (default: `2097152`)
- `VAPOR_LOG_LEVEL` (default: `INFO`)
- `VAPOR_LOG_FORMAT` (`text` or `json`, default: `text`)
- `VAPOR_EXPOSE_INTERNAL_ERRORS` (default: `false`)

## AuthN/AuthZ Configuration

- `VAPOR_AUTH_ENABLED` (`true`/`false`, default: `false`)
- `VAPOR_AUTH_READ_TOKENS` (comma-separated bearer/API keys)
- `VAPOR_AUTH_WRITE_TOKENS` (comma-separated bearer/API keys)

When auth is enabled:

- All `/api/*` endpoints require a token.
- Read endpoints require read or write token.
- Write endpoints require write token.
- WebSocket `/ws/instances` also requires auth (`Authorization: Bearer ...`, `X-API-Key`, or `?token=`).

## API Surface

This backend exposes a strict product API. The generic debug runner endpoint `/api/multipass/run` is intentionally removed.

## API Docs

- Swagger UI: `GET /docs`
- OpenAPI spec: `GET /openapi.json`
- ReDoc: `GET /redoc`

### System

- `GET /api/health`
- `GET /api/system/version`
- `GET /api/system/commands`
- `GET /api/system/commands/{command}/help`

### Images / Networks

- `GET /api/images`
- `GET /api/networks`

### Instances

- `GET /api/instances`
- `POST /api/instances`
- `GET /api/instances/{name}`
- `POST /api/instances/{name}/actions/{action}`
  - allowed: `start`, `stop`, `suspend`, `restart`, `recover`, `delete`
- `POST /api/instances/{name}/clone`
- `POST /api/instances/{name}/exec`
- `POST /api/instances/{name}/ssh-password`
- `GET /api/instances/{name}/ssh-password/status`
- `POST /api/instances/{name}/ssh-password/disable`
- `POST /api/instances/{name}/updates/run`
- `POST /api/instances/{name}/mounts`
- `DELETE /api/instances/{name}/mounts`
- `GET /api/instances/{name}/snapshots`
- `POST /api/instances/{name}/snapshots`
- `GET /api/instances/{name}/history`
- `GET /api/instances/{name}/updates`

### Updates

- `GET /api/updates`

### Snapshots

- `GET /api/snapshots`
- `POST /api/snapshots/{instance}/{snapshot}/restore`
- `DELETE /api/snapshots/{instance}/{snapshot}`

### Transfers

- `POST /api/transfers`

### Aliases

- `GET /api/aliases`
- `POST /api/aliases`
- `DELETE /api/aliases/{name}`
- `POST /api/aliases/prefer`

### Settings

- `GET /api/settings/keys`
- `GET /api/settings`
- `GET /api/settings/{key}`
- `PUT /api/settings/{key}`

### Activity / Stats

- `GET /api/activity`
- `GET /api/stats`

### WebSocket

- `WS /ws/instances`
  - pushes: `{ "type": "instances", "data": [...] }`

## Error Contract

- Validation errors: `422`
- Not found resource/route: `404`
- Unauthorized: `401`, forbidden: `403`
- Multipass/upstream errors: `502` or `503` depending on context
- Unhandled errors: `500`
- Mutations return proper HTTP status codes on failure (no `200 + status=error` contract)

## Deployment Notes

- Gunicorn config: `deploy/gunicorn.conf.py`
- Nginx reverse-proxy sample (rate-limit + websocket): `deploy/nginx.vapor.conf`
- systemd unit sample: `deploy/vapor-backend.service`
- Env template: `deploy/backend.env.example`
- Recommended in production:
  - terminate TLS at reverse proxy
  - set `VAPOR_LOG_FORMAT=json` and ship stdout/stderr to centralized logs
  - configure strong auth tokens via env/secret manager
  - pin `VAPOR_TRUSTED_HOSTS` to real hostnames

## Notes

- Activity is persisted in SQLite (`activity.db`), not JSON.
- Poll loop updates metrics and broadcasts instance state periodically.
- Endpoint payload contracts are defined in `app/schemas.py`.
