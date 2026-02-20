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
pip install -r backend/requirements.txt

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

The backend is now modular and production-oriented:
- `main.py` delegates to `app/create_app()`
- `app/routers_ui.py` exposes the product API surface
- `app/routers_ws.py` handles `WS /ws/instances`
- `app/multipass_client.py` provides async Multipass execution with timeout/concurrency/cache
- `app/activity_store.py` persists activity in SQLite (`activity.db`)

The generic debug endpoint `/api/multipass/run` is removed.
Use `backend/README.md` for the authoritative endpoint contract and runtime configuration.

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
