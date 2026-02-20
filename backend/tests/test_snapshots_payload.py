import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.routers_ui import _normalize_snapshots_payload, _parse_updates_probe_output, _parse_key_value_output


def test_normalize_snapshots_from_list_shape() -> None:
    payload = {
        "list": [
            {"instance": "vm-a", "snapshot": "snap-1", "comment": ""},
            {"instance": "vm-a", "snapshot": "snap-2", "comment": "x"},
        ]
    }
    result = _normalize_snapshots_payload(payload)
    assert len(result) == 2
    assert result[0]["instance"] == "vm-a"
    assert result[0]["snapshot"] == "snap-1"


def test_normalize_snapshots_from_info_shape() -> None:
    payload = {
        "info": {
            "vm-b": {
                "snapshot1": {"comment": "", "parent": ""},
                "snapshot2": {"comment": "", "parent": "snapshot1"},
            }
        }
    }
    result = _normalize_snapshots_payload(payload)
    assert len(result) == 2
    assert result[0]["instance"] == "vm-b"
    assert result[0]["snapshot"] == "snapshot1"
    assert result[1]["parent"] == "snapshot1"


def test_parse_updates_probe_output() -> None:
    stdout = """
    UPGRADABLE=7
    SECURITY=2
    SOURCE=apt-check
    REBOOT_REQUIRED=true
    PACKAGES_BEGIN
    bash/stable 5.2 amd64 [upgradable from: 5.1]
    curl/stable 8.5 amd64 [upgradable from: 8.4]
    PACKAGES_END
    """
    upgradable, security, reboot_required, source, packages = _parse_updates_probe_output(stdout)
    assert upgradable == 7
    assert security == 2
    assert reboot_required is True
    assert source == "apt-check"
    assert len(packages) == 2


def test_parse_key_value_output() -> None:
    stdout = "PASSWORD_AUTH=yes\nACCOUNT_LOCKED=false\n"
    parsed = _parse_key_value_output(stdout)
    assert parsed["PASSWORD_AUTH"] == "yes"
    assert parsed["ACCOUNT_LOCKED"] == "false"
