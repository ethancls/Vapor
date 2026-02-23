#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root: sudo ./deploy/uninstall.sh"
  exit 1
fi

mapfile -t running_units < <(systemctl list-units --type=service --all 'vapor@*.service' --no-legend 2>/dev/null | awk '{print $1}')
for unit in "${running_units[@]}"; do
  [[ -n "$unit" ]] || continue
  systemctl disable --now "$unit" 2>/dev/null || true
done

systemctl disable --now vapor.service 2>/dev/null || true
rm -f /etc/systemd/system/vapor.service
rm -f /etc/systemd/system/vapor@.service
systemctl daemon-reload

echo "vapor service removed."
echo "state kept at /var/lib/vapor and config kept at /etc/vapor."
