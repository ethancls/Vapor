from __future__ import annotations

import asyncio
from collections import deque
from datetime import datetime, timezone
from typing import Any


class MetricHistoryStore:
    def __init__(self, max_points: int = 60):
        self._max_points = max(max_points, 5)
        self._history: dict[str, deque[dict[str, Any]]] = {}
        self._lock = asyncio.Lock()

    async def append_instances(self, instances: list[dict[str, Any]]) -> None:
        ts = datetime.now(timezone.utc).isoformat()
        async with self._lock:
            active_names: set[str] = set()
            for inst in instances:
                name = str(inst.get("name") or "").strip()
                if not name:
                    continue
                active_names.add(name)
                if name not in self._history:
                    self._history[name] = deque(maxlen=self._max_points)

                point = {
                    "ts": ts,
                    # Store configured vCPU count for resource history charts.
                    "cpu": int(inst.get("cpus") or 0),
                    "ram_used": int((inst.get("memory") or {}).get("used", 0) or 0),
                    "ram_total": int((inst.get("memory") or {}).get("total", 0) or 0),
                    "disk_used": int((inst.get("disk") or {}).get("used", 0) or 0),
                    "disk_total": int((inst.get("disk") or {}).get("total", 0) or 0),
                }
                self._history[name].append(point)

            stale = [name for name in self._history if name not in active_names]
            for name in stale:
                del self._history[name]

    async def get(self, vm_name: str) -> list[dict[str, Any]]:
        async with self._lock:
            points = self._history.get(vm_name)
            return list(points) if points else []
