#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  Arcellite — Automated Installer
#  Sets up Node.js, PostgreSQL, MySQL/MariaDB, SQLite, data
#  directories, .env, and builds the application so it's ready to run.
#
#  Usage:   chmod +x install.sh && ./install.sh
#  Tested:  Ubuntu 22.04/24.04, Debian 12, Raspberry Pi OS (64-bit)
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[  OK]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()    { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }
step()    { echo -e "\n${BOLD}── $* ──${NC}"; }

# ── Must run from the project directory ──────────────────────────────
if [[ ! -f "package.json" ]] || ! grep -q '"arcellite"' package.json 2>/dev/null; then
  fail "Run this script from the Arcellite project root (where package.json is)."
fi

PROJECT_DIR="$(pwd)"


# ═════════════════════════════════════════════════════════════════════
#  STEP 1 — System dependencies
# ═════════════════════════════════════════════════════════════════════
step "1/9  Checking system dependencies"

# Detect package manager
if command -v apt-get &>/dev/null; then
  PKG_MGR="apt"
elif command -v dnf &>/dev/null; then
  PKG_MGR="dnf"
elif command -v pacman &>/dev/null; then
  PKG_MGR="pacman"
else
  warn "Could not detect package manager. Install Node.js ≥18 and PostgreSQL ≥14 manually."
  PKG_MGR="unknown"
fi

install_pkg() {
  local pkg="$1"
  if [[ "$PKG_MGR" == "apt" ]]; then
    sudo apt-get install -y "$pkg" >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "dnf" ]]; then
    sudo dnf install -y "$pkg" >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "pacman" ]]; then
    sudo pacman -S --noconfirm "$pkg" >/dev/null 2>&1
  fi
}

# ── Node.js ──────────────────────────────────────────────────────────
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if (( NODE_MAJOR >= 18 )); then
    success "Node.js v${NODE_VER} detected"
  else
    warn "Node.js v${NODE_VER} is too old (need ≥18)"
    info "Installing Node.js 20 via NodeSource..."
    if [[ "$PKG_MGR" == "apt" ]]; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
      sudo apt-get install -y nodejs >/dev/null 2>&1
    elif [[ "$PKG_MGR" == "dnf" ]]; then
      curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
      sudo dnf install -y nodejs >/dev/null 2>&1
    elif [[ "$PKG_MGR" == "pacman" ]]; then
      sudo pacman -S --noconfirm nodejs npm >/dev/null 2>&1
    fi
    success "Node.js $(node -v) installed"
  fi
else
  info "Node.js not found — installing Node.js 20..."
  if [[ "$PKG_MGR" == "apt" ]]; then
    sudo apt-get update -qq >/dev/null 2>&1
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
    sudo apt-get install -y nodejs >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "dnf" ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
    sudo dnf install -y nodejs >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "pacman" ]]; then
    sudo pacman -S --noconfirm nodejs npm >/dev/null 2>&1
  else
    fail "Install Node.js ≥18 manually: https://nodejs.org"
  fi
  success "Node.js $(node -v) installed"
fi

# ── npm ──────────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  fail "npm not found. Install it with your system package manager."
fi
success "npm $(npm -v) detected"

# ── Build tools (needed to compile native modules like bcrypt) ───────
if [[ "$PKG_MGR" == "apt" ]]; then
  if ! dpkg -s build-essential &>/dev/null 2>&1; then
    info "Installing build tools (build-essential, python3)..."
    sudo apt-get install -y build-essential python3 >/dev/null 2>&1
    success "Build tools installed"
  else
    success "Build tools available"
  fi
elif [[ "$PKG_MGR" == "dnf" ]]; then
  if ! rpm -q gcc-c++ &>/dev/null 2>&1; then
    sudo dnf groupinstall -y "Development Tools" >/dev/null 2>&1
    success "Build tools installed"
  else
    success "Build tools available"
  fi
elif [[ "$PKG_MGR" == "pacman" ]]; then
  sudo pacman -S --noconfirm --needed base-devel >/dev/null 2>&1
  success "Build tools available"
fi


