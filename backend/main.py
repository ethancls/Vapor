import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import activity as act
import multipass as mp
import stats as st

# In-memory metric history: {vm_name: [{"ts": ..., "cpu": ..., "ram_used": ..., "disk_used": ...}]}
metric_history: dict[str, list[dict]] = {}
MAX_HISTORY = 60

connected_ws: list[WebSocket] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(poll_loop())
    yield
    task.cancel()


app = FastAPI(title="MPDash", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Polling loop
# ---------------------------------------------------------------------------

async def poll_loop():
    while True:
        await asyncio.sleep(5)
        try:
            ok, instances, _ = await asyncio.to_thread(mp.get_all_instances_info)
            if ok:
                ts = datetime.utcnow().isoformat()
                for inst in instances:
                    name = inst["name"]
                    if name not in metric_history:
                        metric_history[name] = []
                    entry = {
                        "ts": ts,
                        "cpu": 0,  # multipass info doesn't expose live CPU %
                        "ram_used": inst.get("memory", {}).get("used", 0),
                        "ram_total": inst.get("memory", {}).get("total", 0),
                        "disk_used": inst.get("disk", {}).get("used", 0),
                        "disk_total": inst.get("disk", {}).get("total", 0),
                    }
                    metric_history[name].append(entry)
                    if len(metric_history[name]) > MAX_HISTORY:
                        metric_history[name].pop(0)

                payload = json.dumps({"type": "instances", "data": instances})
                dead = []
                for ws in connected_ws:
                    try:
                        await ws.send_text(payload)
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    connected_ws.remove(ws)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/api/instances")
async def get_instances():
    ok, instances, err = await asyncio.to_thread(mp.get_all_instances_info)
    if not ok:
        return {"error": err, "instances": []}
    return {"instances": instances}


@app.get("/api/instances/{name}")
async def get_instance(name: str):
    ok, detail, err = await asyncio.to_thread(mp.get_instance, name)
    if not ok:
        return {"error": err}
    return detail


@app.post("/api/instances/{name}/start")
async def start_instance(name: str):
    ok, err = await asyncio.to_thread(mp.start, name)
    status = "success" if ok else "error"
    act.log("start", name, status, err)
    return {"status": status, "error": err}


@app.post("/api/instances/{name}/stop")
async def stop_instance(name: str):
    ok, err = await asyncio.to_thread(mp.stop, name)
    status = "success" if ok else "error"
    act.log("stop", name, status, err)
    return {"status": status, "error": err}


@app.post("/api/instances/{name}/suspend")
async def suspend_instance(name: str):
    ok, err = await asyncio.to_thread(mp.suspend, name)
    status = "success" if ok else "error"
    act.log("suspend", name, status, err)
    return {"status": status, "error": err}


@app.delete("/api/instances/{name}")
async def delete_instance(name: str):
    ok, err = await asyncio.to_thread(mp.delete, name)
    status = "success" if ok else "error"
    act.log("delete", name, status, err)
    return {"status": status, "error": err}


@app.post("/api/instances/launch")
async def launch_instance(body: dict):
    name = body.get("name", "")
    image = body.get("image", "ubuntu:22.04")
    cpus = int(body.get("cpus", 1))
    memory = body.get("memory", "1G")
    disk = body.get("disk", "10G")
    timeout = int(body.get("timeout", 300))
    networks = body.get("networks", [])
    bridged = bool(body.get("bridged", False))
    cloud_init = body.get("cloud_init")
    mounts = body.get("mounts", [])
    ok, err = await asyncio.to_thread(
        mp.launch, name, image, cpus, memory, disk,
        timeout, networks, bridged, cloud_init, mounts,
    )
    status = "success" if ok else "error"
    act.log("launch", name, status, err)
    return {"status": status, "error": err}


@app.get("/api/instances/{name}/snapshots")
async def get_snapshots(name: str):
    ok, snaps, err = await asyncio.to_thread(mp.list_snapshots, name)
    if not ok:
        return {"error": err, "snapshots": []}
    return {"snapshots": snaps}


@app.post("/api/instances/{name}/snapshot")
async def create_snapshot(name: str, body: dict = {}):
    snap_name = body.get("name")
    ok, err = await asyncio.to_thread(mp.snapshot, name, snap_name)
    status = "success" if ok else "error"
    act.log("snapshot", name, status, err)
    return {"status": status, "error": err}


@app.get("/api/instances/{name}/history")
async def get_history(name: str):
    return {"history": metric_history.get(name, [])}


@app.get("/api/networks")
async def get_networks():
    ok, networks, err = await asyncio.to_thread(mp.list_networks)
    if not ok:
        return {"error": err, "networks": []}
    return {"networks": networks}


@app.get("/api/activity")
async def get_activity(limit: int = 100):
    return {"activity": act.get_all(limit)}


@app.get("/api/stats")
async def get_stats():
    return await asyncio.to_thread(st.get_stats)


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@app.websocket("/ws/instances")
async def ws_instances(websocket: WebSocket):
    await websocket.accept()
    connected_ws.append(websocket)
    # Send current state immediately on connect
    try:
        ok, instances, _ = await asyncio.to_thread(mp.get_all_instances_info)
        if ok:
            await websocket.send_text(json.dumps({"type": "instances", "data": instances}))
        while True:
            await websocket.receive_text()  # keep alive, ignore incoming
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in connected_ws:
            connected_ws.remove(websocket)
