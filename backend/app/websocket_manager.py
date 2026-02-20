from __future__ import annotations

import asyncio
from typing import Any

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(websocket)

    async def broadcast_json(self, payload: dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self._clients)

        if not clients:
            return

        results = await asyncio.gather(
            *(self._safe_send(client, payload) for client in clients),
            return_exceptions=True,
        )

        dead_clients = [
            client
            for client, result in zip(clients, results, strict=False)
            if result is False or isinstance(result, Exception)
        ]

        if dead_clients:
            async with self._lock:
                for client in dead_clients:
                    self._clients.discard(client)

    async def _safe_send(self, websocket: WebSocket, payload: dict[str, Any]) -> bool:
        try:
            await websocket.send_json(payload)
            return True
        except Exception:
            return False

    async def count(self) -> int:
        async with self._lock:
            return len(self._clients)