# ── Storage: Auto-expand LVM if unused space exists ──
if command -v vgs &>/dev/null && command -v lvextend &>/dev/null; then
  # Check if any volume group has free space (> 1GB)
  VG_FREE=$(sudo vgs --noheadings --nosuffix --units g -o vg_free 2>/dev/null | head -1 | tr -d ' ')
  VG_FREE_INT=${VG_FREE%%.*}  # truncate to integer
  if [[ -n "$VG_FREE_INT" ]] && [[ "$VG_FREE_INT" -gt 1 ]] 2>/dev/null; then
    # Find the root LV
    ROOT_LV=$(df / --output=source | tail -1)
    if [[ "$ROOT_LV" == /dev/mapper/* ]] || [[ "$ROOT_LV" == /dev/dm-* ]]; then
      echo "  Detected ~${VG_FREE_INT}GB unused disk space in LVM volume group."
      read -rp "  Expand root filesystem to use all available space? [Y/n]: " expand_lvm
      expand_lvm="${expand_lvm:-Y}"
      if [[ "$expand_lvm" =~ ^[Yy] ]]; then
        sudo lvextend -l +100%FREE "$ROOT_LV" >/dev/null 2>&1
        sudo resize2fs "$ROOT_LV" >/dev/null 2>&1 || sudo xfs_growfs / >/dev/null 2>&1
        NEW_SIZE=$(df -h / --output=size | tail -1 | tr -d ' ')
        success "Root filesystem expanded to ${NEW_SIZE}"
      else
        warn "Skipped LVM expansion (~${VG_FREE_INT}GB unused)"
      fi
    fi
  else
    success "Disk fully allocated"
  fi
else
  # No LVM — standard partition, nothing to do
  :
fi


# ═════════════════════════════════════════════════════════════════════
#  STEP 2 — PostgreSQL
# ═════════════════════════════════════════════════════════════════════
step "2/9  Setting up PostgreSQL"

if command -v psql &>/dev/null; then
  PG_VER=$(psql --version | grep -oP '\d+' | head -1)
  success "PostgreSQL ${PG_VER} detected"
else
  info "PostgreSQL not found — installing..."
  if [[ "$PKG_MGR" == "apt" ]]; then
    sudo apt-get update -qq >/dev/null 2>&1
    sudo apt-get install -y postgresql postgresql-contrib >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "dnf" ]]; then
    sudo dnf install -y postgresql-server postgresql-contrib >/dev/null 2>&1
    sudo postgresql-setup --initdb 2>/dev/null || true
  elif [[ "$PKG_MGR" == "pacman" ]]; then
    sudo pacman -S --noconfirm postgresql >/dev/null 2>&1
    sudo -u postgres initdb -D /var/lib/postgres/data 2>/dev/null || true
  else
    fail "Install PostgreSQL ≥14 manually."
  fi
  success "PostgreSQL installed"
fi

# Ensure PostgreSQL service is running
if systemctl is-active --quiet postgresql 2>/dev/null; then
  success "PostgreSQL service is running"
else
  info "Starting PostgreSQL service..."
  sudo systemctl enable postgresql >/dev/null 2>&1 || true
  sudo systemctl start postgresql >/dev/null 2>&1 || true
  sleep 3
  if systemctl is-active --quiet postgresql 2>/dev/null; then
    success "PostgreSQL service started"
  else
    # Try starting individual clusters (Ubuntu/Debian can have multiple)
    for cluster_dir in /etc/postgresql/*/main; do
      if [[ -d "$cluster_dir" ]]; then
        PG_CLUSTER_VER=$(echo "$cluster_dir" | grep -oP '\d+')
        info "Trying to start PostgreSQL cluster version ${PG_CLUSTER_VER}..."
        sudo pg_ctlcluster "$PG_CLUSTER_VER" main start 2>/dev/null || true
      fi
    done
    sleep 2
    if systemctl is-active --quiet postgresql 2>/dev/null; then
      success "PostgreSQL service started"
    else
      warn "Could not start PostgreSQL via systemd. It may be managed differently on your system."
    fi
  fi
fi

# Detect PostgreSQL port — try common ports and multiple methods
PG_PORT=""
for port in 5432 5433 5434; do
  if sudo -u postgres psql -p "$port" -c "SELECT 1" &>/dev/null 2>&1; then
    PG_PORT=$port
    break
  fi
done

# If we couldn't connect via peer auth, try checking listening ports
if [[ -z "$PG_PORT" ]]; then
  for port in 5432 5433 5434; do
    if ss -tlnp 2>/dev/null | grep -q ":${port}\b" || netstat -tlnp 2>/dev/null | grep -q ":${port}\b"; then
      PG_PORT=$port
      break
    fi
  done
fi

if [[ -z "$PG_PORT" ]]; then
  PG_PORT=5432
  warn "Could not auto-detect PostgreSQL port, defaulting to ${PG_PORT}"
else
  success "PostgreSQL is listening on port ${PG_PORT}"
fi

# ── Generate secure credentials ──────────────────────────────────────
DB_NAME="arcellite"
DB_USER="arcellite_user"
DB_PASSWORD=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n' | head -c 32)

# ── Create database user and database ────────────────────────────────
info "Creating database user '${DB_USER}'..."
sudo -u postgres psql -p "$PG_PORT" -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1 && {
  # User exists — update password
  sudo -u postgres psql -p "$PG_PORT" -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}' CREATEDB;" >/dev/null 2>&1
  success "Database user '${DB_USER}' updated"
} || {
  # Create user
  sudo -u postgres psql -p "$PG_PORT" -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}' CREATEDB;" >/dev/null 2>&1
  success "Database user '${DB_USER}' created"
}

