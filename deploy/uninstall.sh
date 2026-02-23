#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root: sudo ./scripts/uninstall.sh"
  exit 1
fi

systemctl disable --now vapor.service 2>/dev/null || true
rm -f /etc/systemd/system/vapor.service
systemctl daemon-reload

echo "vapor service removed."
echo "state kept at /var/lib/vapor and config kept at /etc/vapor."
