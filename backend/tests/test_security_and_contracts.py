from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.app_factory import create_app
from app.dependencies import require_read_access, require_write_access
from app.multipass_client import MultipassCommandError
from app.routers_ui import _instance_action
from app.settings import Settings


def make_settings(**overrides) -> Settings:
    base = Settings(
        app_name="Vapor Test",
        cors_origins=["http://localhost:5173"],
        poll_interval_seconds=5.0,
        metric_history_max_points=60,
        multipass_binary="multipass",
        multipass_timeout_seconds=45,
        multipass_max_concurrency=4,
        instances_cache_ttl_seconds=1.0,
        activity_db_path="activity.db",
        activity_retention=500,
        trusted_hosts=["testserver"],
        max_request_body_bytes=2 * 1024 * 1024,
        expose_internal_errors=False,
        auth_enabled=True,
        auth_read_tokens=["read-token"],
        auth_write_tokens=["write-token"],
    )
    for key, value in overrides.items():
        setattr(base, key, value)
    return base


def make_request(app, *, path: str = "/api/instances", headers: dict[str, str] | None = None) -> Request:
    raw_headers = []
    for key, value in (headers or {}).items():
        raw_headers.append((key.lower().encode("utf-8"), value.encode("utf-8")))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": b"",
        "headers": raw_headers,
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
        "root_path": "",
        "app": app,
    }
    return Request(scope)


def test_authn_authz_enforced() -> None:
    app = SimpleNamespace(state=SimpleNamespace(services=SimpleNamespace(settings=make_settings())))

    with pytest.raises(HTTPException) as unauthorized:
        require_read_access(make_request(app))
    assert unauthorized.value.status_code == 401

    read_principal = require_read_access(
        make_request(app, headers={"Authorization": "Bearer read-token"})
    )
    assert read_principal.can_write is False

    with pytest.raises(HTTPException) as forbidden:
        require_write_access(make_request(app, headers={"Authorization": "Bearer read-token"}))
    assert forbidden.value.status_code == 403

    write_principal = require_write_access(
        make_request(app, headers={"Authorization": "Bearer write-token"})
    )
    assert write_principal.can_write is True


def test_mutation_path_raises_http_error_on_multipass_failure() -> None:
    class FailingMultipass:
        async def run_checked(self, *args, **kwargs):
            raise MultipassCommandError("launch failed", argv=["multipass", "launch"])

        def invalidate_instances_cache(self) -> None:
            return None

    class Activity:
        async def add(self, *args, **kwargs):
            return None

    services = SimpleNamespace(multipass=FailingMultipass(), activity=Activity())

    async def _run():
        with pytest.raises(HTTPException) as exc:
            await _instance_action(services, action="launch", vm_name="vm1", args=["vm1"], options={})
        assert exc.value.status_code == 502
        assert exc.value.detail == "launch failed"

    asyncio.run(_run())


def test_multipass_exception_handler_redacts_internal_fields() -> None:
    settings = make_settings(auth_enabled=False, auth_read_tokens=[], auth_write_tokens=[])
    app = create_app(settings=settings, with_lifespan=False)
    handler = app.exception_handlers[MultipassCommandError]

    request = make_request(app)
    request.state.request_id = "req-123"
    exc = MultipassCommandError(
        "sensitive error",
        argv=["multipass", "launch", "--name", "secret"],
        stdout="sensitive-stdout",
        stderr="sensitive-stderr",
    )
    async def _run():
        response = await handler(request, exc)
        payload = json.loads(response.body.decode("utf-8"))

        assert response.status_code == 502
        assert payload["detail"] == "Upstream command failed"
        assert payload["request_id"] == "req-123"
        assert "argv" not in payload
        assert "stdout" not in payload
        assert "stderr" not in payload

    asyncio.run(_run())


def test_auth_enabled_requires_tokens() -> None:
    settings = make_settings(auth_read_tokens=[], auth_write_tokens=[])
    with pytest.raises(RuntimeError):
        create_app(settings=settings, with_lifespan=False)


def test_openapi_docs_endpoints_are_configured() -> None:
    settings = make_settings(auth_enabled=False, auth_read_tokens=[], auth_write_tokens=[])
    app = create_app(settings=settings, with_lifespan=False)

    assert app.docs_url == "/docs"
    assert app.openapi_url == "/openapi.json"
    assert app.redoc_url == "/redoc"


def test_openapi_includes_auth_security_when_enabled() -> None:
    app = create_app(settings=make_settings(), with_lifespan=False)
    openapi = app.openapi()

    schemes = openapi["components"]["securitySchemes"]
    assert "BearerAuth" in schemes
    assert "ApiKeyAuth" in schemes

    api_security = openapi["paths"]["/api/instances"]["get"]["security"]
    assert {"BearerAuth": []} in api_security
    assert {"ApiKeyAuth": []} in api_security