info "Creating database '${DB_NAME}'..."
if sudo -u postgres psql -p "$PG_PORT" -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1; then
  success "Database '${DB_NAME}' already exists"
else
  sudo -u postgres psql -p "$PG_PORT" -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null 2>&1
  success "Database '${DB_NAME}' created"
fi

# Grant privileges
sudo -u postgres psql -p "$PG_PORT" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null 2>&1

# Ensure password auth works (pg_hba.conf) — configure for BOTH local and TCP
PG_HBA=$(sudo -u postgres psql -p "$PG_PORT" -t -c "SHOW hba_file" 2>/dev/null | xargs)
if [[ -n "$PG_HBA" ]] && [[ -f "$PG_HBA" ]]; then
  HBA_CHANGED=false

  # 1. Add TCP (host) entry for 127.0.0.1 with md5/scram auth
  if ! sudo grep -qE "^host\s+all\s+${DB_USER}\s+127\.0\.0\.1" "$PG_HBA" 2>/dev/null; then
    info "Adding TCP auth entry for ${DB_USER} in pg_hba.conf..."
    # Add before any existing host entries, or at the end of the file
    if sudo grep -qE "^host\s" "$PG_HBA" 2>/dev/null; then
      # Insert before first host line
      sudo sed -i "0,/^host\s/s//host    all    ${DB_USER}    127.0.0.1\/32    md5\n&/" "$PG_HBA" 2>/dev/null || true
    else
      # Append to end
      echo "host    all    ${DB_USER}    127.0.0.1/32    md5" | sudo tee -a "$PG_HBA" >/dev/null 2>&1
    fi
    HBA_CHANGED=true
  fi

  # 2. Add TCP (host) entry for ::1 (IPv6 localhost) with md5 auth
  if ! sudo grep -qE "^host\s+all\s+${DB_USER}\s+::1" "$PG_HBA" 2>/dev/null; then
    if sudo grep -qE "^host\s" "$PG_HBA" 2>/dev/null; then
      sudo sed -i "0,/^host\s/s//host    all    ${DB_USER}    ::1\/128    md5\n&/" "$PG_HBA" 2>/dev/null || true
    else
      echo "host    all    ${DB_USER}    ::1/128    md5" | sudo tee -a "$PG_HBA" >/dev/null 2>&1
    fi
    HBA_CHANGED=true
  fi

  # 3. Add local (Unix socket) entry with md5 auth
  if ! sudo grep -qE "^local\s+all\s+${DB_USER}\s+md5" "$PG_HBA" 2>/dev/null; then
    if sudo grep -qE "^local\s+all\s+all\s+peer" "$PG_HBA" 2>/dev/null; then
      sudo sed -i "/^local\s\+all\s\+all\s\+peer/i local   all   ${DB_USER}   md5" "$PG_HBA" 2>/dev/null || true
    else
      echo "local   all   ${DB_USER}   md5" | sudo tee -a "$PG_HBA" >/dev/null 2>&1
    fi
    HBA_CHANGED=true
  fi

  if [[ "$HBA_CHANGED" == true ]]; then
    info "Reloading PostgreSQL configuration..."
    sudo systemctl reload postgresql >/dev/null 2>&1 || \
      sudo -u postgres pg_ctl reload -D "$(sudo -u postgres psql -p "$PG_PORT" -t -c "SHOW data_directory" 2>/dev/null | xargs)" 2>/dev/null || true
    sleep 2
    success "PostgreSQL auth configured for password login (TCP + socket)"
  else
    success "PostgreSQL auth already configured"
  fi
