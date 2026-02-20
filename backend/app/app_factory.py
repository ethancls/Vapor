from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .activity_store import ActivityStore
from .middleware import MaxBodySizeMiddleware, RequestContextMiddleware, SecurityHeadersMiddleware
from .logging_config import setup_logging
from .metrics_store import MetricHistoryStore
from .multipass_client import MultipassClient, MultipassCommandError
from .routers_ui import router as ui_router
from .routers_ws import router as ws_router
from .services import AppServices, PollerService
from .settings import Settings
from .template_store import TemplateStore
from .websocket_manager import WebSocketManager


def _validate_settings(settings: Settings) -> None:
    if settings.auth_enabled:
        read_tokens = settings.auth_read_tokens or []
        write_tokens = settings.auth_write_tokens or []
        if not read_tokens and not write_tokens:
            raise RuntimeError("auth is enabled but no tokens are configured")


def create_app(*, settings: Settings | None = None, with_lifespan: bool = True) -> FastAPI:
    setup_logging()
    settings = settings or Settings.from_env()
    _validate_settings(settings)
    logger = logging.getLogger("vapor.app")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        backend_dir = Path(__file__).resolve().parents[1]
        db_path = Path(settings.activity_db_path)
        if not db_path.is_absolute():
            db_path = (backend_dir / db_path).resolve()

        multipass = MultipassClient(
            binary=settings.multipass_binary,
            timeout_seconds=settings.multipass_timeout_seconds,
            max_concurrency=settings.multipass_max_concurrency,
            instances_cache_ttl_seconds=settings.instances_cache_ttl_seconds,
        )
        activity = ActivityStore(str(db_path), retention=settings.activity_retention)
        metrics = MetricHistoryStore(max_points=settings.metric_history_max_points)
        templates = TemplateStore(str(db_path))
        ws_manager = WebSocketManager()

        poller = PollerService(
            multipass=multipass,
            metrics=metrics,
            ws_manager=ws_manager,
            interval_seconds=settings.poll_interval_seconds,
        )

        services = AppServices(
            settings=settings,
            multipass=multipass,
            activity=activity,
            metrics=metrics,
            ws_manager=ws_manager,
            poller=poller,
            templates=templates,
        )
        app.state.services = services

        await activity.initialize()
        await templates.initialize()
        await poller.start()
        logger.info("application started")

        try:
            yield
        finally:
            await poller.stop()
            logger.info("application stopped")

    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan if with_lifespan else None,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    if settings.trusted_hosts:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
    app.add_middleware(MaxBodySizeMiddleware, max_bytes=settings.max_request_body_bytes)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestContextMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or [],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(ui_router)
    app.include_router(ws_router)

    def custom_openapi() -> dict:
        if app.openapi_schema:
            return app.openapi_schema

        schema = get_openapi(
            title=settings.app_name,
            version="1.0.0",
            routes=app.routes,
        )

        if settings.auth_enabled:
            components = schema.setdefault("components", {})
            security_schemes = components.setdefault("securitySchemes", {})
            security_schemes["BearerAuth"] = {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "API token",
            }
            security_schemes["ApiKeyAuth"] = {
                "type": "apiKey",
                "in": "header",
                "name": "X-API-Key",
            }

            for path, methods in schema.get("paths", {}).items():
                if not path.startswith("/api/"):
                    continue
                for operation in methods.values():
                    if isinstance(operation, dict):
                        operation.setdefault("security", [{"BearerAuth": []}, {"ApiKeyAuth": []}])

        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi

    @app.exception_handler(MultipassCommandError)
    async def multipass_error_handler(request: Request, exc: MultipassCommandError) -> JSONResponse:
        detail = exc.message if settings.expose_internal_errors else "Upstream command failed"
        return JSONResponse(
            status_code=502,
            content={"detail": detail, "request_id": getattr(request.state, "request_id", "")},
        )

    @app.exception_handler(404)
    async def not_found_handler(request: Request, _: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={
                "detail": "Route not found",
                "path": request.url.path,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error", exc_info=exc)
        detail = str(exc) if settings.expose_internal_errors else "Internal server error"
        return JSONResponse(
            status_code=500,
            content={"detail": detail, "request_id": getattr(request.state, "request_id", "")},
        )

    return app
