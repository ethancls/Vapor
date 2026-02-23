#!/usr/bin/env bash
# Vapor install script — builds and installs the Go binary + systemd unit
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY=/usr/local/bin/vapor
SERVICE_FILE=/etc/systemd/system/vapor@.service
ENV_DIR=/etc/vapor
ENV_FILE=$ENV_DIR/vapor.env
DB_DIR=/var/lib/vapor

# 1. Check multipass
if ! command -v multipass &>/dev/null; then
  echo "ERROR: multipass is not in PATH. Install it first: snap install multipass"
  exit 1
fi
echo "✓ multipass found: $(multipass version | head -1)"

# 2. Detect current user (must not be root)
if [ "$(id -u)" = "0" ]; then
  echo "ERROR: Run this script as a regular user (not root). sudo will be used as needed."
  exit 1
fi
CURRENT_USER="$(id -un)"
echo "✓ Installing as user: $CURRENT_USER"

# 3. Build frontend
echo "→ Building frontend..."
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm not found. Install Node.js first."
  exit 1
fi
npm run build --prefix "$REPO_ROOT/frontend"
echo "✓ Frontend built"

# 4. Build Go binary
echo "→ Building Go binary..."
if ! command -v go &>/dev/null; then
  echo "ERROR: go not found. Install Go 1.22+ first."
  exit 1
fi
CGO_ENABLED=0 go build -ldflags="-s -w" -o "$REPO_ROOT/vapor" "$REPO_ROOT"
echo "✓ Binary built: $(du -sh "$REPO_ROOT/vapor" | cut -f1)"

# 5. Install binary
echo "→ Installing binary to $BINARY..."
sudo install -m 755 "$REPO_ROOT/vapor" "$BINARY"
echo "✓ Binary installed"

# 6. Create env file if absent
if [ ! -f "$ENV_FILE" ]; then
  echo "→ Creating $ENV_FILE..."
  sudo mkdir -p "$ENV_DIR"
  sudo tee "$ENV_FILE" >/dev/null <<EOF
VAPOR_BIND=0.0.0.0:8100
VAPOR_UI_USERNAME=admin
VAPOR_UI_PASSWORD=changeme
VAPOR_SESSION_TTL=24h
VAPOR_LOG_LEVEL=info
VAPOR_MULTIPASS_BINARY=multipass
VAPOR_DB_PATH=$DB_DIR/vapor.db
VAPOR_ACTIVITY_RETENTION=5000
EOF

  # Prompt for password
  echo ""
  read -rp "Set dashboard password (leave blank to keep 'changeme'): " UI_PASS
  if [ -n "$UI_PASS" ]; then
    sudo sed -i "s|^VAPOR_UI_PASSWORD=.*|VAPOR_UI_PASSWORD=$UI_PASS|" "$ENV_FILE"
  fi
  echo "✓ Env file created: $ENV_FILE"
else
  echo "✓ Env file already exists: $ENV_FILE"
fi

# 7. Create DB directory
sudo mkdir -p "$DB_DIR"
sudo chown "$CURRENT_USER:$CURRENT_USER" "$DB_DIR"
echo "✓ DB directory: $DB_DIR"

# 8. Install systemd unit
echo "→ Installing systemd unit..."
sudo cp "$REPO_ROOT/deploy/vapor.service" "$SERVICE_FILE"
sudo sed -i "s|%i|$CURRENT_USER|g" "$SERVICE_FILE"
sudo systemctl daemon-reload
sudo systemctl enable --now "vapor@$CURRENT_USER"
echo "✓ Service enabled and started"

# 9. Show status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Vapor is running!"
echo "  Dashboard: http://$(hostname -I | awk '{print $1}'):8100"
echo "  Logs:      journalctl -u vapor@$CURRENT_USER -f"
echo "  Config:    $ENV_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
