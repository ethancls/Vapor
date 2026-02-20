from __future__ import annotations

import asyncio
import sqlite3
import uuid
from pathlib import Path

BUILTIN_TEMPLATES: list[dict] = [
    {
        "id": "builtin-nano",
        "name": "nano",
        "tier": "nano",
        "description": "Ultra-lightweight for quick tests",
        "cpus": 1,
        "memory_mb": 512,
        "disk_gb": 10,
        "image": "24.04",
        "is_builtin": True,
    },
    {
        "id": "builtin-micro",
        "name": "micro",
        "tier": "micro",
        "description": "Minimal services and CLIs",
        "cpus": 1,
        "memory_mb": 1024,
        "disk_gb": 10,
        "image": "24.04",
        "is_builtin": True,
    },
    {
        "id": "builtin-small",
        "name": "small",
        "tier": "small",
        "description": "Small workloads and dev environments",
        "cpus": 1,
        "memory_mb": 2048,
        "disk_gb": 20,
        "image": "24.04",
        "is_builtin": True,
    },
    {
        "id": "builtin-medium",
        "name": "medium",
        "tier": "medium",
        "description": "General purpose — most common choice",
        "cpus": 2,
        "memory_mb": 4096,
        "disk_gb": 40,
        "image": "24.04",
        "is_builtin": True,
    },
    {
        "id": "builtin-large",
        "name": "large",
        "tier": "large",
        "description": "Compute-intensive builds and services",
        "cpus": 4,
        "memory_mb": 8192,
        "disk_gb": 80,
        "image": "24.04",
        "is_builtin": True,
    },
    {
        "id": "builtin-xlarge",
        "name": "xlarge",
        "tier": "xlarge",
        "description": "High-performance workloads",
        "cpus": 8,
        "memory_mb": 16384,
        "disk_gb": 100,
        "image": "24.04",
        "is_builtin": True,
    },
    {
        "id": "builtin-2xlarge",
        "name": "2xlarge",
        "tier": "2xlarge",
        "description": "Memory-optimized, heavy compilation",
        "cpus": 16,
        "memory_mb": 32768,
        "disk_gb": 200,
        "image": "24.04",
        "is_builtin": True,
    },
]


class TemplateStore:
    def __init__(self, db_path: str) -> None:
        self._db_path = Path(db_path)
        self._write_lock = asyncio.Lock()

    async def initialize(self) -> None:
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(self._initialize_sync)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, timeout=5.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        return conn

    def _initialize_sync(self) -> None:
        conn = self._connect()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    cpus INTEGER NOT NULL DEFAULT 1,
                    memory_mb INTEGER NOT NULL DEFAULT 1024,
                    disk_gb INTEGER NOT NULL DEFAULT 10,
                    image TEXT NOT NULL DEFAULT '24.04',
                    tier TEXT NOT NULL DEFAULT ''
                );
                """
            )
            conn.commit()
        finally:
            conn.close()

    async def list_all(self) -> list[dict]:
        custom = await asyncio.to_thread(self._list_custom_sync)
        return BUILTIN_TEMPLATES + custom

    async def create(self, data: dict) -> dict:
        record = {
            "id": str(uuid.uuid4()),
            "name": data["name"],
            "description": data.get("description", ""),
            "cpus": int(data["cpus"]),
            "memory_mb": int(data["memory_mb"]),
            "disk_gb": int(data["disk_gb"]),
            "image": data.get("image", "24.04"),
            "tier": data.get("tier", ""),
            "is_builtin": False,
        }
        async with self._write_lock:
            await asyncio.to_thread(self._insert_sync, record)
        return record

    async def delete(self, template_id: str) -> bool:
        async with self._write_lock:
            affected = await asyncio.to_thread(self._delete_sync, template_id)
        return affected > 0

    def _list_custom_sync(self) -> list[dict]:
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT id, name, description, cpus, memory_mb, disk_gb, image, tier "
                "FROM templates ORDER BY rowid"
            ).fetchall()
            return [{**dict(row), "is_builtin": False} for row in rows]
        finally:
            conn.close()

    def _insert_sync(self, record: dict) -> None:
        conn = self._connect()
        try:
            conn.execute(
                "INSERT INTO templates(id, name, description, cpus, memory_mb, disk_gb, image, tier) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    record["id"],
                    record["name"],
                    record["description"],
                    record["cpus"],
                    record["memory_mb"],
                    record["disk_gb"],
                    record["image"],
                    record["tier"],
                ),
            )
            conn.commit()
        finally:
            conn.close()

    def _delete_sync(self, template_id: str) -> int:
        conn = self._connect()
        try:
            cur = conn.execute("DELETE FROM templates WHERE id = ?", (template_id,))
            conn.commit()
            return cur.rowcount
        finally:
            conn.close()
