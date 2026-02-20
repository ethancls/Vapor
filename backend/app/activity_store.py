from __future__ import annotations

import asyncio
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(slots=True)
class ActivityRecord:
    timestamp: str
    action: str
    vm_name: str
    status: str
    error: str


class ActivityStore:
    def __init__(self, db_path: str, retention: int = 5000):
        self._db_path = Path(db_path)
        self._retention = max(retention, 100)
        self._write_lock = asyncio.Lock()

    async def initialize(self) -> None:
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(self._initialize_sync)

    async def add(self, action: str, vm_name: str, status: str, error: str = "") -> ActivityRecord:
        record = ActivityRecord(
            timestamp=datetime.now(timezone.utc).isoformat(),
            action=action,
            vm_name=vm_name,
            status=status,
            error=error,
        )
        async with self._write_lock:
            await asyncio.to_thread(self._insert_sync, record)
        return record

    async def list(self, limit: int = 100, action: str | None = None, vm_name: str | None = None) -> list[dict]:
        safe_limit = min(max(limit, 1), 1000)
        return await asyncio.to_thread(self._list_sync, safe_limit, action, vm_name)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, timeout=5.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def _initialize_sync(self) -> None:
        conn = self._connect()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS activity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    action TEXT NOT NULL,
                    vm_name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    error TEXT NOT NULL DEFAULT ''
                );

                CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_activity_action ON activity(action);
                CREATE INDEX IF NOT EXISTS idx_activity_vm_name ON activity(vm_name);
                """
            )
            conn.commit()
        finally:
            conn.close()

    def _insert_sync(self, record: ActivityRecord) -> None:
        conn = self._connect()
        try:
            conn.execute(
                """
                INSERT INTO activity(timestamp, action, vm_name, status, error)
                VALUES (?, ?, ?, ?, ?)
                """,
                (record.timestamp, record.action, record.vm_name, record.status, record.error),
            )
            conn.execute(
                """
                DELETE FROM activity
                WHERE id NOT IN (
                    SELECT id FROM activity ORDER BY id DESC LIMIT ?
                )
                """,
                (self._retention,),
            )
            conn.commit()
        finally:
            conn.close()

    def _list_sync(self, limit: int, action: str | None, vm_name: str | None) -> list[dict]:
        conn = self._connect()
        try:
            where = []
            params: list[str | int] = []
            if action:
                where.append("action = ?")
                params.append(action)
            if vm_name:
                where.append("vm_name = ?")
                params.append(vm_name)

            where_sql = f"WHERE {' AND '.join(where)}" if where else ""
            query = (
                "SELECT timestamp, action, vm_name, status, error "
                f"FROM activity {where_sql} ORDER BY id DESC LIMIT ?"
            )
            params.append(limit)
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()
