# Vapor

A self-contained Multipass VM dashboard — React frontend embedded in a single Go binary.

```
browser
  │ HTTP / WebSocket
  ▼
vapor (Go binary, port 8100)
  │ subprocess / exec
  ▼
multipass daemon (host)
```

---

## Quick Start (3 commands)

```bash
# 1. Build frontend + Go binary
npm run build --prefix frontend
CGO_ENABLED=0 go build -ldflags="-s -w" -o vapor .

# 2. Start
VAPOR_UI_PASSWORD=secret ./vapor

# 3. Open
open http://localhost:8100
```

---

## Configuration

All configuration is via environment variables (or `/etc/vapor/vapor.env`).

| Variable | Default | Description |
|---|---|---|
| `VAPOR_BIND` | `0.0.0.0:8100` | Listen address |
| `VAPOR_UI_USERNAME` | `admin` | Dashboard username |
| `VAPOR_UI_PASSWORD` | *(required)* | Dashboard password |
| `VAPOR_SESSION_TTL` | `24h` | Session cookie lifetime |
| `VAPOR_MULTIPASS_BINARY` | `multipass` | Path to multipass binary |
| `VAPOR_MULTIPASS_TIMEOUT` | `45s` | Default command timeout |
| `VAPOR_MULTIPASS_CONCURRENCY` | `6` | Max concurrent multipass calls |
| `VAPOR_INSTANCES_CACHE_TTL` | `2s` | Instance list cache TTL |
| `VAPOR_POLL_INTERVAL` | `5s` | WebSocket broadcast interval |
| `VAPOR_DB_PATH` | `vapor.db` | SQLite path (activity + templates) |
| `VAPOR_ACTIVITY_RETENTION` | `5000` | Max activity log entries |
| `VAPOR_LOG_LEVEL` | `info` | debug / info / warn / error |
| `VAPOR_LOG_FORMAT` | `text` | text or json |
| `VAPOR_FRONTEND_DIR` | *(embedded)* | Override embedded frontend with a directory |

If `VAPOR_UI_PASSWORD` is not set, all `/api/*` requests return **503**.

---

## Build from Source

### Prerequisites
- Go 1.22+
- Node.js 18+

```bash
# Install frontend dependencies
npm install --prefix frontend

# Build frontend (output: frontend/dist/)
npm run build --prefix frontend

# Build Go binary (embeds frontend/dist)
CGO_ENABLED=0 go build -ldflags="-s -w" -o vapor .

# Cross-compile
GOOS=linux  GOARCH=amd64  CGO_ENABLED=0 go build -o vapor-linux-amd64 .
GOOS=linux  GOARCH=arm64  CGO_ENABLED=0 go build -o vapor-linux-arm64 .
GOOS=darwin GOARCH=arm64  CGO_ENABLED=0 go build -o vapor-macos-arm64 .
```

Binary size: ~11 MB (frontend dist ~1 MB + Go runtime + deps).

---

## systemd Install

```bash
bash deploy/install.sh
```

The script:
1. Checks multipass is available
2. Builds frontend + Go binary
3. Installs binary to `/usr/local/bin/vapor`
4. Creates `/etc/vapor/vapor.env` with prompted password
5. Installs `vapor@.service` and enables it for your user
6. Prints the dashboard URL

Manual install:
```bash
sudo cp deploy/vapor.service /etc/systemd/system/vapor@.service
# Edit User= in the service file to your username
sudo systemctl daemon-reload && sudo systemctl enable --now vapor@$USER
journalctl -u vapor@$USER -f
```

---

## Security Notes

- Authentication: username/password via session cookie (`vapor_session`, httpOnly, SameSite=Strict)
- Sessions stored in-memory, expire after `VAPOR_SESSION_TTL`
- The service should run as a non-root user in the `multipass` group
- All `/api/*` and `/ws/*` routes require a valid session
- `VAPOR_UI_PASSWORD` not set → 503 on all API routes (safe default)

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | `{username, password}` → session cookie |
| POST | `/auth/logout` | Clear session |
| GET | `/auth/me` | `{username}` or 401 |

### Instances
| Method | Path | Description |
|---|---|---|
| GET | `/api/instances` | List all instances |
| POST | `/api/instances` | Launch instance |
| GET | `/api/instances/{name}` | Instance detail |
| POST | `/api/instances/{name}/actions/{action}` | start/stop/suspend/restart/recover/delete |
| POST | `/api/instances/{name}/clone` | Clone instance |
| POST | `/api/instances/{name}/exec` | Run command |
| GET | `/api/instances/{name}/history` | Resource history (ring buffer) |
| GET | `/api/instances/{name}/snapshots` | List snapshots |
| POST | `/api/instances/{name}/snapshots` | Create snapshot |
| GET | `/api/instances/{name}/updates` | Check for package updates |
| POST | `/api/instances/{name}/updates/run` | Apply package updates |
| POST | `/api/instances/{name}/mounts` | Mount host path |
| DELETE | `/api/instances/{name}/mounts` | Unmount |
| POST | `/api/instances/{name}/ssh-password` | Generate SSH password |
| GET | `/api/instances/{name}/ssh-password/status` | SSH password status |
| POST | `/api/instances/{name}/ssh-password/disable` | Disable SSH password |

### System / Settings / Other
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{daemon_running, ws_clients}` |
| GET | `/api/system/version` | Multipass version |
| GET | `/api/system/host` | Host CPU/RAM/disk |
| GET | `/api/system/commands` | Supported commands |
| GET | `/api/system/commands/{cmd}/help` | Command help |
| GET | `/api/images` | Available images |
| GET | `/api/networks` | Host networks |
| GET | `/api/snapshots` | All snapshots |
| POST | `/api/snapshots/{i}/{s}/restore` | Restore snapshot |
| DELETE | `/api/snapshots/{i}/{s}` | Delete snapshot |
| POST | `/api/transfers` | Transfer files |
| GET | `/api/aliases` | List aliases |
| POST | `/api/aliases` | Create alias |
| DELETE | `/api/aliases/{name}` | Delete alias |
| POST | `/api/aliases/prefer` | Set preferred alias context |
| GET | `/api/settings/keys` | List setting keys |
| GET | `/api/settings` | All settings |
| GET | `/api/settings/{key}` | Get setting |
| PUT | `/api/settings/{key}` | Set setting |
| GET | `/api/activity` | Activity log |
| GET | `/api/stats` | Aggregate VM stats |
| GET | `/api/updates` | Update status for all VMs |
| GET | `/api/templates` | Instance templates |
| POST | `/api/templates` | Create template |
| DELETE | `/api/templates/{id}` | Delete template |

### WebSocket
| Path | Description |
|---|---|
| `WS /ws/instances` | Live instance list `{type: "instances", data: [...]}` |
