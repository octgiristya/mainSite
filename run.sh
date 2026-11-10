#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
#  OGI // octgiristya — website service runner
#
#  ./run.sh              setup (first time) + run in foreground
#  ./run.sh setup        create venv & install dependencies only
#  ./run.sh dev          run with auto-reload (for editing)
#  ./run.sh service      install & start as systemd service (needs sudo)
#  ./run.sh restart      restart the systemd service
#  ./run.sh status       show service status
#  ./run.sh logs         follow service logs
#  ./run.sh uninstall    stop & remove the systemd service
#
#  Env overrides:  HOST=127.0.0.1  PORT=8000  WORKERS=2
# ───────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$APP_DIR/.venv"
HOST="${HOST:-127.0.0.1}"     # keep on localhost; expose via Caddy/Nginx with HTTPS
PORT="${PORT:-9898}"
WORKERS="${WORKERS:-2}"
SERVICE="octgiristya-web"
PY="${PYTHON:-python3}"

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
info() { printf '\033[90m[ogi]\033[0m %s\n' "$*"; }

setup() {
  command -v "$PY" >/dev/null || { red "python3 not found. Install Python 3.10+ first."; exit 1; }
  if [ ! -d "$VENV" ]; then
    info "creating virtualenv at $VENV"
    "$PY" -m venv "$VENV"
  fi
  info "installing dependencies"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r "$APP_DIR/requirements.txt"
  info "setup done"
}

run() {
  [ -x "$VENV/bin/uvicorn" ] || setup
  info "serving on http://$HOST:$PORT  (workers: $WORKERS)"
  cd "$APP_DIR/app"
  exec "$VENV/bin/uvicorn" main:app \
    --host "$HOST" --port "$PORT" --workers "$WORKERS" \
    --proxy-headers --forwarded-allow-ips="127.0.0.1" \
    --no-server-header --no-date-header --log-level info
}

dev() {
  [ -x "$VENV/bin/uvicorn" ] || setup
  cd "$APP_DIR/app"
  APP_DEBUG=1 exec "$VENV/bin/uvicorn" main:app --host "$HOST" --port "$PORT" --reload
}

service_install() {
  setup
  local user; user="$(id -un)"
  info "installing systemd unit /etc/systemd/system/$SERVICE.service (runs as $user)"
  sudo tee "/etc/systemd/system/$SERVICE.service" >/dev/null <<UNIT
[Unit]
Description=OGI // octgiristya website
After=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$APP_DIR
Environment=HOST=$HOST PORT=$PORT WORKERS=$WORKERS
ExecStart=$APP_DIR/run.sh
Restart=always
RestartSec=3
# hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$APP_DIR
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
UNIT
  sudo systemctl daemon-reload
  sudo systemctl enable --now "$SERVICE"
  sleep 1
  sudo systemctl --no-pager status "$SERVICE" | head -n 12
  info "health check: $(curl -fsS "http://$HOST:$PORT/healthz" || echo 'not responding yet')"
}

case "${1:-run}" in
  run)       run ;;
  setup)     setup ;;
  dev)       dev ;;
  service)   service_install ;;
  restart)   sudo systemctl restart "$SERVICE" && info "restarted" ;;
  status)    sudo systemctl --no-pager status "$SERVICE" ;;
  logs)      sudo journalctl -u "$SERVICE" -f ;;
  uninstall) sudo systemctl disable --now "$SERVICE" || true
             sudo rm -f "/etc/systemd/system/$SERVICE.service"
             sudo systemctl daemon-reload; info "service removed" ;;
  *)         red "unknown command: $1"; sed -n '3,14p' "$0"; exit 1 ;;
esac
