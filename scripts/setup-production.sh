#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Arcellite — One-Click Production Setup
#
#  Run as the user who will own the service (NOT as root).
#  Sudo is used internally only where root is required.
#
#  Usage:
#    chmod +x scripts/setup-production.sh
#    ./scripts/setup-production.sh
#
#  What it does:
#    1. Checks prerequisites (Node ≥18, npm, PostgreSQL)
#    2. Creates .env if missing
#    3. Installs npm dependencies & builds the app
#    4. Creates the data directory
#    5. Installs + enables the systemd service
#    6. Sets up daily backups via cron
#    7. Sets up hourly health monitoring via cron
#    8. Installs the logrotate configuration
#    9. Creates a ~/bin/arcellite helper script
#   10. Prints a summary
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()     { error "$*"; exit 1; }

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE_USER="${USER}"
SERVICE_NAME="arcellite"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        Arcellite — Production Setup              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
info "App directory : ${APP_DIR}"
info "Service user  : ${SERVICE_USER}"
echo ""

# ── 1. Prerequisites ─────────────────────────────────────────────────────────
info "Checking prerequisites..."

command -v node  >/dev/null 2>&1 || die "Node.js is not installed. Install v18+ first."
command -v npm   >/dev/null 2>&1 || die "npm is not installed."
command -v psql  >/dev/null 2>&1 || die "PostgreSQL client (psql) not found. Install postgresql-client."

NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "${NODE_VER}" -lt 18 ]; then
  die "Node.js v18+ required (found v${NODE_VER})."
fi
ok "Node.js v$(node --version | tr -d 'v'), npm $(npm --version)"

# ── 2. .env setup ─────────────────────────────────────────────────────────────
info "Checking .env..."
if [ ! -f "${APP_DIR}/.env" ]; then
  if [ -f "${APP_DIR}/.env.example" ]; then
    cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
    warn ".env created from .env.example — EDIT IT before starting!"
    warn "  ${APP_DIR}/.env"
    echo ""
    read -rp "Press Enter after you have filled in .env (Ctrl-C to abort)..."
    echo ""
  else
    die ".env not found and no .env.example to copy from."
  fi
else
  ok ".env found"
fi

# Source .env (skip lines with substitution syntax Docker uses)
set -a
# shellcheck disable=SC1091
source <(grep -v '^\s*#' "${APP_DIR}/.env" | grep '=' | grep -v '\${' || true)
set +a

# ── 3. Build ──────────────────────────────────────────────────────────────────
info "Installing npm dependencies..."
cd "${APP_DIR}"
npm ci --prefer-offline 2>&1 | tail -5
ok "Dependencies installed"

info "Building TypeScript server..."
npm run build:server
ok "Server compiled → server/dist/"

info "Building React frontend..."
npm run build
ok "Frontend built → dist/"

# ── 4. Data directory ──────────────────────────────────────────────────────────
DATA_DIR="${ARCELLITE_DATA:-${HOME}/arcellite-data}"
DATA_DIR="${DATA_DIR/#\~/${HOME}}"
info "Creating data directory: ${DATA_DIR}"
mkdir -p "${DATA_DIR}"/{general,media,video_vault}
chmod 750 "${DATA_DIR}"
ok "Data directory ready"

# ── 5. systemd service ─────────────────────────────────────────────────────────
if command -v systemctl >/dev/null 2>&1; then
  info "Installing systemd service..."

  SERVICE_FILE="${SCRIPT_DIR}/arcellite.service"
  if [ ! -f "${SERVICE_FILE}" ]; then
    die "Service file not found: ${SERVICE_FILE}"
  fi

  # Create a concrete unit (substitute paths)
  DEST_SERVICE="/etc/systemd/system/${SERVICE_NAME}.service"

  sudo bash -c "sed \
    -e 's|%APP_DIR%|${APP_DIR}|g' \
    -e 's|%SERVICE_USER%|${SERVICE_USER}|g' \
    -e 's|%HOME%|${HOME}|g' \
    '${SERVICE_FILE}' > '${DEST_SERVICE}'"

  # If service file uses WorkingDirectory with literal path, overwrite with sed result:
  # (Our template already uses static paths from install.sh — just copy if no placeholders)
  if ! grep -q '%APP_DIR%' "${DEST_SERVICE}" 2>/dev/null; then
    sudo cp "${SERVICE_FILE}" "${DEST_SERVICE}"
  fi

  sudo systemctl daemon-reload
  sudo systemctl enable "${SERVICE_NAME}"

  # Start or restart
  if sudo systemctl is-active --quiet "${SERVICE_NAME}"; then
    sudo systemctl restart "${SERVICE_NAME}"
    ok "Service restarted"
  else
    sudo systemctl start "${SERVICE_NAME}"
    ok "Service started"
  fi

  sleep 2
  if sudo systemctl is-active --quiet "${SERVICE_NAME}"; then
    ok "systemd service '${SERVICE_NAME}' is running"
  else
    warn "Service may not be running. Check: sudo journalctl -u ${SERVICE_NAME} -n 50"
  fi
