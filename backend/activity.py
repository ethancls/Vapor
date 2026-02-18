import json
import os
from datetime import datetime, timezone

ACTIVITY_FILE = os.path.join(os.path.dirname(__file__), "activity.json")


def _load() -> list[dict]:
    if not os.path.exists(ACTIVITY_FILE):
        return []
    try:
        with open(ACTIVITY_FILE, "r") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save(entries: list[dict]) -> None:
    with open(ACTIVITY_FILE, "w") as f:
        json.dump(entries, f, indent=2)


def log(action: str, vm_name: str, status: str, error: str = "") -> dict:
    entries = _load()
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "vm_name": vm_name,
        "status": status,
        "error": error,
    }
    entries.insert(0, entry)
    # Keep last 500 entries
    _save(entries[:500])
    return entry


def get_all(limit: int = 100) -> list[dict]:
    return _load()[:limit]
