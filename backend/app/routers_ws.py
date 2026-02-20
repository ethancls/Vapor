from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .dependencies import authorize_websocket

router = APIRouter(tags=["ws"])
logger = logging.getLogger("vapor.api.ws")


@router.websocket("/ws/instances")
async def ws_instances(websocket: WebSocket) -> None:
    if not authorize_websocket(websocket):
        await websocket.close(code=1008)
        return

    services = websocket.app.state.services

    await services.ws_manager.connect(websocket)

    try:
        instances = await services.multipass.get_all_instances_info(use_cache=True)
        await websocket.send_json({"type": "instances", "data": instances})

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("websocket failure")
    finally:
        await services.ws_manager.disconnect(websocket)
