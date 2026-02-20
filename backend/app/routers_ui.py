from __future__ import annotations

import asyncio
import logging
import os
import secrets
import shlex
import string
import tempfile
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from .dependencies import get_services, require_read_access, require_write_access
from .multipass_client import MultipassCommandError
from .schemas import (
    ActionResponse,
    ActivityResponse,
    AliasCreateRequest,
    AliasPreferRequest,
    AliasesResponse,
    CloneInstanceRequest,
    ExecRequest,
    ExecResponse,
    HealthResponse,
    HistoryResponse,
    ImagesResponse,
    InstanceSshPasswordRequest,
    InstanceSshPasswordDisableRequest,
    InstanceSshPasswordResponse,
    InstanceSshPasswordStatusResponse,
    InstanceUpdateStatus,
    InstanceUpdateRunRequest,
    InstanceUpdateRunResponse,
    InstanceActionRequest,
    InstancesResponse,
    LaunchInstanceRequest,
    MountRequest,
    MultipassCommandListResponse,
    MultipassCommandMetadata,
    MultipassHelpResponse,
    NetworksResponse,
    SettingSetRequest,
    SettingsKeysResponse,
    SettingsValuesResponse,
    SettingValueResponse,
    SnapshotCreateRequest,
    SnapshotRestoreRequest,
    SnapshotsResponse,
    StatsResponse,
    TemplateCreateRequest,
    TemplateListResponse,
    TransferRequest,
    UpdatesResponse,
    VersionResponse,
    HostInfoResponse,
)
from .services import AppServices


router = APIRouter(
    prefix="/api",
    tags=["ui"],
    dependencies=[Depends(require_read_access)],
)
logger = logging.getLogger("vapor.api.ui")

_ALLOWED_INSTANCE_ACTIONS = {"start", "stop", "suspend", "restart", "recover", "delete"}
_PASSWORD_ALPHABET = string.ascii_letters + string.digits


def _looks_like_not_found(message: str) -> bool:
    text = message.lower()
    return "not found" in text or "does not exist" in text or "unknown" in text


def _http_status_from_multipass_error(message: str) -> int:
    text = message.lower()
    if _looks_like_not_found(message):
        return 404
    if "permission denied" in text or "forbidden" in text:
        return 403
    if "invalid" in text or "usage:" in text or "bad" in text:
        return 400
    return 502


def _parse_output_lines(raw: str) -> list[str]:
    return [line.strip() for line in raw.splitlines() if line.strip()]


def _normalize_snapshots_payload(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]

    if not isinstance(data, dict):
        return []

    list_payload = data.get("list")
    if isinstance(list_payload, list):
        return [item for item in list_payload if isinstance(item, dict)]

    snapshots_payload = data.get("snapshots")
    if isinstance(snapshots_payload, list):
        return [item for item in snapshots_payload if isinstance(item, dict)]

    # Multipass (older versions) returns:
    # {"info": {"instance": {"snapshot1": {"comment": "", "parent": ""}}}}
    info_payload = data.get("info")
    if isinstance(info_payload, dict):
        normalized: list[dict[str, Any]] = []
        for instance_name, snapshots in info_payload.items():
            if not isinstance(snapshots, dict):
                continue
            for snapshot_name, snapshot_meta in snapshots.items():
                item: dict[str, Any] = {
                    "instance": str(instance_name),
                    "snapshot": str(snapshot_name),
                }
                if isinstance(snapshot_meta, dict):
                    item.update(snapshot_meta)
                normalized.append(item)
        return normalized

    return []


def _generate_password(length: int) -> str:
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))


