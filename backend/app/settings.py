from __future__ import annotations

import os
from dataclasses import dataclass


def _parse_csv(value: str) -> list[str]:
    items = [item.strip() for item in value.split(",")]
    return [item for item in items if item]


def _parse_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


@dataclass(slots=True)
class Settings:
    app_name: str = "Vapor"
    cors_origins: list[str] | None = None
    poll_interval_seconds: float = 5.0
    metric_history_max_points: int = 60
    multipass_binary: str = "multipass"
    multipass_timeout_seconds: int = 45
    multipass_max_concurrency: int = 6
    instances_cache_ttl_seconds: float = 2.0
    activity_db_path: str = "activity.db"
    activity_retention: int = 5000
    trusted_hosts: list[str] | None = None
    max_request_body_bytes: int = 2 * 1024 * 1024
    expose_internal_errors: bool = False
    auth_enabled: bool = False
    auth_read_tokens: list[str] | None = None
    auth_write_tokens: list[str] | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        raw_origins = os.getenv("VAPOR_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        raw_read_tokens = os.getenv("VAPOR_AUTH_READ_TOKENS", "")
        raw_write_tokens = os.getenv("VAPOR_AUTH_WRITE_TOKENS", "")
        raw_trusted_hosts = os.getenv("VAPOR_TRUSTED_HOSTS", "localhost,127.0.0.1")
        return cls(
            app_name=os.getenv("VAPOR_APP_NAME", "Vapor"),
            cors_origins=_parse_csv(raw_origins),
            poll_interval_seconds=float(os.getenv("VAPOR_POLL_INTERVAL_SECONDS", "5")),
            metric_history_max_points=int(os.getenv("VAPOR_METRIC_HISTORY_MAX_POINTS", "60")),
            multipass_binary=os.getenv("VAPOR_MULTIPASS_BINARY", "multipass"),
            multipass_timeout_seconds=int(os.getenv("VAPOR_MULTIPASS_TIMEOUT_SECONDS", "45")),
            multipass_max_concurrency=int(os.getenv("VAPOR_MULTIPASS_MAX_CONCURRENCY", "6")),
            instances_cache_ttl_seconds=float(os.getenv("VAPOR_INSTANCES_CACHE_TTL_SECONDS", "2")),
            activity_db_path=os.getenv("VAPOR_ACTIVITY_DB_PATH", "activity.db"),
            activity_retention=int(os.getenv("VAPOR_ACTIVITY_RETENTION", "5000")),
            trusted_hosts=_parse_csv(raw_trusted_hosts),
            max_request_body_bytes=int(os.getenv("VAPOR_MAX_REQUEST_BODY_BYTES", str(2 * 1024 * 1024))),
            expose_internal_errors=_parse_bool(os.getenv("VAPOR_EXPOSE_INTERNAL_ERRORS"), default=False),
            auth_enabled=_parse_bool(os.getenv("VAPOR_AUTH_ENABLED"), default=False),
            auth_read_tokens=_parse_csv(raw_read_tokens),
            auth_write_tokens=_parse_csv(raw_write_tokens),
        )