else
  warn "Could not locate pg_hba.conf — you may need to configure auth manually"
fi

# Also ensure PostgreSQL is listening on 127.0.0.1 (not just Unix socket)
PG_CONF=$(sudo -u postgres psql -p "$PG_PORT" -t -c "SHOW config_file" 2>/dev/null | xargs)
if [[ -n "$PG_CONF" ]] && [[ -f "$PG_CONF" ]]; then
  LISTEN_ADDR=$(sudo -u postgres psql -p "$PG_PORT" -t -c "SHOW listen_addresses" 2>/dev/null | xargs)
  if [[ "$LISTEN_ADDR" == "" ]] || [[ "$LISTEN_ADDR" == "''" ]]; then
    info "Enabling TCP listening on localhost..."
    sudo sed -i "s/^#\?\s*listen_addresses\s*=.*/listen_addresses = 'localhost'/" "$PG_CONF" 2>/dev/null || true
    sudo systemctl restart postgresql >/dev/null 2>&1 || true
    sleep 3
    success "PostgreSQL now listening on localhost"
  fi
fi

# Verify connection — prefer TCP (127.0.0.1) which works everywhere
DB_HOST="127.0.0.1"
if PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -p "$PG_PORT" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
  success "Database connection verified (TCP 127.0.0.1:${PG_PORT})"
  DB_HOST="127.0.0.1"
elif PGPASSWORD="${DB_PASSWORD}" psql -h localhost -p "$PG_PORT" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
  success "Database connection verified (TCP localhost:${PG_PORT})"
  DB_HOST="localhost"
elif PGPASSWORD="${DB_PASSWORD}" psql -h /var/run/postgresql -p "$PG_PORT" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
  success "Database connection verified (Unix socket /var/run/postgresql)"
  DB_HOST="/var/run/postgresql"
elif PGPASSWORD="${DB_PASSWORD}" psql -h /tmp -p "$PG_PORT" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
  success "Database connection verified (Unix socket /tmp)"
  DB_HOST="/tmp"
else
  warn "Could not verify database connection automatically."
  warn "Troubleshooting:"
  warn "  1. Check PostgreSQL is running: sudo systemctl status postgresql"
  warn "  2. Check port: sudo -u postgres psql -c 'SHOW port'"
  warn "  3. Check pg_hba.conf: sudo -u postgres psql -c 'SHOW hba_file'"
  warn "  4. Ensure 'host all ${DB_USER} 127.0.0.1/32 md5' is in pg_hba.conf"
  warn "  5. Reload: sudo systemctl reload postgresql"
  DB_HOST="127.0.0.1"
fi


# ═════════════════════════════════════════════════════════════════════
#  STEP 3 — MySQL / MariaDB
# ═════════════════════════════════════════════════════════════════════
step "3/9  Setting up MySQL / MariaDB"

# MySQL credentials (generated once)
MYSQL_USER="arcellite_user"
MYSQL_PASSWORD=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n' | head -c 32)
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n' | head -c 32)
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3306"

if command -v mysql &>/dev/null; then
  MYSQL_VER=$(mysql --version 2>/dev/null | grep -oP '\d+\.\d+' | head -1)
  success "MySQL/MariaDB ${MYSQL_VER} detected"
else
  info "MySQL/MariaDB not found — installing MariaDB..."
  if [[ "$PKG_MGR" == "apt" ]]; then
    sudo apt-get update -qq >/dev/null 2>&1
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mariadb-server mariadb-client >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "dnf" ]]; then
    sudo dnf install -y mariadb-server mariadb >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "pacman" ]]; then
    sudo pacman -S --noconfirm mariadb >/dev/null 2>&1
    sudo mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql 2>/dev/null || true
  else
    warn "Install MySQL or MariaDB manually."
  fi
  success "MariaDB installed"
fi

# Ensure MySQL/MariaDB service is running
for svc in mariadb mysql mysqld; do
  if systemctl list-unit-files "${svc}.service" &>/dev/null 2>&1; then
    MYSQL_SERVICE="$svc"
    break
  fi
done
MYSQL_SERVICE=${MYSQL_SERVICE:-mariadb}