def _probe_updates_script() -> str:
    return (
        "set -euo pipefail; "
        "UPGRADABLE=0; SECURITY=0; SOURCE='none'; "
        "if [ -x /usr/lib/update-notifier/apt-check ]; then "
        "RAW=$(/usr/lib/update-notifier/apt-check 2>/dev/null || true); "
        "if echo \"$RAW\" | grep -Eq '^[0-9]+;[0-9]+$'; then "
        "UPGRADABLE=${RAW%%;*}; SECURITY=${RAW##*;}; SOURCE='apt-check'; fi; fi; "
        "PACKAGES=$(apt list --upgradable 2>/dev/null | tail -n +2 | sed '/^\\s*$/d' | head -n 25 || true); "
        "if [ \"$SOURCE\" = 'none' ]; then "
        "if [ -n \"$PACKAGES\" ]; then UPGRADABLE=$(printf \"%s\\n\" \"$PACKAGES\" | wc -l | tr -d ' '); "
        "else UPGRADABLE=0; fi; SECURITY=0; SOURCE='apt-list'; fi; "
        "if [ -f /var/run/reboot-required ]; then REBOOT_REQUIRED=true; else REBOOT_REQUIRED=false; fi; "
        "echo \"UPGRADABLE=$UPGRADABLE\"; "
        "echo \"SECURITY=$SECURITY\"; "
        "echo \"SOURCE=$SOURCE\"; "
        "echo \"REBOOT_REQUIRED=$REBOOT_REQUIRED\"; "
        "echo \"PACKAGES_BEGIN\"; "
        "printf \"%s\\n\" \"$PACKAGES\"; "
        "echo \"PACKAGES_END\""
    )


def _parse_updates_probe_output(stdout: str) -> tuple[int, int, bool, str, list[str]]:
    upgradable = 0
    security = 0
    reboot_required = False
    source = ""
    packages: list[str] = []
    in_packages = False

    for raw_line in stdout.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line == "PACKAGES_BEGIN":
            in_packages = True
            continue
        if line == "PACKAGES_END":
            in_packages = False
            continue
        if in_packages:
            packages.append(line)
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        token = value.strip()
        if key == "UPGRADABLE":
            try:
                upgradable = int(token)
            except ValueError:
                upgradable = 0
        elif key == "SECURITY":
            try:
                security = int(token)
            except ValueError:
                security = 0
        elif key == "SOURCE":
            source = token
        elif key == "REBOOT_REQUIRED":
            reboot_required = token.lower() in {"1", "true", "yes", "on"}

    return upgradable, security, reboot_required, source, packages


def _probe_ssh_password_status_script(username: str) -> str:
    username_q = shlex.quote(username)
    return (
        "set -euo pipefail; "
        "PASSWORD_AUTH=''; "
        "if command -v sshd >/dev/null 2>&1; then "
        "PASSWORD_AUTH=$(sshd -T 2>/dev/null | awk '/^passwordauthentication /{print tolower($2); exit}' || true); "
        "fi; "
        "if [ -z \"$PASSWORD_AUTH\" ]; then "
        "PASSWORD_AUTH=$(grep -hE '^\\s*PasswordAuthentication\\s+' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | tail -n1 | awk '{print tolower($2)}' || true); "
        "fi; "
        "if [ -z \"$PASSWORD_AUTH\" ]; then PASSWORD_AUTH='no'; fi; "
        f"PASS_STATUS=$(sudo passwd -S {username_q} 2>/dev/null | awk '{{print $2}}' || true); "
        "if [ \"$PASS_STATUS\" = 'L' ]; then ACCOUNT_LOCKED=true; else ACCOUNT_LOCKED=false; fi; "
        "echo \"PASSWORD_AUTH=$PASSWORD_AUTH\"; "
        "echo \"ACCOUNT_LOCKED=$ACCOUNT_LOCKED\""
    )


