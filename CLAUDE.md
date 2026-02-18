# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MPDash** — a fullstack dashboard for managing Multipass VMs on Linux.

- **Backend**: FastAPI (Python) + uvicorn, uses `subprocess` to call `multipass` CLI
- **Frontend**: React 18 + Vite, Tailwind CSS, TanStack React Query, Recharts, WebSocket

## Commands

### Backend
```bash
# Install dependencies
pip install fastapi uvicorn

# Run dev server (from backend/)
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
# Install dependencies (from frontend/)
npm install

# Run dev server
npm run dev        # starts Vite on localhost:5173

# Build for production
npm run build
```

### Docker (full stack)
```bash
docker-compose up --build
```

## Architecture

### Backend (`backend/`)

| File | Role |
|------|------|
| `main.py` | FastAPI app — all REST endpoints and WebSocket handler |
| `multipass.py` | Subprocess wrapper for `multipass` CLI commands |
| `activity.py` | Read/write activity log to `activity.json` |
| `stats.py` | Aggregate global stats (totals across all VMs) |
| `activity.json` | Persistent action log (timestamp, action, vm_name, status) |

**Key endpoints:**
- `GET /api/instances` — list all VMs (state, IP, CPU, RAM, disk)
- `GET /api/instances/{name}` — VM detail
- `POST /api/instances/{name}/start|stop|suspend`
- `DELETE /api/instances/{name}`
- `POST /api/instances/launch` — body: `{name, image, cpus, memory, disk}`
- `GET /api/instances/{name}/snapshots`
- `POST /api/instances/{name}/snapshot`
- `GET /api/activity` — recent activity feed
- `GET /api/stats` — global totals
- `WS /ws/instances` — pushes VM state every 5 seconds

CORS is enabled for `localhost:5173`. Every action is logged to `activity.json`.

The WebSocket also collects per-VM CPU/RAM/Disk history (max 60 points) for the resource chart.

### Frontend (`frontend/src/`)

| Path | Role |
|------|------|
| `api/client.js` | fetch wrapper targeting `http://localhost:8000` |
| `hooks/useInstances.js` | React Query polling + native WebSocket for live VM state |
| `hooks/useActivity.js` | React Query for activity feed |
| `components/Sidebar.jsx` | Fixed 220px sidebar: logo, VM search, nav, daemon status indicator |
| `components/OverviewCard.jsx` | Lime accent card with global stats + Launch button |
| `components/InstanceCard.jsx` | VM card with state badge, IP, specs, `...` action menu |
| `components/ResourceChart.jsx` | Recharts AreaChart for CPU/RAM/Disk history |
| `components/ActivityFeed.jsx` | Action log with icons, filters, grouping by date |
| `components/NewInstanceModal.jsx` | Launch form: name, image dropdown, CPU/memory/disk sliders |
| `components/InstancesTable.jsx` | Full VM table with inline actions and state filter |
| `pages/Dashboard.jsx` | Overview + first 3 instances + chart + activity feed |
| `pages/Instances.jsx` | Full instances table view |

### Design System

- Background: `#0a0a0a`; cards: `#111111`, `#161616`, `#1c1c1c`
- Primary accent: `#b5f23d` (neon yellow-green / lime)
- Text: `#f0f0f0` primary, `#666` secondary
- Fonts: **IBM Plex Mono** for numbers/IPs/VM names, **Syne** for titles/nav (Google Fonts)
- Border radius: 16px minimum on all cards
- State badges: Running `#b5f23d`, Stopped `#ff4444`, Suspended `#ff9500`
