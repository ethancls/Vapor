from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any

from .activity_store import ActivityStore
from .metrics_store import MetricHistoryStore
from .multipass_client import MultipassClient, MultipassCommandError
from .settings import Settings
from .template_store import TemplateStore
from .websocket_manager import WebSocketManager


class PollerService:
    def __init__(
        self,
        *,
        multipass: MultipassClient,
        metrics: MetricHistoryStore,
        ws_manager: WebSocketManager,
        interval_seconds: float,
    ):
        self._multipass = multipass
        self._metrics = metrics
        self._ws_manager = ws_manager
        self._interval_seconds = max(1.0, interval_seconds)

        self._task: asyncio.Task[None] | None = None
        self._stop_event = asyncio.Event()
        self._logger = logging.getLogger("vapor.poller")

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run(), name="vapor-poller")

    async def stop(self) -> None:
        self._stop_event.set()
        if not self._task:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass

    async def _run(self) -> None:
        while not self._stop_event.is_set():
            started_at = time.monotonic()
            try:
                instances = await self._multipass.get_all_instances_info(use_cache=False)
                await self._metrics.append_instances(instances)
                await self._ws_manager.broadcast_json({"type": "instances", "data": instances})
            except MultipassCommandError as exc:
                self._logger.warning(
                    "poll cycle failed with multipass error: %s (argv=%s, exit=%s)",
                    exc.message,
                    " ".join(exc.argv),
                    exc.exit_code,
                )
            except Exception:
                self._logger.exception("poll cycle failed")

            elapsed = time.monotonic() - started_at
            wait_time = max(0.0, self._interval_seconds - elapsed)
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=wait_time)
            except TimeoutError:
                continue


@dataclass(slots=True)
class AppServices:
    settings: Settings
    multipass: MultipassClient
    activity: ActivityStore
    metrics: MetricHistoryStore
    ws_manager: WebSocketManager
    poller: PollerService
    templates: TemplateStore

    async def get_stats(self) -> dict[str, Any]:
        daemon_ok = await self.multipass.daemon_running()
        instances = await self.multipass.get_all_instances_info(use_cache=True)

        total = len(instances)
        running = sum(1 for i in instances if i.get("state") == "Running")
        stopped = sum(1 for i in instances if i.get("state") == "Stopped")
        suspended = sum(1 for i in instances if i.get("state") == "Suspended")

        total_cpus = sum(int(i.get("cpus") or 0) for i in instances)
        total_ram_used = sum(int((i.get("memory") or {}).get("used") or 0) for i in instances)
        total_ram = sum(int((i.get("memory") or {}).get("total") or 0) for i in instances)
        total_disk_used = sum(int((i.get("disk") or {}).get("used") or 0) for i in instances)
        total_disk = sum(int((i.get("disk") or {}).get("total") or 0) for i in instances)

        return {
            "daemon_running": daemon_ok,
            "total": total,
            "running": running,
            "stopped": stopped,
            "suspended": suspended,
            "total_cpus": total_cpus,
            "total_ram_used": total_ram_used,
            "total_ram": total_ram,
            "total_disk_used": total_disk_used,
            "total_disk": total_disk,
        }