def _parse_bool(value: str, default: bool = False) -> bool:
    token = value.strip().lower()
    if token in {"1", "true", "yes", "on"}:
        return True
    if token in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_key_value_output(stdout: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw_line in stdout.splitlines():
        line = raw_line.strip()
        if not line or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip()
    return result


async def _log_action(
    services: AppServices,
    *,
    action: str,
    vm_name: str,
    success: bool,
    error: str = "",
) -> None:
    await services.activity.add(action, vm_name, "success" if success else "error", error if not success else "")


async def _instance_action(
    services: AppServices,
    *,
    action: str,
    vm_name: str,
    args: list[str] | None = None,
    options: dict[str, Any] | None = None,
) -> ActionResponse:
    try:
        await services.multipass.run_checked(action, args=args, options=options)
        services.multipass.invalidate_instances_cache()
        await _log_action(services, action=action, vm_name=vm_name, success=True)
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        await _log_action(services, action=action, vm_name=vm_name, success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


async def _check_instance_updates(services: AppServices, instance: dict[str, Any]) -> InstanceUpdateStatus:
    name = str(instance.get("name") or "").strip()
    state = str(instance.get("state") or "Unknown")
    if not name:
        return InstanceUpdateStatus(instance="", state=state, checked=False, error="invalid instance")

    if state != "Running":
        return InstanceUpdateStatus(instance=name, state=state, checked=False, error="instance not running")

    try:
        probe = await services.multipass.run_checked(
            "exec",
            args=[name, "--", "bash", "-lc", _probe_updates_script()],
            timeout_seconds=120,
        )
        upgradable, security, reboot_required, source, packages = _parse_updates_probe_output(probe.stdout)
        return InstanceUpdateStatus(
            instance=name,
            state=state,
            checked=True,
            upgradable=upgradable,
            security=security,
            reboot_required=reboot_required,
            packages=packages,
            source=source,
        )
    except MultipassCommandError as exc:
        return InstanceUpdateStatus(
            instance=name,
            state=state,
            checked=False,
            error=exc.message,
        )


@router.get("/health", response_model=HealthResponse)
async def get_health(services: AppServices = Depends(get_services)) -> HealthResponse:
    daemon_ok = await services.multipass.daemon_running()
    ws_clients = await services.ws_manager.count()
    return HealthResponse(status="ok", daemon_running=daemon_ok, ws_clients=ws_clients)


@router.get("/system/version", response_model=VersionResponse)
async def get_version(services: AppServices = Depends(get_services)) -> VersionResponse:
    try:
        _, parsed = await services.multipass.run_json_checked("version", options={"--format": "json"})
        return VersionResponse(version=parsed)
    except MultipassCommandError:
        result = await services.multipass.run_checked("version")
        return VersionResponse(version=result.stdout)


@router.get("/system/host", response_model=HostInfoResponse)
async def get_host_info() -> HostInfoResponse:
    import platform
    import shutil

    cpus = os.cpu_count() or 4

    ram_mb = 8192
    try:
        system = platform.system()
        if system == "Linux":
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        ram_mb = int(line.split()[1]) // 1024
                        break
        elif system == "Darwin":
            import subprocess
            r = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, timeout=2)
            ram_mb = int(r.stdout.strip()) // (1024 * 1024)
    except Exception:
        pass

    disk_free_gb = 100
    try:
        usage = shutil.disk_usage("/")
        disk_free_gb = int(usage.free // (1024 ** 3))
    except Exception:
        pass

    return HostInfoResponse(cpus=cpus, memory_mb=ram_mb, disk_free_gb=disk_free_gb)


@router.get("/system/commands", response_model=MultipassCommandListResponse)
async def get_commands(services: AppServices = Depends(get_services)) -> MultipassCommandListResponse:
    commands = [
        MultipassCommandMetadata(name=name, mutating=services.multipass.is_mutating_command(name))
        for name in services.multipass.commands
    ]
    return MultipassCommandListResponse(commands=commands)


@router.get("/system/commands/{command}/help", response_model=MultipassHelpResponse)
async def get_command_help(command: str, services: AppServices = Depends(get_services)) -> MultipassHelpResponse:
    try:
        help_text = await services.multipass.command_help(command)
    except MultipassCommandError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return MultipassHelpResponse(command=command, help=help_text)


@router.get("/images", response_model=ImagesResponse)
async def get_images(
    q: str | None = None,
    show_unsupported: bool = False,
    only_images: bool = False,
    only_blueprints: bool = False,
    force_update: bool = False,
    services: AppServices = Depends(get_services),
) -> ImagesResponse:
    options: dict[str, Any] = {"--format": "json"}
    if show_unsupported:
        options["--show-unsupported"] = True
    if only_images:
        options["--only-images"] = True
    if only_blueprints:
        options["--only-blueprints"] = True
    if force_update:
        options["--force-update"] = True

    args = [q] if q else []
    try:
        _, data = await services.multipass.run_json_checked("find", args=args, options=options)
    except MultipassCommandError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    return ImagesResponse(images=data)


@router.get("/instances", response_model=InstancesResponse)
async def get_instances(services: AppServices = Depends(get_services)) -> InstancesResponse:
    try:
        instances = await services.multipass.get_all_instances_info(use_cache=True)
    except MultipassCommandError as exc:
        raise HTTPException(status_code=503, detail=exc.message) from exc
    return InstancesResponse(instances=instances)


@router.get("/updates", response_model=UpdatesResponse)
async def get_updates(services: AppServices = Depends(get_services)) -> UpdatesResponse:
    try:
        instances = await services.multipass.get_all_instances_info(use_cache=True)
    except MultipassCommandError as exc:
        raise HTTPException(status_code=503, detail=exc.message) from exc

    statuses = await asyncio.gather(*(_check_instance_updates(services, item) for item in instances))
    statuses.sort(key=lambda item: item.instance)
    return UpdatesResponse(updates=statuses)


@router.post("/instances", response_model=ActionResponse)
async def create_instance(
    payload: LaunchInstanceRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    options: dict[str, Any] = {
        "--name": payload.name,
        "--cpus": payload.cpus,
        "--memory": payload.memory,
        "--disk": payload.disk,
        "--timeout": payload.timeout,
    }
    if payload.bridged:
        options["--bridged"] = True
    if payload.networks:
        options["--network"] = payload.networks

    cloud_init_file: str | None = None
    if payload.cloud_init:
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False)
        tmp.write(payload.cloud_init)
        tmp.flush()
        tmp.close()
        cloud_init_file = tmp.name
        options["--cloud-init"] = cloud_init_file

    try:
        await services.multipass.run_checked("launch", args=[payload.image], options=options)
        for mount in payload.mounts:
            mount_target = f"{payload.name}:{mount.guest}" if mount.guest else payload.name
            await services.multipass.run_checked("mount", args=[mount.host, mount_target])

        services.multipass.invalidate_instances_cache()
        await _log_action(services, action="launch", vm_name=payload.name, success=True)
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        await _log_action(services, action="launch", vm_name=payload.name, success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc
    finally:
        if cloud_init_file:
            try:
                os.unlink(cloud_init_file)
            except OSError:
                logger.warning("failed to remove cloud-init temp file: %s", cloud_init_file)


@router.get("/instances/{name}")
async def get_instance(name: str, services: AppServices = Depends(get_services)) -> dict[str, Any]:
    try:
        instances = await services.multipass.get_all_instances_info(use_cache=True)
        for item in instances:
            if item.get("name") == name:
                return item
        return await services.multipass.get_instance_info(name)
    except MultipassCommandError as exc:
        status = 404 if _looks_like_not_found(exc.message) else 502
        raise HTTPException(status_code=status, detail=exc.message) from exc


@router.post("/instances/{name}/actions/{action}", response_model=ActionResponse)
async def run_instance_action(
    name: str,
    action: str,
    payload: InstanceActionRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    if action not in _ALLOWED_INSTANCE_ACTIONS:
        raise HTTPException(status_code=400, detail=f"unsupported action: {action}")

    options: dict[str, Any] = {}
    if action == "delete" and payload.purge:
        options["--purge"] = True

    return await _instance_action(services, action=action, vm_name=name, args=[name], options=options)


@router.post("/instances/{name}/clone", response_model=ActionResponse)
async def clone_instance(
    name: str,
    payload: CloneInstanceRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    options: dict[str, Any] = {}
    if payload.name:
        options["--name"] = payload.name

    try:
        await services.multipass.run_checked("clone", args=[name], options=options)
        services.multipass.invalidate_instances_cache()
        await _log_action(services, action="clone", vm_name=name, success=True)
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        await _log_action(services, action="clone", vm_name=name, success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.post("/instances/{name}/exec", response_model=ExecResponse)
async def exec_instance(
    name: str,
    payload: ExecRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ExecResponse:
    options: dict[str, Any] = {}
    if payload.working_directory:
        options["--working-directory"] = payload.working_directory
    if payload.no_map_working_directory:
        options["--no-map-working-directory"] = True

    args = [name, "--", *payload.command]
    try:
        result = await services.multipass.run("exec", args=args, options=options)
    except MultipassCommandError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc

    return ExecResponse(
        exit_code=result.exit_code,
        stdout=result.stdout,
        stderr=result.stderr,
        duration_ms=result.duration_ms,
    )


@router.post("/instances/{name}/ssh-password", response_model=InstanceSshPasswordResponse)
async def generate_instance_ssh_password(
    name: str,
    payload: InstanceSshPasswordRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> InstanceSshPasswordResponse:
    password = _generate_password(payload.password_length)
    try:
        await services.multipass.run_checked(
            "exec",
            args=[name, "--", "sudo", "chpasswd"],
            stdin=f"{payload.username}:{password}\n",
        )

        if payload.enable_password_auth:
            enable_password_auth_script = (
                "set -euo pipefail; "
                "sudo install -d -m 755 /etc/ssh/sshd_config.d; "
                "cat <<'EOF' | sudo tee /etc/ssh/sshd_config.d/99-vapor-password-auth.conf >/dev/null\n"
                "PasswordAuthentication yes\n"
                "KbdInteractiveAuthentication yes\n"
                "EOF\n"
                "if command -v systemctl >/dev/null 2>&1; then "
                "sudo systemctl restart ssh || sudo systemctl restart sshd; "
                "else sudo service ssh restart || sudo service sshd restart; fi"
            )
            await services.multipass.run_checked(
                "exec",
                args=[name, "--", "bash", "-lc", enable_password_auth_script],
            )

        services.multipass.invalidate_instances_cache()
        host = ""
        try:
            info = await services.multipass.get_instance_info(name)
            ips = info.get("ipv4") if isinstance(info, dict) else []
            if isinstance(ips, list) and ips:
                host = str(ips[0])
        except MultipassCommandError:
            host = ""

        ssh_command = f"ssh {payload.username}@{host}" if host else f"ssh {payload.username}@<instance-ip>"
        await _log_action(services, action="ssh_password", vm_name=name, success=True)
        return InstanceSshPasswordResponse(
            status="success",
            instance=name,
            username=payload.username,
            host=host,
            ssh_command=ssh_command,
            password=password
        )
    except MultipassCommandError as exc:
        await _log_action(services, action="ssh_password", vm_name=name, success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.get("/instances/{name}/ssh-password/status", response_model=InstanceSshPasswordStatusResponse)
async def get_instance_ssh_password_status(
    name: str,
    username: str = Query(default="ubuntu"),
    services: AppServices = Depends(get_services),
) -> InstanceSshPasswordStatusResponse:
    try:
        info = await services.multipass.get_instance_info(name)
    except MultipassCommandError as exc:
        status = 404 if _looks_like_not_found(exc.message) else 502
        raise HTTPException(status_code=status, detail=exc.message) from exc

    host = ""
    ips = info.get("ipv4") if isinstance(info, dict) else []
    if isinstance(ips, list) and ips:
        host = str(ips[0])

    state = str(info.get("state") or "Unknown")
    if state != "Running":
        return InstanceSshPasswordStatusResponse(
            status="success",
            instance=name,
            username=username,
            host=host,
            ssh_command=f"ssh {username}@{host}" if host else f"ssh {username}@<instance-ip>",
            checked=False,
            password_auth=False,
            account_locked=True,
            enabled=False,
            error="instance not running",
        )

    try:
        probe = await services.multipass.run_checked(
            "exec",
            args=[name, "--", "bash", "-lc", _probe_ssh_password_status_script(username)],
            timeout_seconds=60,
        )
        parsed = _parse_key_value_output(probe.stdout)
        password_auth = parsed.get("PASSWORD_AUTH", "no").lower() == "yes"
        account_locked = _parse_bool(parsed.get("ACCOUNT_LOCKED", "true"), default=True)
        enabled = password_auth and not account_locked
        return InstanceSshPasswordStatusResponse(
            status="success",
            instance=name,
            username=username,
            host=host,
            ssh_command=f"ssh {username}@{host}" if host else f"ssh {username}@<instance-ip>",
            checked=True,
            password_auth=password_auth,
            account_locked=account_locked,
            enabled=enabled,
            error="",
        )
    except MultipassCommandError as exc:
        return InstanceSshPasswordStatusResponse(
            status="success",
            instance=name,
            username=username,
            host=host,
            ssh_command=f"ssh {username}@{host}" if host else f"ssh {username}@<instance-ip>",
            checked=False,
            password_auth=False,
            account_locked=True,
            enabled=False,
            error=exc.message,
        )


@router.post("/instances/{name}/ssh-password/disable", response_model=ActionResponse)
async def disable_instance_ssh_password(
    name: str,
    payload: InstanceSshPasswordDisableRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    username_quoted = shlex.quote(payload.username)
    try:
        if payload.disable_password_auth:
            disable_password_auth_script = (
                "set -euo pipefail; "
                "sudo install -d -m 755 /etc/ssh/sshd_config.d; "
                "cat <<'EOF' | sudo tee /etc/ssh/sshd_config.d/99-vapor-password-auth.conf >/dev/null\n"
                "PasswordAuthentication no\n"
                "KbdInteractiveAuthentication no\n"
                "EOF\n"
                "if command -v systemctl >/dev/null 2>&1; then "
                "sudo systemctl restart ssh || sudo systemctl restart sshd; "
                "else sudo service ssh restart || sudo service sshd restart; fi"
            )
            await services.multipass.run_checked(
                "exec",
                args=[name, "--", "bash", "-lc", disable_password_auth_script],
            )

        if payload.lock_password:
            await services.multipass.run_checked(
                "exec",
                args=[name, "--", "bash", "-lc", f"sudo passwd -l {username_quoted}"],
            )

        await _log_action(services, action="ssh_password_disable", vm_name=name, success=True)
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        await _log_action(services, action="ssh_password_disable", vm_name=name, success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.post("/instances/{name}/updates/run", response_model=InstanceUpdateRunResponse)
async def run_instance_updates(
    name: str,
    payload: InstanceUpdateRunRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> InstanceUpdateRunResponse:
    try:
        info = await services.multipass.get_instance_info(name)
    except MultipassCommandError as exc:
        status = 404 if _looks_like_not_found(exc.message) else 502
        raise HTTPException(status_code=status, detail=exc.message) from exc

    if str(info.get("state") or "") != "Running":
        raise HTTPException(status_code=409, detail="instance must be running to apply updates")

    commands: list[str] = []
    if payload.refresh:
        commands.append("sudo DEBIAN_FRONTEND=noninteractive apt-get update -y")
    if payload.full_upgrade:
        commands.append("sudo DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade")
        mode = "full-upgrade"
    else:
        commands.append("sudo DEBIAN_FRONTEND=noninteractive apt-get -y upgrade")
        mode = "upgrade"
    if payload.autoremove:
        commands.append("sudo DEBIAN_FRONTEND=noninteractive apt-get -y autoremove --purge")

    script = "set -euo pipefail; " + "; ".join(commands)
    try:
        await services.multipass.run_checked(
            "exec",
            args=[name, "--", "bash", "-lc", script],
            timeout_seconds=1800,
        )
        await _log_action(services, action="updates_run", vm_name=name, success=True)
        return InstanceUpdateRunResponse(
            status="success",
            instance=name,
            mode=mode,
            note="System packages upgraded successfully",
        )
    except MultipassCommandError as exc:
        await _log_action(services, action="updates_run", vm_name=name, success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.post("/instances/{name}/mounts", response_model=ActionResponse)
async def mount_instance_path(
    name: str,
    payload: MountRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    options: dict[str, Any] = {}
    if payload.mount_type:
        options["--type"] = payload.mount_type
    if payload.uid_map:
        options["--uid-map"] = payload.uid_map
    if payload.gid_map:
        options["--gid-map"] = payload.gid_map

    target = f"{name}:{payload.path}" if payload.path else name
    return await _instance_action(
        services,
        action="mount",
        vm_name=name,
        args=[payload.source, target],
        options=options,
    )


@router.delete("/instances/{name}/mounts", response_model=ActionResponse)
async def umount_instance_path(
    name: str,
    path: str | None = Query(default=None),
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    target = f"{name}:{path}" if path else name
    return await _instance_action(services, action="umount", vm_name=name, args=[target])


@router.get("/instances/{name}/snapshots", response_model=SnapshotsResponse)
async def get_instance_snapshots(name: str, services: AppServices = Depends(get_services)) -> SnapshotsResponse:
    try:
        _, data = await services.multipass.run_json_checked(
            "snapshot",
            args=[name],
            options={"--list": True, "--format": "json"},
        )
        snapshots = _normalize_snapshots_payload(data)
        if any(str(item.get("instance", "")).strip() for item in snapshots):
            snapshots = [item for item in snapshots if str(item.get("instance", "")).strip() == name]
        return SnapshotsResponse(snapshots=snapshots)
    except MultipassCommandError:
        try:
            _, fallback = await services.multipass.run_json_checked("list", options={"--snapshots": True, "--format": "json"})
            snapshots = [item for item in _normalize_snapshots_payload(fallback) if str(item.get("instance", "")).strip() == name]
            return SnapshotsResponse(snapshots=snapshots)
        except MultipassCommandError as exc:
            raise HTTPException(status_code=502, detail=exc.message) from exc


@router.post("/instances/{name}/snapshots", response_model=ActionResponse)
async def create_instance_snapshot(
    name: str,
    payload: SnapshotCreateRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    options: dict[str, Any] = {}
    if payload.name:
        options["--name"] = payload.name
    if payload.comment:
        options["--comment"] = payload.comment

    try:
        await services.multipass.run_checked("snapshot", args=[name], options=options)
        services.multipass.invalidate_instances_cache()
        await _log_action(services, action="snapshot", vm_name=name, success=True)
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        await _log_action(services, action="snapshot", vm_name=name, success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.get("/snapshots", response_model=SnapshotsResponse)
async def get_all_snapshots(services: AppServices = Depends(get_services)) -> SnapshotsResponse:
    try:
        _, data = await services.multipass.run_json_checked("list", options={"--snapshots": True, "--format": "json"})
    except MultipassCommandError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    return SnapshotsResponse(snapshots=_normalize_snapshots_payload(data))


@router.post("/snapshots/{instance}/{snapshot}/restore", response_model=ActionResponse)
async def restore_snapshot(
    instance: str,
    snapshot: str,
    payload: SnapshotRestoreRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    options: dict[str, Any] = {}
    if payload.destructive:
        options["--destructive"] = True

    snapshot_ref = f"{instance}.{snapshot}"
    try:
        await services.multipass.run_checked("restore", args=[snapshot_ref], options=options)
        services.multipass.invalidate_instances_cache()
        await _log_action(services, action="restore", vm_name=instance, success=True)
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        await _log_action(services, action="restore", vm_name=instance, success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.delete("/snapshots/{instance}/{snapshot}", response_model=ActionResponse)
async def delete_snapshot(
    instance: str,
    snapshot: str,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    snapshot_ref = f"{instance}.{snapshot}"
    try:
        await services.multipass.run_checked("delete", args=[snapshot_ref], options={"--purge": True})
        services.multipass.invalidate_instances_cache()
        await _log_action(services, action="delete_snapshot", vm_name=instance, success=True)
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        await _log_action(services, action="delete_snapshot", vm_name=instance, success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.get("/instances/{name}/updates", response_model=UpdatesResponse)
async def get_instance_updates(name: str, services: AppServices = Depends(get_services)) -> UpdatesResponse:
    try:
        info = await services.multipass.get_instance_info(name)
    except MultipassCommandError as exc:
        status = 404 if _looks_like_not_found(exc.message) else 502
        raise HTTPException(status_code=status, detail=exc.message) from exc
    return UpdatesResponse(updates=[await _check_instance_updates(services, info)])


@router.get("/instances/{name}/history", response_model=HistoryResponse)
async def get_history(name: str, services: AppServices = Depends(get_services)) -> HistoryResponse:
    history = await services.metrics.get(name)
    return HistoryResponse(history=history)


@router.get("/networks", response_model=NetworksResponse)
async def get_networks(services: AppServices = Depends(get_services)) -> NetworksResponse:
    try:
        _, data = await services.multipass.run_json_checked("networks", options={"--format": "json"})
    except MultipassCommandError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    return NetworksResponse(networks=data.get("list", []))


@router.post("/transfers", response_model=ActionResponse)
async def transfer_files(
    payload: TransferRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    options: dict[str, Any] = {}
    if payload.recursive:
        options["--recursive"] = True
    if payload.parents:
        options["--parents"] = True

    args = [*payload.sources, payload.destination]
    try:
        await services.multipass.run_checked("transfer", args=args, options=options)
        await _log_action(services, action="transfer", vm_name="", success=True)
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        await _log_action(services, action="transfer", vm_name="", success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.get("/aliases", response_model=AliasesResponse)
async def get_aliases(services: AppServices = Depends(get_services)) -> AliasesResponse:
    try:
        _, data = await services.multipass.run_json_checked("aliases", options={"--format": "json"})
    except MultipassCommandError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc

    payload = data.get("aliases") if isinstance(data, dict) else None
    if payload is None and isinstance(data, dict):
        payload = data.get("list", data)
    if payload is None:
        payload = data

    return AliasesResponse(aliases=payload)


@router.post("/aliases", response_model=ActionResponse)
async def create_alias(
    payload: AliasCreateRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    args = [payload.definition]
    if payload.name:
        args.append(payload.name)

    options: dict[str, Any] = {}
    if payload.no_map_working_directory:
        options["--no-map-working-directory"] = True

    try:
        await services.multipass.run_checked("alias", args=args, options=options)
        await _log_action(services, action="alias", vm_name="", success=True)
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        await _log_action(services, action="alias", vm_name="", success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.delete("/aliases/{name}", response_model=ActionResponse)
async def delete_alias(
    name: str,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    try:
        await services.multipass.run_checked("unalias", args=[name])
        await _log_action(services, action="unalias", vm_name="", success=True)
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        await _log_action(services, action="unalias", vm_name="", success=False, error=exc.message)
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.post("/aliases/prefer", response_model=ActionResponse)
async def prefer_alias_context(
    payload: AliasPreferRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    try:
        await services.multipass.run_checked("prefer", args=[payload.name])
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.get("/settings/keys", response_model=SettingsKeysResponse)
async def get_settings_keys(
    prefix: str | None = None,
    services: AppServices = Depends(get_services),
) -> SettingsKeysResponse:
    args = [prefix] if prefix else []
    try:
        result = await services.multipass.run_checked("get", args=args, options={"--keys": True})
    except MultipassCommandError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    return SettingsKeysResponse(keys=_parse_output_lines(result.stdout))


@router.get("/settings", response_model=SettingsValuesResponse)
async def get_all_settings(services: AppServices = Depends(get_services)) -> SettingsValuesResponse:
    try:
        keys_result = await services.multipass.run_checked("get", options={"--keys": True})
    except MultipassCommandError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    keys = _parse_output_lines(keys_result.stdout)

    async def _read(key: str) -> tuple[str, str]:
        value_result = await services.multipass.run_checked("get", args=[key], options={"--raw": True})
        return key, value_result.stdout

    pairs = await asyncio.gather(*(_read(key) for key in keys), return_exceptions=True)
    values: dict[str, str] = {}
    for item in pairs:
        if isinstance(item, Exception):
            continue
        key, value = item
        values[key] = value

    return SettingsValuesResponse(values=values)


@router.get("/settings/{key:path}", response_model=SettingValueResponse)
async def get_setting(key: str, services: AppServices = Depends(get_services)) -> SettingValueResponse:
    try:
        result = await services.multipass.run_checked("get", args=[key], options={"--raw": True})
    except MultipassCommandError as exc:
        status = 404 if _looks_like_not_found(exc.message) else 502
        raise HTTPException(status_code=status, detail=exc.message) from exc
    return SettingValueResponse(key=key, value=result.stdout)


@router.put("/settings/{key:path}", response_model=ActionResponse)
async def set_setting(
    key: str,
    payload: SettingSetRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    try:
        await services.multipass.run_checked("set", args=[f"{key}={payload.value}"])
        return ActionResponse(status="success", error="")
    except MultipassCommandError as exc:
        raise HTTPException(status_code=_http_status_from_multipass_error(exc.message), detail=exc.message) from exc


@router.get("/activity", response_model=ActivityResponse)
async def get_activity(
    limit: int = Query(default=100, ge=1, le=1000),
    action: str | None = None,
    vm_name: str | None = None,
    services: AppServices = Depends(get_services),
) -> ActivityResponse:
    records = await services.activity.list(limit=limit, action=action, vm_name=vm_name)
    return ActivityResponse(activity=records)


@router.get("/stats", response_model=StatsResponse)
async def get_stats(services: AppServices = Depends(get_services)) -> StatsResponse:
    try:
        stats = await services.get_stats()
    except MultipassCommandError as exc:
        raise HTTPException(status_code=503, detail=exc.message) from exc
    return StatsResponse(**stats)


# ── Instance templates ─────────────────────────────────────────────────────────

@router.get("/templates", response_model=TemplateListResponse)
async def list_templates(services: AppServices = Depends(get_services)) -> TemplateListResponse:
    templates = await services.templates.list_all()
    return TemplateListResponse(templates=templates)


@router.post("/templates", response_model=TemplateListResponse)
async def create_template(
    payload: TemplateCreateRequest,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> TemplateListResponse:
    await services.templates.create(payload.model_dump())
    templates = await services.templates.list_all()
    return TemplateListResponse(templates=templates)


@router.delete("/templates/{template_id}", response_model=ActionResponse)
async def delete_template(
    template_id: str,
    services: AppServices = Depends(get_services),
    _: Any = Depends(require_write_access),
) -> ActionResponse:
    if template_id.startswith("builtin-"):
        raise HTTPException(status_code=400, detail="cannot delete built-in templates")
    deleted = await services.templates.delete(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="template not found")
    return ActionResponse(status="success")
