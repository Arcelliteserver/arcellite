#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  Arcellite — Health Monitor
#  Checks: disk space, PostgreSQL, Node process, HTTP response
#  Run via cron every 5 minutes:
#    */5 * * * * /path/to/arcellite/scripts/health-monitor.sh
# ─────────────────────────────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-arcellite}"
DB_USER="${DB_USER:-arcellite_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
ARCELLITE_DATA="${ARCELLITE_DATA:-$HOME/arcellite-data}"
ARCELLITE_DATA="${ARCELLITE_DATA/#\~/$HOME}"
APP_PORT="${PORT:-3999}"
DISK_WARN_PCT=80    # warn at 80% disk usage
DISK_CRIT_PCT=90    # critical at 90%

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
ALERTS=()
STATUS="OK"

# ── 1. Disk space check ───────────────────────────────────────────────
DATA_DISK="$(df -h "$ARCELLITE_DATA" 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%')" || DATA_DISK=""
ROOT_DISK="$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')"

if [[ -n "$DATA_DISK" && "$DATA_DISK" -ge "$DISK_CRIT_PCT" ]]; then
  ALERTS+=("CRITICAL: Data disk usage ${DATA_DISK}% — IMMEDIATE ACTION REQUIRED")
  STATUS="CRITICAL"
elif [[ -n "$DATA_DISK" && "$DATA_DISK" -ge "$DISK_WARN_PCT" ]]; then
  ALERTS+=("WARNING: Data disk usage ${DATA_DISK}%")
  [[ "$STATUS" == "OK" ]] && STATUS="WARNING"
fi

if [[ "$ROOT_DISK" -ge "$DISK_CRIT_PCT" ]]; then
  ALERTS+=("CRITICAL: Root disk usage ${ROOT_DISK}%")
  STATUS="CRITICAL"
elif [[ "$ROOT_DISK" -ge "$DISK_WARN_PCT" ]]; then
  ALERTS+=("WARNING: Root disk usage ${ROOT_DISK}%")
  [[ "$STATUS" == "OK" ]] && STATUS="WARNING"
fi

# ── 2. PostgreSQL check ───────────────────────────────────────────────
if PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" --port="$DB_PORT" \
  --username="$DB_USER" --dbname="$DB_NAME" \
  --no-password -c "SELECT 1" -q &>/dev/null; then
  DB_STATUS="OK"
else
  DB_STATUS="DOWN"
  ALERTS+=("CRITICAL: PostgreSQL is not responding on ${DB_HOST}:${DB_PORT}")
  STATUS="CRITICAL"
fi

# ── 3. Node process check ─────────────────────────────────────────────
if pgrep -f "node.*server.*dist.*index" &>/dev/null; then
  PROC_STATUS="OK"
else
  PROC_STATUS="DOWN"
  ALERTS+=("CRITICAL: Arcellite Node process is not running")
  STATUS="CRITICAL"
  # Attempt automatic restart via systemd
  sudo systemctl start arcellite 2>/dev/null && ALERTS+=("INFO: Auto-restarted arcellite service") || true
fi

# ── 4. HTTP health endpoint check ────────────────────────────────────
HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 5 \
  "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null)" || HTTP_CODE="000"

if [[ "$HTTP_CODE" == "200" ]]; then
  HTTP_STATUS="OK"
else
  HTTP_STATUS="DOWN (HTTP $HTTP_CODE)"
  ALERTS+=("WARNING: Health endpoint returned HTTP $HTTP_CODE")
  [[ "$STATUS" == "OK" ]] && STATUS="WARNING"
fi

# ── 5. Backup age check ───────────────────────────────────────────────
BACKUP_DIR="${ARCELLITE_BACKUP_DIR:-$HOME/arcellite-backups}"
LATEST_BACKUP="$(find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d ! -name 'weekly_*' 2>/dev/null | sort | tail -1)"
if [[ -z "$LATEST_BACKUP" ]]; then
  ALERTS+=("WARNING: No backups found in $BACKUP_DIR — run scripts/backup.sh")
  [[ "$STATUS" == "OK" ]] && STATUS="WARNING"
else
  BACKUP_AGE_HOURS=$(( ( $(date +%s) - $(stat -c %Y "$LATEST_BACKUP") ) / 3600 ))
  if [[ "$BACKUP_AGE_HOURS" -gt 26 ]]; then
    ALERTS+=("WARNING: Last backup is ${BACKUP_AGE_HOURS}h old (>26h) — backup may have failed")
    [[ "$STATUS" == "OK" ]] && STATUS="WARNING"
  fi
fi

# ── Output ────────────────────────────────────────────────────────────
echo "[$TIMESTAMP] Arcellite Health Check — $STATUS"
echo "  Disk (data): ${DATA_DISK:-N/A}%  |  Disk (root): ${ROOT_DISK}%"
echo "  PostgreSQL: $DB_STATUS  |  Node process: $PROC_STATUS  |  HTTP: $HTTP_STATUS"

if [[ ${#ALERTS[@]} -gt 0 ]]; then
  echo ""
  echo "  ALERTS:"
  for ALERT in "${ALERTS[@]}"; do
    echo "    ⚠ $ALERT"
  done
fi

# Exit with non-zero on critical/warning so cron email is triggered
[[ "$STATUS" == "OK" ]] && exit 0
[[ "$STATUS" == "WARNING" ]] && exit 1
exit 2
