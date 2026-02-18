import json
import subprocess
from typing import Any


def _run(cmd: list[str]) -> tuple[bool, Any, str]:
    """Run a multipass command. Returns (success, parsed_json_or_None, raw_stdout)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return False, None, result.stderr.strip()
        return True, None, result.stdout.strip()
    except subprocess.TimeoutExpired:
        return False, None, "Command timed out"
    except FileNotFoundError:
        return False, None, "multipass not found"


def _run_json(cmd: list[str]) -> tuple[bool, Any, str]:
    ok, _, out = _run(cmd)
    if not ok:
        return False, None, out
    try:
        return True, json.loads(out), ""
    except json.JSONDecodeError:
        return False, None, f"JSON parse error: {out}"


def list_instances() -> tuple[bool, list[dict], str]:
    ok, data, err = _run_json(["multipass", "list", "--format", "json"])
    if not ok:
        return False, [], err
    instances = []
    for item in data.get("list", []):
        instances.append({
            "name": item.get("name"),
            "state": item.get("state"),
            "ipv4": item.get("ipv4", []),
            "image": item.get("release", ""),
        })
    return True, instances, ""


def get_instance(name: str) -> tuple[bool, dict, str]:
    ok, data, err = _run_json(["multipass", "info", name, "--format", "json"])
    if not ok:
        return False, {}, err
    info = data.get("info", {}).get(name, {})
    return True, _parse_info(name, info), ""


def _parse_info(name: str, info: dict) -> dict:
    cpu_usage = info.get("cpu_count", 0)
    mem = info.get("memory", {})
    disk = info.get("disk", {})
    return {
        "name": name,
        "state": info.get("state", "Unknown"),
        "ipv4": info.get("ipv4", []),
        "image": info.get("image_release", ""),
        "cpus": cpu_usage,
        "memory": {
            "total": mem.get("total", 0),
            "used": mem.get("used", 0),
        },
        "disk": {
            "total": disk.get("total", 0),
            "used": disk.get("used", 0),
        },
    }


def get_all_instances_info() -> tuple[bool, list[dict], str]:
    ok, instances, err = list_instances()
    if not ok:
        return False, [], err
    result = []
    for inst in instances:
        name = inst["name"]
        ok2, detail, _ = get_instance(name)
        if ok2:
            result.append(detail)
        else:
            result.append(inst)
    return True, result, ""


def start(name: str) -> tuple[bool, str]:
    ok, _, err = _run(["multipass", "start", name])
    return ok, err


def stop(name: str) -> tuple[bool, str]:
    ok, _, err = _run(["multipass", "stop", name])
    return ok, err


def suspend(name: str) -> tuple[bool, str]:
    ok, _, err = _run(["multipass", "suspend", name])
    return ok, err


def delete(name: str) -> tuple[bool, str]:
    ok, _, err = _run(["multipass", "delete", name])
    if not ok:
        return False, err
    _run(["multipass", "purge"])
    return True, ""


def launch(
    name: str,
    image: str,
    cpus: int,
    memory: str,
    disk: str,
    timeout: int = 300,
    networks: list[str] | None = None,
    bridged: bool = False,
    cloud_init: str | None = None,
    mounts: list[dict] | None = None,
) -> tuple[bool, str]:
    import tempfile, os
    cmd = [
        "multipass", "launch",
        "--name", name,
        "--cpus", str(cpus),
        "--memory", memory,
        "--disk", disk,
        "--timeout", str(timeout),
        image,
    ]
    if bridged:
        cmd.append("--bridged")
    for net in (networks or []):
        cmd += ["--network", net]

    tmp_cloud_init = None
    if cloud_init:
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False)
        tmp.write(cloud_init)
        tmp.close()
        tmp_cloud_init = tmp.name
        cmd += ["--cloud-init", tmp_cloud_init]

    ok, _, err = _run(cmd)

    if tmp_cloud_init:
        try: os.unlink(tmp_cloud_init)
        except: pass

    if ok and mounts:
        for m in mounts:
            host = m.get("host", "").strip()
            guest = m.get("guest", "").strip()
            if host:
                mount_cmd = ["multipass", "mount", host, f"{name}:{guest}" if guest else name]
                _run(mount_cmd)  # best-effort

    return ok, err


def list_snapshots(name: str) -> tuple[bool, list[dict], str]:
    ok, data, err = _run_json(["multipass", "snapshot", "--list", name, "--format", "json"])
    if not ok:
        # Fallback: try without --list flag (older multipass versions)
        ok2, data2, err2 = _run_json(["multipass", "list", "--snapshots", "--format", "json"])
        if not ok2:
            return False, [], err
        snaps = [s for s in data2.get("list", []) if s.get("instance") == name]
        return True, snaps, ""
    return True, data.get("snapshots", []), ""


def snapshot(name: str, snap_name: str | None = None) -> tuple[bool, str]:
    cmd = ["multipass", "snapshot", name]
    if snap_name:
        cmd += ["--name", snap_name]
    ok, _, err = _run(cmd)
    return ok, err


def list_networks() -> tuple[bool, list[dict], str]:
    ok, data, err = _run_json(["multipass", "networks", "--format", "json"])
    if not ok:
        return False, [], err
    return True, data.get("list", []), ""


def is_daemon_running() -> bool:
    ok, _, _ = _run(["multipass", "version"])
    return ok
