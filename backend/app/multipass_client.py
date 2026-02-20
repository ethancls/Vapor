from __future__ import annotations

import asyncio
import copy
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any


SUPPORTED_COMMANDS = {
    "alias",
    "aliases",
    "authenticate",
    "clone",
    "delete",
    "exec",
    "find",
    "get",
    "help",
    "info",
    "launch",
    "list",
    "mount",
    "networks",
    "prefer",
    "purge",
    "recover",
    "restart",
    "restore",
    "set",
    "shell",
    "snapshot",
    "start",
    "stop",
    "suspend",
    "transfer",
    "umount",
    "unalias",
    "version",
}

MUTATING_COMMANDS = {
    "alias",
    "authenticate",
    "clone",
    "delete",
    "launch",
    "mount",
    "prefer",
    "purge",
    "recover",
    "restart",
    "restore",
    "set",
    "snapshot",
    "start",
    "stop",
    "suspend",
    "transfer",
    "umount",
    "unalias",
}

_OPTION_RE = re.compile(r"^-{1,2}[a-zA-Z0-9][a-zA-Z0-9-]*$")
_SIZE_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s*$")

_SIZE_MULTIPLIERS = {
    "": 1,
    "b": 1,
    "k": 1000,
    "kb": 1000,
    "ki": 1024,
    "kib": 1024,
    "m": 1000**2,
    "mb": 1000**2,
    "mi": 1024**2,
    "mib": 1024**2,
    "g": 1000**3,
    "gb": 1000**3,
    "gi": 1024**3,
    "gib": 1024**3,
    "t": 1000**4,
    "tb": 1000**4,
    "ti": 1024**4,
    "tib": 1024**4,
    "p": 1000**5,
    "pb": 1000**5,
    "pi": 1024**5,
    "pib": 1024**5,
}


class MultipassCommandError(Exception):
    def __init__(
        self,
        message: str,
        *,
        argv: list[str],
        exit_code: int = -1,
        stdout: str = "",
        stderr: str = "",
    ):
        super().__init__(message)
        self.message = message
        self.argv = argv
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr


@dataclass(slots=True)
class CommandExecution:
    argv: list[str]
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int


