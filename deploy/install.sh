#!/usr/bin/env bash
# Eve install script — builds and installs the Go binary + systemd unit
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY=/usr/local/bin/eve
SERVICE_FILE=/etc/systemd/system/eve@.service
ENV_DIR=/etc/eve
ENV_FILE=$ENV_DIR/eve.env
DB_DIR=/var/lib/eve

generate_jwt_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
    return
  fi
  # Fallback secret if openssl is unavailable.
  date +%s | sha256sum | awk '{print $1}'
}

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
CGO_ENABLED=0 go build -ldflags="-s -w" -o "$REPO_ROOT/eve" "$REPO_ROOT"
echo "✓ Binary built: $(du -sh "$REPO_ROOT/eve" | cut -f1)"

# 5. Install binary
echo "→ Installing binary to $BINARY..."
sudo install -m 755 "$REPO_ROOT/eve" "$BINARY"
echo "✓ Binary installed"

# 6. Create env file if absent
if [ ! -f "$ENV_FILE" ]; then
  echo "→ Creating $ENV_FILE..."
  sudo mkdir -p "$ENV_DIR"
  JWT_SECRET="$(generate_jwt_secret)"
  sudo tee "$ENV_FILE" >/dev/null <<EOF
EVE_BIND=0.0.0.0:8100
EVE_SESSION_TTL=24h
EVE_LOG_LEVEL=info
EVE_MULTIPASS_BINARY=multipass
EVE_JWT_SECRET=$JWT_SECRET
EVE_DB_PATH=$DB_DIR/eve.db
EVE_ACTIVITY_RETENTION=5000
EOF

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
sudo cp "$REPO_ROOT/deploy/eve.service" "$SERVICE_FILE"
sudo systemctl daemon-reload
sudo systemctl enable --now "eve@$CURRENT_USER"
echo "✓ Service enabled and started"

# 9. Show status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Eve is running!"
echo "  Dashboard: http://$(hostname -I | awk '{print $1}'):8100"
echo "  Logs:      journalctl -u eve@$CURRENT_USER -f"
echo "  Config:    $ENV_FILE"
echo "  Default login (first run only): eve / vap0r"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
