#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  Arcellite — Automated Backup Script
#  Backs up: PostgreSQL database + all user files
#
#  Usage:   ./scripts/backup.sh
#  Cron:    0 2 * * * /path/to/arcellite/scripts/backup.sh >> ~/.arcellite/logs/backup.log 2>&1
#
#  Environment: reads .env from project root automatically
#  Retention:   keeps last 7 daily backups + last 4 weekly backups
# ─────────────────────────────────────────────────────────────────────
set -eo pipefail

# ── Ensure postgresql client tools are on PATH ────────────────────────
for _pgbin in \
  /usr/lib/postgresql/16/bin \
  /usr/lib/postgresql/15/bin \
  /usr/lib/postgresql/14/bin \
  /usr/lib/postgresql/13/bin \
  /usr/local/bin \
  /usr/bin; do
  if [[ -x "$_pgbin/pg_dump" ]]; then
    export PATH="$_pgbin:$PATH"
    break
  fi
done

# ── Load environment ──────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$PROJECT_DIR/.env" ]]; then
  # Parse .env safely — avoids eval/source issues with special chars (<, >, &, etc.)
  while IFS='=' read -r key value || [[ -n "$key" ]]; do
    # Skip blank lines and comments
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
    # Strip surrounding whitespace from key
    key="${key// /}"
    key="${key//	/}"  # strip tabs
    # Only export simple identifier keys to avoid injection
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # Strip surrounding quotes from value if present
    value="${value%"${value##*[! ]}"}"  # rtrim
    value="${value#"${value%%[! ]*}"}"  # ltrim
    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done < "$PROJECT_DIR/.env"
fi

# ── Configuration ─────────────────────────────────────────────────────
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-arcellite}"
DB_USER="${DB_USER:-arcellite_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
ARCELLITE_DATA="${ARCELLITE_DATA:-$HOME/arcellite-data}"
ARCELLITE_DATA="${ARCELLITE_DATA/#\~/$HOME}"  # expand ~

BACKUP_DIR="${ARCELLITE_BACKUP_DIR:-$HOME/arcellite-backups}"
BACKUP_DIR="${BACKUP_DIR/#\~/$HOME}"
DAILY_RETENTION=7   # days
WEEKLY_RETENTION=4  # weeks

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FINAL_PATH="$BACKUP_DIR/$TIMESTAMP"
TMP_PATH="$BACKUP_DIR/.tmp_$TIMESTAMP"  # work in temp dir; move on success
LOG_PREFIX="[Arcellite Backup $(date '+%Y-%m-%d %H:%M:%S')]"

# ── Helpers ───────────────────────────────────────────────────────────
info()    { echo "$LOG_PREFIX INFO:  $*"; }
success() { echo "$LOG_PREFIX OK:    $*"; }
warn()    { echo "$LOG_PREFIX WARN:  $*"; }
fail()    {
  echo "$LOG_PREFIX ERROR: $*"
  # Clean up the temp dir on failure so we don't leave empty backups
  rm -rf "$TMP_PATH" 2>/dev/null || true
  exit 1
}

# ── Pre-flight checks ─────────────────────────────────────────────────
info "Starting backup → $FINAL_PATH"

# Ensure backup dir exists
mkdir -p "$BACKUP_DIR" || fail "Cannot create backup directory: $BACKUP_DIR"

# Work in temp dir; atomically rename to final path only on full success
mkdir -p "$TMP_PATH" || fail "Cannot create temp backup directory"

# Check pg_dump is available
if ! command -v pg_dump &>/dev/null; then
  fail "pg_dump not found — install postgresql-client"
fi
info "Using pg_dump: $(command -v pg_dump) ($(pg_dump --version | head -1))"

# Check disk space: warn if < 1 GB free
AVAIL_KB="$(df -k "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
if [[ "${AVAIL_KB:-0}" -lt 1048576 ]]; then
  warn "Less than 1 GB free in backup directory ($((${AVAIL_KB:-0} / 1024)) MB available)"
fi

# ── 1. PostgreSQL — main database ─────────────────────────────────────
info "Backing up PostgreSQL database '$DB_NAME'..."
DB_DUMP="$TMP_PATH/postgres_${DB_NAME}_${TIMESTAMP}.sql.gz"

# Use plain format piped through gzip — clean, easy to restore with:
#   gunzip -c file.sql.gz | psql -h HOST -U USER -d DBNAME
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --no-password \
  --format=plain \
  "$DB_NAME" \
  | gzip -9 > "$DB_DUMP" \
  || fail "pg_dump failed for '$DB_NAME' — check DB credentials in .env"

success "Database backup: $(basename "$DB_DUMP") ($(du -sh "$DB_DUMP" | cut -f1))"