class MultipassClient:
    def __init__(
        self,
        *,
        binary: str = "multipass",
        timeout_seconds: int = 45,
        max_concurrency: int = 6,
        instances_cache_ttl_seconds: float = 2.0,
    ):
        self.binary = binary
        self.timeout_seconds = timeout_seconds
        self._semaphore = asyncio.Semaphore(max(1, max_concurrency))
        self._logger = logging.getLogger("vapor.multipass")

        self._instances_cache_ttl_seconds = max(0.0, instances_cache_ttl_seconds)
        self._instances_cache: list[dict[str, Any]] | None = None
        self._instances_cache_deadline: float = 0.0
        self._instances_cache_lock = asyncio.Lock()
        self._instance_config_cache_ttl_seconds: float = 10.0
        self._instance_config_cache: dict[str, tuple[float, dict[str, int]]] = {}
        self._instance_config_cache_lock = asyncio.Lock()

    @property
    def commands(self) -> list[str]:
        return sorted(SUPPORTED_COMMANDS)

    def is_mutating_command(self, command: str) -> bool:
        return command in MUTATING_COMMANDS

    def invalidate_instances_cache(self) -> None:
        self._instances_cache = None
        self._instances_cache_deadline = 0.0
        self._instance_config_cache.clear()

    async def daemon_running(self) -> bool:
        try:
            result = await self.run("version", timeout_seconds=10)
            return result.exit_code == 0
        except MultipassCommandError:
            return False

    async def command_help(self, command: str) -> str:
        if command not in SUPPORTED_COMMANDS:
            raise MultipassCommandError(
                f"Unsupported multipass command: {command}",
                argv=[self.binary, command],
            )
        result = await self.run_checked("help", args=[command])
        return result.stdout

    async def run(
        self,
        command: str,
        *,
        args: list[str] | None = None,
        options: dict[str, Any] | None = None,
        stdin: str | None = None,
        timeout_seconds: int | None = None,
    ) -> CommandExecution:
        if command not in SUPPORTED_COMMANDS:
            raise MultipassCommandError(
                f"Unsupported multipass command: {command}",
                argv=[self.binary, command],
            )

        argv = self._build_argv(command, args=args or [], options=options or {})
        timeout = timeout_seconds or self.timeout_seconds
        start = time.perf_counter()

        async with self._semaphore:
            try:
                process = await asyncio.create_subprocess_exec(
                    *argv,
                    stdin=asyncio.subprocess.PIPE if stdin is not None else None,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            except FileNotFoundError as exc:
                raise MultipassCommandError(
                    "multipass binary not found",
                    argv=argv,
                    exit_code=127,
                    stderr=str(exc),
                ) from exc

            input_data = stdin.encode() if stdin is not None else None
            try:
                stdout_raw, stderr_raw = await asyncio.wait_for(process.communicate(input=input_data), timeout=timeout)
            except TimeoutError as exc:
                process.kill()
                await process.wait()
                raise MultipassCommandError(
                    f"multipass command timed out after {timeout}s",
                    argv=argv,
                    exit_code=124,
                ) from exc

        duration_ms = int((time.perf_counter() - start) * 1000)
        stdout = (stdout_raw or b"").decode("utf-8", errors="replace").strip()
        stderr = (stderr_raw or b"").decode("utf-8", errors="replace").strip()

        return CommandExecution(
            argv=argv,
            exit_code=process.returncode,
            stdout=stdout,
            stderr=stderr,
            duration_ms=duration_ms,
        )

    async def run_checked(
        self,
        command: str,
        *,
        args: list[str] | None = None,
        options: dict[str, Any] | None = None,
        stdin: str | None = None,
        timeout_seconds: int | None = None,
    ) -> CommandExecution:
        result = await self.run(
            command,
            args=args,
            options=options,
            stdin=stdin,
            timeout_seconds=timeout_seconds,
        )
        if result.exit_code != 0:
            message = result.stderr or result.stdout or f"multipass {command} failed"
            raise MultipassCommandError(
                message,
                argv=result.argv,
                exit_code=result.exit_code,
                stdout=result.stdout,
                stderr=result.stderr,
            )
        return result

    async def run_json_checked(
        self,
        command: str,
        *,
        args: list[str] | None = None,
        options: dict[str, Any] | None = None,
        stdin: str | None = None,
        timeout_seconds: int | None = None,
    ) -> tuple[CommandExecution, Any]:
        result = await self.run_checked(
            command,
            args=args,
            options=options,
            stdin=stdin,
            timeout_seconds=timeout_seconds,
        )
        try:
            parsed = json.loads(result.stdout) if result.stdout else {}
        except json.JSONDecodeError as exc:
            raise MultipassCommandError(
                "Invalid JSON returned by multipass",
                argv=result.argv,
                exit_code=result.exit_code,
                stdout=result.stdout,
                stderr=result.stderr,
            ) from exc
        return result, parsed

    async def list_instances_summary(self) -> list[dict[str, Any]]:
        _, data = await self.run_json_checked("list", options={"--format": "json"})
        result: list[dict[str, Any]] = []
        for item in data.get("list", []):
            disk_total, disk_used = self._parse_disk_usage(
                item.get("disk"),
                item.get("disks"),
            )
            result.append(
                {
                    "name": item.get("name", ""),
                    "state": item.get("state", "Unknown"),
                    "ipv4": item.get("ipv4", []) or [],
                    "image": item.get("release", "") or "",
                    "image_release": item.get("release", "") or "",
                    "release": item.get("release", "") or "",
                    "cpus": int(item.get("cpu_count") or 0),
                    "memory": {
                        "total": self._to_bytes((item.get("memory") or {}).get("total", 0)),
                        "used": self._to_bytes((item.get("memory") or {}).get("used", 0)),
                    },
                    "disk": {
                        "total": disk_total,
                        "used": disk_used,
                    },
                }
            )
        return result

    async def get_instance_info(self, name: str) -> dict[str, Any]:
        _, data = await self.run_json_checked("info", args=[name], options={"--format": "json"})
        info = (data.get("info") or {}).get(name, {})
        memory = info.get("memory") or {}
        disk_total, disk_used = self._parse_disk_usage(
            info.get("disk"),
            info.get("disks"),
        )
        config = await self.get_instance_config_resources(name)

        cpus = int(info.get("cpu_count") or 0)
        memory_total = self._to_bytes(memory.get("total", 0))
        memory_used = self._to_bytes(memory.get("used", 0))
        config_cpus = int(config.get("cpus") or 0)
        config_memory_total = int(config.get("memory_total") or 0)
        config_disk_total = int(config.get("disk_total") or 0)
        if config_cpus > 0:
            cpus = config_cpus
        if config_memory_total > 0:
            memory_total = config_memory_total
        if config_disk_total > 0:
            disk_total = config_disk_total

        return {
            "name": name,
            "state": info.get("state", "Unknown"),
            "ipv4": info.get("ipv4", []) or [],
            "image": info.get("release", "") or info.get("image_release", "") or "",
            "image_release": info.get("image_release", "") or "",
            "release": info.get("release", "") or "",
            "cpus": cpus,
            "memory": {
                "total": memory_total,
                "used": memory_used,
            },
            "disk": {
                "total": disk_total,
                "used": disk_used,
            },
        }

    async def get_all_instances_info(self, *, use_cache: bool = True) -> list[dict[str, Any]]:
        now = time.monotonic()
        if use_cache and self._instances_cache and now < self._instances_cache_deadline:
            return copy.deepcopy(self._instances_cache)

        async with self._instances_cache_lock:
            now = time.monotonic()
            if use_cache and self._instances_cache and now < self._instances_cache_deadline:
                return copy.deepcopy(self._instances_cache)

            summary = await self.list_instances_summary()
            if not summary:
                self._instances_cache = []
                self._instances_cache_deadline = now + self._instances_cache_ttl_seconds
                return []

            info_tasks = [self.get_instance_info(item["name"]) for item in summary if item.get("name")]
            details = await asyncio.gather(*info_tasks, return_exceptions=True)

            by_name: dict[str, dict[str, Any]] = {}
            for detail in details:
                if isinstance(detail, Exception):
                    continue
                by_name[detail["name"]] = detail

            missing_names = [item["name"] for item in summary if item.get("name") and item["name"] not in by_name]
            config_by_name: dict[str, dict[str, int]] = {}
            if missing_names:
                config_results = await asyncio.gather(
                    *(self.get_instance_config_resources(name) for name in missing_names),
                    return_exceptions=True,
                )
                for name, config in zip(missing_names, config_results, strict=False):
                    if isinstance(config, Exception):
                        continue
                    config_by_name[name] = config

            merged: list[dict[str, Any]] = []
            for item in summary:
                name = item.get("name")
                if name and name in by_name:
                    detail = by_name[name]
                    summary_release = str(item.get("release") or "").strip()
                    summary_image_release = str(item.get("image_release") or "").strip()

                    if not str(detail.get("release") or "").strip() and summary_release:
                        detail["release"] = summary_release
                    if not str(detail.get("image_release") or "").strip() and summary_image_release:
                        detail["image_release"] = summary_image_release

                    # Keep a stable UI label across running/stopped states.
                    if summary_release:
                        detail["image"] = summary_release
                    elif summary_image_release:
                        detail["image"] = summary_image_release
                    elif detail.get("release"):
                        detail["image"] = detail["release"]
                    elif detail.get("image_release"):
                        detail["image"] = detail["image_release"]

                    merged.append(detail)
                else:
                    config = config_by_name.get(name or "", {})
                    if config:
                        config_cpus = int(config.get("cpus") or 0)
                        config_memory_total = int(config.get("memory_total") or 0)
                        config_disk_total = int(config.get("disk_total") or 0)
                        if config_cpus > 0:
                            item["cpus"] = config_cpus
                        memory_obj = item.get("memory") if isinstance(item.get("memory"), dict) else {}
                        disk_obj = item.get("disk") if isinstance(item.get("disk"), dict) else {}
                        if config_memory_total > 0:
                            memory_obj["total"] = config_memory_total
                        if config_disk_total > 0:
                            disk_obj["total"] = config_disk_total
                        item["memory"] = memory_obj
                        item["disk"] = disk_obj
                    merged.append(item)

            self._instances_cache = merged
            self._instances_cache_deadline = time.monotonic() + self._instances_cache_ttl_seconds
            return copy.deepcopy(merged)

    def _build_argv(self, command: str, *, args: list[str], options: dict[str, Any]) -> list[str]:
        argv = [self.binary, command]

        for option, value in options.items():
            if not _OPTION_RE.match(option):
                raise MultipassCommandError(
                    f"Invalid option format: {option}",
                    argv=[self.binary, command],
                )

            if isinstance(value, bool):
                if value:
                    argv.append(option)
                continue

            if isinstance(value, list):
                for item in value:
                    argv.append(option)
                    argv.append(str(item))
                continue

            argv.append(option)
            argv.append(str(value))

        for arg in args:
            argv.append(str(arg))

        return argv

    def _to_bytes(self, value: Any) -> int:
        if value is None:
            return 0
        if isinstance(value, bool):
            return 0
        if isinstance(value, (int, float)):
            return int(value)

        text = str(value).strip()
        if not text:
            return 0

        match = _SIZE_RE.match(text)
        if not match:
            return 0

        amount = float(match.group(1))
        unit = (match.group(2) or "").strip().lower()
        multiplier = _SIZE_MULTIPLIERS.get(unit)
        if multiplier is None:
            self._logger.debug("Unknown size unit from multipass output: %s", unit)
            return 0
        return int(amount * multiplier)

    def _parse_disk_usage(self, disk: Any, disks: Any) -> tuple[int, int]:
        # Newer multipass info output exposes per-device data under "disks".
        if isinstance(disks, dict) and disks:
            total = 0
            used = 0
            for device_data in disks.values():
                if not isinstance(device_data, dict):
                    continue
                total += self._to_bytes(device_data.get("total", 0))
                used += self._to_bytes(device_data.get("used", 0))
            if total or used:
                return total, used

        # Fallback for older formats that may expose a single "disk" object.
        disk_obj = disk if isinstance(disk, dict) else {}
        return (
            self._to_bytes(disk_obj.get("total", 0)),
            self._to_bytes(disk_obj.get("used", 0)),
        )

    async def get_instance_config_resources(self, name: str, *, use_cache: bool = True) -> dict[str, int]:
        now = time.monotonic()
        if use_cache and name in self._instance_config_cache:
            deadline, cached = self._instance_config_cache[name]
            if now < deadline:
                return dict(cached)

        async with self._instance_config_cache_lock:
            now = time.monotonic()
            if use_cache and name in self._instance_config_cache:
                deadline, cached = self._instance_config_cache[name]
                if now < deadline:
                    return dict(cached)

            key_map = {
                "cpus": f"local.{name}.cpus",
                "memory_total": f"local.{name}.memory",
                "disk_total": f"local.{name}.disk",
            }

            async def _read(setting_key: str) -> str:
                try:
                    result = await self.run_checked(
                        "get",
                        args=[setting_key],
                        options={"--raw": True},
                        timeout_seconds=10,
                    )
                    return result.stdout.strip()
                except MultipassCommandError:
                    return ""

            cpu_raw, memory_raw, disk_raw = await asyncio.gather(
                _read(key_map["cpus"]),
                _read(key_map["memory_total"]),
                _read(key_map["disk_total"]),
            )

            try:
                cpus = int(cpu_raw) if cpu_raw else 0
            except ValueError:
                cpus = 0

            data = {
                "cpus": cpus,
                "memory_total": self._to_bytes(memory_raw),
                "disk_total": self._to_bytes(disk_raw),
            }
            self._instance_config_cache[name] = (
                time.monotonic() + self._instance_config_cache_ttl_seconds,
                data,
            )
            return dict(data)