if systemctl is-active --quiet "$MYSQL_SERVICE" 2>/dev/null; then
  success "${MYSQL_SERVICE} service is running"
else
  info "Starting ${MYSQL_SERVICE} service..."
  sudo systemctl enable "$MYSQL_SERVICE" >/dev/null 2>&1 || true
  sudo systemctl start "$MYSQL_SERVICE" >/dev/null 2>&1 || true
  sleep 3
  if systemctl is-active --quiet "$MYSQL_SERVICE" 2>/dev/null; then
    success "${MYSQL_SERVICE} service started"
  else
    warn "Could not start MySQL/MariaDB. You may need to start it manually."
  fi
fi

# Create MySQL user and set root password
info "Configuring MySQL user '${MYSQL_USER}'..."

# Try root access via sudo (default MariaDB unix_socket auth)
if sudo mysql -e "SELECT 1" &>/dev/null 2>&1; then
  # Set root password for TCP access
  sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}';" 2>/dev/null || \
  sudo mysql -e "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('${MYSQL_ROOT_PASSWORD}');" 2>/dev/null || true

  # Create application user
  sudo mysql -e "CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD}';" 2>/dev/null || true
  sudo mysql -e "CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'127.0.0.1' IDENTIFIED BY '${MYSQL_PASSWORD}';" 2>/dev/null || true
  sudo mysql -e "GRANT ALL PRIVILEGES ON \`cloudnest\_%\`.* TO '${MYSQL_USER}'@'localhost';" 2>/dev/null || true
  sudo mysql -e "GRANT ALL PRIVILEGES ON \`cloudnest\_%\`.* TO '${MYSQL_USER}'@'127.0.0.1';" 2>/dev/null || true
  sudo mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
  success "MySQL user '${MYSQL_USER}' configured"
else
  warn "Could not access MySQL as root. You may need to configure the MySQL user manually:"
  warn "  CREATE USER '${MYSQL_USER}'@'localhost' IDENTIFIED BY '<password>';"
  warn "  GRANT ALL PRIVILEGES ON \`cloudnest_%\`.* TO '${MYSQL_USER}'@'localhost';"
fi

# Verify MySQL connection
if mysql -h 127.0.0.1 -P "$MYSQL_PORT" -u "${MYSQL_USER}" -p"${MYSQL_PASSWORD}" -e "SELECT 1" &>/dev/null 2>&1; then
  success "MySQL connection verified (TCP 127.0.0.1:${MYSQL_PORT})"
else
  warn "Could not verify MySQL connection. Check credentials after install."
fi


# ═════════════════════════════════════════════════════════════════════
#  STEP 4 — SQLite setup
# ═════════════════════════════════════════════════════════════════════
step "4/9  Setting up SQLite"

# SQLite uses sql.js (pure JavaScript, no system packages needed)
# Just need to ensure the data directory exists
info "SQLite uses sql.js (pure JS) — no system packages required"
success "SQLite support ready (databases stored in ~/arcellite-data/databases/sqlite/)"


# ═════════════════════════════════════════════════════════════════════
#  STEP 5 — Data directories
# ═════════════════════════════════════════════════════════════════════
step "5/9  Creating data directories"

DATA_DIR="${HOME}/arcellite-data"
DIRS=(
  "${DATA_DIR}/files"
  "${DATA_DIR}/photos"
  "${DATA_DIR}/videos"
  "${DATA_DIR}/music"
  "${DATA_DIR}/shared"
  "${DATA_DIR}/databases"
  "${DATA_DIR}/databases/sqlite"
)
for d in "${DIRS[@]}"; do
  mkdir -p "$d"
done
success "Data directory created at ${DATA_DIR}"


# ═════════════════════════════════════════════════════════════════════
#  STEP 6 — Environment configuration (.env)
# ═════════════════════════════════════════════════════════════════════
step "6/9  Generating environment configuration"

SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)

if [[ -f ".env" ]]; then
  warn ".env already exists — backing up to .env.backup"
  cp .env ".env.backup.$(date +%Y%m%d%H%M%S)"
fi

cat > .env <<EOF
# ─────────────────────────────────────────────────────────────
# Arcellite — Environment Configuration
# Generated by install.sh on $(date -u +"%Y-%m-%d %H:%M UTC")
# ─────────────────────────────────────────────────────────────