else
  warn "systemd not found — skipping service installation."
  warn "Start manually with: cd ${APP_DIR} && node server/dist/index.js"
fi

# ── 6. Backup cron ────────────────────────────────────────────────────────────
info "Setting up daily backup cron..."
BACKUP_SCRIPT="${SCRIPT_DIR}/backup.sh"
chmod +x "${BACKUP_SCRIPT}"

BACKUP_LOG="${HOME}/.arcellite/logs/backup.log"
mkdir -p "$(dirname "${BACKUP_LOG}")"

# Remove any old arcellite backup cron, add new
(crontab -l 2>/dev/null | grep -v 'arcellite/scripts/backup.sh' || true
 echo "0 2 * * * ${BACKUP_SCRIPT} >> ${BACKUP_LOG} 2>&1") | crontab -

ok "Daily backup scheduled at 02:00 (log: ${BACKUP_LOG})"

# ── 7. Health monitor cron ────────────────────────────────────────────────────
info "Setting up hourly health monitor cron..."
HEALTH_SCRIPT="${SCRIPT_DIR}/health-monitor.sh"
chmod +x "${HEALTH_SCRIPT}"

HEALTH_LOG="${HOME}/.arcellite/logs/health.log"

(crontab -l 2>/dev/null | grep -v 'arcellite/scripts/health-monitor.sh' || true
 echo "*/15 * * * * ${HEALTH_SCRIPT} >> ${HEALTH_LOG} 2>&1") | crontab -

ok "Health monitor scheduled every 15 minutes (log: ${HEALTH_LOG})"

# ── 8. Logrotate ──────────────────────────────────────────────────────────────
LOGROTATE_CONF="${SCRIPT_DIR}/logrotate.conf"
if [ -f "${LOGROTATE_CONF}" ]; then
  if command -v logrotate >/dev/null 2>&1; then
    sudo cp "${LOGROTATE_CONF}" /etc/logrotate.d/arcellite
    ok "Logrotate configuration installed"
  else
    warn "logrotate not found — skipping log rotation setup."
  fi
fi

# ── 9. Helper script ──────────────────────────────────────────────────────────
info "Installing 'arcellite' helper command..."
mkdir -p "${HOME}/bin"
cat > "${HOME}/bin/arcellite" <<HELPER
#!/usr/bin/env bash
# Arcellite management helper
case "\$1" in
  start)   sudo systemctl start arcellite ;;
  stop)    sudo systemctl stop arcellite ;;
  restart) sudo systemctl restart arcellite ;;
  status)  sudo systemctl status arcellite ;;
  logs)    sudo journalctl -u arcellite -f ;;
  backup)  ${BACKUP_SCRIPT} ;;
  health)  ${HEALTH_SCRIPT} ;;
  update)
    cd ${APP_DIR}
    git pull
    npm ci --prefer-offline
    npm run build:server
    npm run build
    sudo systemctl restart arcellite
    ;;
  *)
    echo "Usage: arcellite {start|stop|restart|status|logs|backup|health|update}"
    ;;
esac
HELPER
chmod +x "${HOME}/bin/arcellite"

# Add ~/bin to PATH if not already there
if [[ ":${PATH}:" != *":${HOME}/bin:"* ]]; then
  echo 'export PATH="$HOME/bin:$PATH"' >> "${HOME}/.bashrc"
  warn "Added ~/bin to PATH in .bashrc — run: source ~/.bashrc"
fi
ok "Helper installed — usage: arcellite {start|stop|restart|status|logs|backup|health|update}"

# ── 10. Summary ───────────────────────────────────────────────────────────────
APP_PORT="${PORT:-3999}"
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           Setup Complete!                        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}App URL${NC}       : http://localhost:${APP_PORT}"
echo -e "  ${GREEN}Health check${NC}  : http://localhost:${APP_PORT}/api/health"
echo -e "  ${GREEN}Data dir${NC}      : ${DATA_DIR}"
echo -e "  ${GREEN}Logs${NC}          : sudo journalctl -u ${SERVICE_NAME} -f"
echo -e "  ${GREEN}Backup logs${NC}   : ${BACKUP_LOG}"
echo -e "  ${GREEN}Health logs${NC}   : ${HEALTH_LOG}"
echo ""
echo -e "  ${YELLOW}Quick commands:${NC}"
echo -e "    arcellite status   — service status"
echo -e "    arcellite logs     — follow live logs"
echo -e "    arcellite backup   — run backup now"
echo -e "    arcellite update   — pull + rebuild + restart"
echo ""
