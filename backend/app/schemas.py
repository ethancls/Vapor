from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
SIZE_RE = re.compile(r"^\d+[kKmMgGtTpP]?[iI]?[bB]?$")


class ResourceUsage(BaseModel):
    total: int = 0
    used: int = 0


class InstanceSummary(BaseModel):
    name: str
    state: str = "Unknown"
    ipv4: list[str] = Field(default_factory=list)
    image: str = ""
    image_release: str = ""
    release: str = ""
    cpus: int = 0
    memory: ResourceUsage = Field(default_factory=ResourceUsage)
    disk: ResourceUsage = Field(default_factory=ResourceUsage)


class InstancesResponse(BaseModel):
    instances: list[InstanceSummary]


class HistoryPoint(BaseModel):
    ts: str
    cpu: float = 0
    ram_used: int = 0
    ram_total: int = 0
    disk_used: int = 0
    disk_total: int = 0


class HistoryResponse(BaseModel):
    history: list[HistoryPoint]


class ActionResponse(BaseModel):
    status: str
    error: str = ""


class MountSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    host: str
    guest: str = ""


class LaunchInstanceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    image: str = Field(default="ubuntu:22.04", min_length=1)
    cpus: int = Field(default=1, ge=1, le=64)
    memory: str = Field(default="1G")
    disk: str = Field(default="10G")
    timeout: int = Field(default=300, ge=10, le=3600)
    networks: list[str] = Field(default_factory=list)
    bridged: bool = False
    cloud_init: str | None = None
    mounts: list[MountSpec] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not NAME_RE.match(value):
            raise ValueError("name must match ^[a-z0-9][a-z0-9-]*$")
        return value

    @field_validator("memory", "disk")
    @classmethod
    def validate_size(cls, value: str) -> str:
        if not SIZE_RE.match(value):
            raise ValueError("size must look like 512M, 2G, 40GiB")
        return value


class SnapshotsResponse(BaseModel):
    snapshots: list[dict[str, Any]]


class NetworksResponse(BaseModel):
    networks: list[dict[str, Any]]


class ActivityEntry(BaseModel):
    timestamp: str
    action: str
    vm_name: str
    status: str
    error: str = ""


class ActivityResponse(BaseModel):
    activity: list[ActivityEntry]


class StatsResponse(BaseModel):
    daemon_running: bool
    total: int
    running: int
    stopped: int
    suspended: int
    total_cpus: int
    total_ram_used: int
    total_ram: int
    total_disk_used: int
    total_disk: int


class MultipassCommandMetadata(BaseModel):
    name: str
    mutating: bool


class MultipassCommandListResponse(BaseModel):
    commands: list[MultipassCommandMetadata]


class MultipassHelpResponse(BaseModel):
    command: str
    help: str


class HealthResponse(BaseModel):
    status: str
    daemon_running: bool
    ws_clients: int


class InstanceActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    purge: bool = True


class SnapshotCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    comment: str | None = None


class SnapshotRestoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destructive: bool = False


class CloneInstanceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not NAME_RE.match(value):
            raise ValueError("name must match ^[a-z0-9][a-z0-9-]*$")
        return value


class ExecRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    command: list[str] = Field(min_length=1)
    working_directory: str | None = None
    no_map_working_directory: bool = False

    @field_validator("command")
    @classmethod
    def validate_command(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in value:
            token = item.strip()
            if not token:
                raise ValueError("command entries cannot be empty")
            cleaned.append(token)
        return cleaned


class ExecResponse(BaseModel):
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int


class InstanceSshPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(default="ubuntu", min_length=1, max_length=32)
    password_length: int = Field(default=20, ge=12, le=64)
    enable_password_auth: bool = True

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        token = value.strip()
        if not re.match(r"^[a-z_][a-z0-9_-]*[$]?$", token):
            raise ValueError("username contains invalid characters")
        return token


class InstanceSshPasswordResponse(BaseModel):
    status: str
    instance: str
    username: str
    host: str
    ssh_command: str
    password: str
    note: str = ""


class InstanceSshPasswordStatusResponse(BaseModel):
    status: str
    instance: str
    username: str
    host: str = ""
    ssh_command: str = ""
    checked: bool = False
    password_auth: bool = False
    account_locked: bool = True
    enabled: bool = False
    error: str = ""


class InstanceSshPasswordDisableRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(default="ubuntu", min_length=1, max_length=32)
    lock_password: bool = True
    disable_password_auth: bool = True

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        token = value.strip()
        if not re.match(r"^[a-z_][a-z0-9_-]*[$]?$", token):
            raise ValueError("username contains invalid characters")
        return token


class InstanceUpdateStatus(BaseModel):
    instance: str
    state: str
    checked: bool = False
    upgradable: int = 0
    security: int = 0
    reboot_required: bool = False
    packages: list[str] = Field(default_factory=list)
    source: str = ""
    error: str = ""


class UpdatesResponse(BaseModel):
    updates: list[InstanceUpdateStatus]


class InstanceUpdateRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_upgrade: bool = False
    refresh: bool = True
    autoremove: bool = True


class InstanceUpdateRunResponse(BaseModel):
    status: str
    instance: str
    mode: str
    note: str = ""


class MountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=1)
    path: str | None = None
    mount_type: str | None = Field(default=None, pattern="^(classic|native)$")
    uid_map: list[str] = Field(default_factory=list)
    gid_map: list[str] = Field(default_factory=list)


class TransferRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sources: list[str] = Field(min_length=1)
    destination: str = Field(min_length=1)
    recursive: bool = False
    parents: bool = False

    @field_validator("sources")
    @classmethod
    def validate_sources(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in value:
            token = item.strip()
            if not token:
                raise ValueError("sources cannot contain empty values")
            cleaned.append(token)
        return cleaned


class ImagesResponse(BaseModel):
    images: dict[str, Any] | list[Any]


class AliasesResponse(BaseModel):
    aliases: dict[str, Any] | list[Any]


class AliasCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    definition: str = Field(min_length=3)
    name: str | None = None
    no_map_working_directory: bool = False


class AliasPreferRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)


class SettingsKeysResponse(BaseModel):
    keys: list[str]


class SettingValueResponse(BaseModel):
    key: str
    value: str


class SettingSetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: str


class SettingsValuesResponse(BaseModel):
    values: dict[str, str]


class VersionResponse(BaseModel):
    version: dict[str, Any] | str


class HostInfoResponse(BaseModel):
    cpus: int
    memory_mb: int
    disk_free_gb: int


class InstanceTemplate(BaseModel):
    id: str
    name: str
    description: str = ""
    cpus: int
    memory_mb: int
    disk_gb: int
    image: str = "24.04"
    tier: str = ""
    is_builtin: bool = False


class TemplateListResponse(BaseModel):
    templates: list[InstanceTemplate]


class TemplateCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    cpus: int = Field(default=1, ge=1, le=64)
    memory_mb: int = Field(default=1024, ge=256)
    disk_gb: int = Field(default=10, ge=1)
    image: str = Field(default="24.04", min_length=1)
    tier: str = ""