# PostgreSQL Database (primary — used for auth, sessions, app data)
DB_HOST=${DB_HOST}
DB_PORT=${PG_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# MySQL / MariaDB (for user-created MySQL databases)
MYSQL_HOST=${MYSQL_HOST}
MYSQL_PORT=${MYSQL_PORT}
MYSQL_USER=${MYSQL_USER}
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}

# SQLite (file-based, stored in ARCELLITE_DATA/databases/sqlite/)
# No credentials needed — managed automatically by sql.js

# Application
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production

# Data directory (where files, photos, videos, music are stored)
ARCELLITE_DATA=~/arcellite-data

# Email (optional — for account verification codes)
# Configure with your SMTP provider (Gmail, Mailgun, etc.)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM=Arcellite <your-email@gmail.com>
EOF

chmod 600 .env
success ".env generated with secure credentials"


# ═════════════════════════════════════════════════════════════════════
#  STEP 7 — Install npm dependencies
# ═════════════════════════════════════════════════════════════════════
step "7/9  Installing npm dependencies"

npm install --production=false 2>&1 | tail -1
success "npm packages installed"


# ═════════════════════════════════════════════════════════════════════
#  STEP 8 — Build the application
# ═════════════════════════════════════════════════════════════════════
step "8/9  Building Arcellite"

info "Building frontend..."
npm run build 2>&1 | tail -1
success "Frontend built"

info "Compiling server..."
npm run build:server 2>&1 | tail -1
success "Server compiled"


# ═════════════════════════════════════════════════════════════════════
#  STEP 9 — systemd service (optional)
# ═════════════════════════════════════════════════════════════════════
step "9/9  Setting up system service"

SERVICE_NAME="arcellite"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

read -r -p "$(echo -e "${CYAN}Install Arcellite as a system service (starts on boot)? [Y/n]:${NC} ")" INSTALL_SERVICE
INSTALL_SERVICE=${INSTALL_SERVICE:-Y}

if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
  NODE_BIN=$(which node)

  sudo tee "$SERVICE_FILE" > /dev/null <<SVCEOF
[Unit]
Description=Arcellite — Personal Cloud Server
After=network.target postgresql.service mariadb.service
Wants=postgresql.service mariadb.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${PROJECT_DIR}
ExecStart=${NODE_BIN} ${PROJECT_DIR}/server/dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=${PROJECT_DIR}/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${DATA_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF

  sudo systemctl daemon-reload
  sudo systemctl enable "${SERVICE_NAME}" >/dev/null 2>&1
  sudo systemctl start "${SERVICE_NAME}" 2>/dev/null || true

  sleep 2
  if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
    success "Arcellite service installed and running"
  else
    warn "Service installed but may need a manual start: sudo systemctl start arcellite"
  fi
else
  info "Skipped — you can start manually with: npm run server"
fi


# ═════════════════════════════════════════════════════════════════════
#  Done
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Arcellite installed successfully!${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Quick start:${NC}"
echo -e "    Development:  ${CYAN}npm run dev${NC}"
echo -e "    Production:   ${CYAN}npm run server${NC}"
echo ""
echo -e "  ${BOLD}Defaults:${NC}"
echo -e "    Dev server:   http://localhost:3000"
echo -e "    Prod server:  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):3999"
echo -e "    Data dir:     ${DATA_DIR}"
echo ""
echo -e "  ${BOLD}Databases:${NC}"
echo -e "    PostgreSQL:   port ${PG_PORT} (app DB + user databases)"
echo -e "    MySQL:        port ${MYSQL_PORT} (user databases)"
echo -e "    SQLite:       ${DATA_DIR}/databases/sqlite/ (file-based)"
echo ""
echo -e "  ${BOLD}What's next:${NC}"
echo -e "    1. Open the URL above in your browser"
echo -e "    2. Complete the setup wizard (create your admin account)"
echo -e "    3. Start uploading files and using the AI assistant"
echo ""
if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
echo -e "  ${BOLD}Service commands:${NC}"
echo -e "    Status:   ${CYAN}sudo systemctl status arcellite${NC}"
echo -e "    Logs:     ${CYAN}sudo journalctl -u arcellite -f${NC}"
echo -e "    Restart:  ${CYAN}sudo systemctl restart arcellite${NC}"
echo ""
fi
echo -e "  ${BOLD}Config:${NC}  ${PROJECT_DIR}/.env"
echo -e "  ${BOLD}Docs:${NC}    https://github.com/ArcelliteProject/arcellite"
echo ""
