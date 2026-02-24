#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  Arcellite — Restore Script
#  Restores PostgreSQL database + user files from a backup directory
#
#  Usage:   ./scripts/restore.sh /path/to/backup/20250101_020000
#           ./scripts/restore.sh --latest
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

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
BACKUP_DIR="${ARCELLITE_BACKUP_DIR:-$HOME/arcellite-backups}"

info()    { echo "[Arcellite Restore] INFO:  $*"; }
success() { echo "[Arcellite Restore] OK:    $*"; }
fail()    { echo "[Arcellite Restore] ERROR: $*"; exit 1; }

# ── Determine backup to restore ───────────────────────────────────────
if [[ "${1:-}" == "--latest" ]]; then
  RESTORE_FROM="$(find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d ! -name 'weekly_*' | sort | tail -1)"
  [[ -z "$RESTORE_FROM" ]] && fail "No backups found in $BACKUP_DIR"
  info "Restoring from latest backup: $RESTORE_FROM"
elif [[ -n "${1:-}" ]]; then
  RESTORE_FROM="$1"
  [[ -d "$RESTORE_FROM" ]] || fail "Backup directory not found: $RESTORE_FROM"
else
  echo "Usage: $0 <backup-dir> | --latest"
  echo "Example: $0 $BACKUP_DIR/20250101_020000"
  exit 1
fi

# ── Safety confirmation ───────────────────────────────────────────────
echo ""
echo "  ⚠  WARNING: This will OVERWRITE your current database and files."
echo "  Backup: $RESTORE_FROM"
echo ""
read -r -p "  Type 'RESTORE' to confirm: " CONFIRM
[[ "$CONFIRM" == "RESTORE" ]] || fail "Aborted by user"

# ── 1. Stop Arcellite service ─────────────────────────────────────────
info "Stopping Arcellite service..."
sudo systemctl stop arcellite 2>/dev/null || true

# ── 2. Restore PostgreSQL database ───────────────────────────────────
DB_DUMP="$(find "$RESTORE_FROM" -name "postgres_${DB_NAME}_*.sql.gz" | head -1)"
if [[ -n "$DB_DUMP" ]]; then
  info "Restoring database from: $(basename "$DB_DUMP")"
  # Drop and recreate the database
  PGPASSWORD="$DB_PASSWORD" psql \
    --host="$DB_HOST" --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="postgres" \
    -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" 2>/dev/null || true
  PGPASSWORD="$DB_PASSWORD" psql \
    --host="$DB_HOST" --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="postgres" \
    -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";" || true
  # Restore
  gunzip -c "$DB_DUMP" | PGPASSWORD="$DB_PASSWORD" pg_restore \
    --host="$DB_HOST" --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --no-password \
    --clean --if-exists \
    || warn "pg_restore reported warnings (may be non-fatal)"
  success "Database restored"
else
  warn "No database dump found in $RESTORE_FROM — skipping DB restore"
fi

# ── 3. Restore user files ─────────────────────────────────────────────
FILES_ARCHIVE="$(find "$RESTORE_FROM" -name "files_*.tar.gz" | head -1)"
if [[ -n "$FILES_ARCHIVE" ]]; then
  info "Restoring files from: $(basename "$FILES_ARCHIVE")"
  DATA_PARENT="$(dirname "$ARCELLITE_DATA")"
  DATA_NAME="$(basename "$ARCELLITE_DATA")"
  # Move current data to a .bak
  if [[ -d "$ARCELLITE_DATA" ]]; then
    mv "$ARCELLITE_DATA" "${ARCELLITE_DATA}.bak.$(date +%s)"
    info "Existing data moved to ${ARCELLITE_DATA}.bak.*"
  fi
  tar -xzf "$FILES_ARCHIVE" -C "$DATA_PARENT"
  # Rename if tar root differs
  if [[ ! -d "$ARCELLITE_DATA" ]]; then
    EXTRACTED="$(tar -tzf "$FILES_ARCHIVE" | head -1 | cut -d/ -f1)"
    mv "$DATA_PARENT/$EXTRACTED" "$ARCELLITE_DATA" 2>/dev/null || true
  fi
  success "Files restored to $ARCELLITE_DATA"
else
  warn "No file archive found in $RESTORE_FROM — skipping file restore"
fi

# ── 4. Restart service ────────────────────────────────────────────────
info "Restarting Arcellite service..."
sudo systemctl start arcellite 2>/dev/null || warn "Could not start arcellite service — start manually"

success "Restore complete from $RESTORE_FROM"