# ── 2. Verify database dump integrity ─────────────────────────────────
info "Verifying database backup integrity..."
if gzip -t "$DB_DUMP" 2>/dev/null; then
  success "Database backup integrity: OK"
else
  fail "Database backup integrity check failed — backup may be corrupt"
fi

# ── 3. Chat history database (optional) ──────────────────────────────
CHAT_DB="arcellite_chat_history"
CHAT_DUMP="$TMP_PATH/postgres_${CHAT_DB}_${TIMESTAMP}.sql.gz"
CHAT_BACKED_UP=false

if PGPASSWORD="$DB_PASSWORD" psql \
    --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
    --no-password -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$CHAT_DB"; then
  info "Backing up chat history database '$CHAT_DB'..."
  PGPASSWORD="$DB_PASSWORD" pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --no-password \
    --format=plain \
    "$CHAT_DB" \
    | gzip -9 > "$CHAT_DUMP" \
    && CHAT_BACKED_UP=true \
    || warn "Chat history DB backup failed"
  if $CHAT_BACKED_UP; then
    success "Chat history backup: $(basename "$CHAT_DUMP") ($(du -sh "$CHAT_DUMP" | cut -f1))"
  fi
else
  info "Chat history DB '$CHAT_DB' not found — skipping"
fi

# ── 4. User files ──────────────────────────────────────────────────────
info "Backing up user files from '$ARCELLITE_DATA'..."
FILES_ARCHIVE="$TMP_PATH/files_${TIMESTAMP}.tar.gz"

if [[ -d "$ARCELLITE_DATA" ]]; then
  tar -czf "$FILES_ARCHIVE" \
    --exclude="*.tmp" \
    --exclude="*/.DS_Store" \
    --exclude="*/Thumbs.db" \
    -C "$(dirname "$ARCELLITE_DATA")" \
    "$(basename "$ARCELLITE_DATA")" \
    || fail "File archive failed for '$ARCELLITE_DATA'"
  success "Files backup: $(basename "$FILES_ARCHIVE") ($(du -sh "$FILES_ARCHIVE" | cut -f1))"
else
  warn "Data directory '$ARCELLITE_DATA' not found — skipping file backup"
fi

# ── 5. Write manifest ─────────────────────────────────────────────────
CHAT_FILE=""
if $CHAT_BACKED_UP; then CHAT_FILE="$(basename "$CHAT_DUMP")"; fi
FILES_FILE=""
if [[ -f "$FILES_ARCHIVE" ]]; then FILES_FILE="$(basename "$FILES_ARCHIVE")"; fi

cat > "$TMP_PATH/manifest.json" <<EOF
{
  "version": 1,
  "timestamp": "$TIMESTAMP",
  "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "db_name": "$DB_NAME",
  "db_host": "$DB_HOST",
  "data_dir": "$ARCELLITE_DATA",
  "files": ["$(basename "$DB_DUMP")"${CHAT_FILE:+, "\"$CHAT_FILE\""}${FILES_FILE:+, "\"$FILES_FILE\""}]
}
EOF

# ── 6. Atomically finalize ────────────────────────────────────────────
mv "$TMP_PATH" "$FINAL_PATH" || fail "Failed to finalize backup directory"
success "Backup finalized → $FINAL_PATH"

# ── 7. Rotation — keep last N daily backups ───────────────────────────
info "Rotating old backups (keeping last $DAILY_RETENTION days)..."
find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d \
  -mtime "+$DAILY_RETENTION" \
  ! -name "weekly_*" \
  -exec rm -rf {} \; 2>/dev/null || true

# ── 8. Weekly snapshot (every Sunday) ────────────────────────────────
DOW="$(date +%u)"  # 7 = Sunday
if [[ "$DOW" == "7" ]]; then
  WEEKLY_PATH="$BACKUP_DIR/weekly_$(date +%Y_W%V)"
  if [[ ! -d "$WEEKLY_PATH" ]]; then
    cp -r "$FINAL_PATH" "$WEEKLY_PATH"
    success "Weekly snapshot saved: $WEEKLY_PATH"
  fi
  find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d \
    -name "weekly_*" \
    -mtime "+$((WEEKLY_RETENTION * 7))" \
    -exec rm -rf {} \; 2>/dev/null || true
fi

# ── Summary ───────────────────────────────────────────────────────────
TOTAL_SIZE="$(du -sh "$FINAL_PATH" | cut -f1)"
success "Backup complete → $FINAL_PATH ($TOTAL_SIZE total)"
info "Backups stored in $BACKUP_DIR:"
ls -1 "$BACKUP_DIR/" | tail -15
