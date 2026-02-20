from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, Request, WebSocket, status

from .services import AppServices


def get_services(request: Request) -> AppServices:
    return request.app.state.services


@dataclass(slots=True)
class AccessPrincipal:
    token: str
    can_write: bool


def _extract_token(auth_header: str | None, api_key_header: str | None) -> str:
    if auth_header:
        parts = auth_header.strip().split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
            return parts[1].strip()
    if api_key_header and api_key_header.strip():
        return api_key_header.strip()
    return ""


def _authenticate_token(services: AppServices, token: str) -> AccessPrincipal | None:
    settings = services.settings
    if not settings.auth_enabled:
        return AccessPrincipal(token="", can_write=True)

    if not token:
        return None

    write_tokens = set(settings.auth_write_tokens or [])
    read_tokens = set(settings.auth_read_tokens or [])

    if token in write_tokens:
        return AccessPrincipal(token=token, can_write=True)
    if token in read_tokens:
        return AccessPrincipal(token=token, can_write=False)
    return None


def _unauthorized_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions",
    )


def require_read_access(request: Request) -> AccessPrincipal:
    services = get_services(request)
    token = _extract_token(
        request.headers.get("Authorization"),
        request.headers.get("X-API-Key"),
    )
    principal = _authenticate_token(services, token)
    if principal is None:
        raise _unauthorized_error()
    return principal


def require_write_access(request: Request) -> AccessPrincipal:
    principal = require_read_access(request)
    if not principal.can_write:
        raise _forbidden_error()
    return principal


def authorize_websocket(websocket: WebSocket) -> bool:
    services: AppServices = websocket.app.state.services
    token = _extract_token(
        websocket.headers.get("Authorization"),
        websocket.headers.get("X-API-Key") or websocket.query_params.get("token"),
    )
    return _authenticate_token(services, token) is not None
