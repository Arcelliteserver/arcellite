#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  Arcellite — Automated Installer
#  Sets up Node.js, PostgreSQL, data directories, .env, and builds
#  the application so it's ready to run.
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
step "1/7  Checking system dependencies"

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


# ═════════════════════════════════════════════════════════════════════
#  STEP 2 — PostgreSQL
# ═════════════════════════════════════════════════════════════════════
step "2/7  Setting up PostgreSQL"

if command -v psql &>/dev/null; then
  PG_VER=$(psql --version | grep -oP '\d+' | head -1)
  success "PostgreSQL ${PG_VER} detected"
else
  info "PostgreSQL not found — installing..."
  if [[ "$PKG_MGR" == "apt" ]]; then
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
  sleep 2
  if systemctl is-active --quiet postgresql 2>/dev/null; then
    success "PostgreSQL service started"
  else
    warn "Could not start PostgreSQL via systemd. It may be managed differently on your system."
  fi
fi

# Detect PostgreSQL port (default 5432, some setups use 5433+)
PG_PORT=5432
for port in 5432 5433 5434; do
  if sudo -u postgres psql -p "$port" -c "SELECT 1" &>/dev/null 2>&1; then
    PG_PORT=$port
    break
  fi
done
info "PostgreSQL is listening on port ${PG_PORT}"

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

# Ensure password auth works (pg_hba.conf)
PG_HBA=$(sudo -u postgres psql -p "$PG_PORT" -t -c "SHOW hba_file" 2>/dev/null | xargs)
if [[ -n "$PG_HBA" ]] && [[ -f "$PG_HBA" ]]; then
  # Check if there's already a line allowing md5/scram for the user
  if ! sudo grep -q "arcellite_user" "$PG_HBA" 2>/dev/null; then
    if ! sudo grep -qE "^local\s+all\s+all\s+(md5|scram-sha-256)" "$PG_HBA" 2>/dev/null; then
      info "Configuring PostgreSQL authentication..."
      # Add md5 auth line before any existing 'local all all peer' line
      sudo sed -i "/^local\s\+all\s\+all\s\+peer/i local   all   ${DB_USER}   md5" "$PG_HBA" 2>/dev/null || true
      sudo systemctl reload postgresql >/dev/null 2>&1 || true
      success "PostgreSQL auth configured for password login"
    fi
  fi
fi

# Verify connection works
if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -p "$PG_PORT" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
  success "Database connection verified (TCP)"
  DB_HOST="localhost"
elif PGPASSWORD="${DB_PASSWORD}" psql -h /var/run/postgresql -p "$PG_PORT" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
  success "Database connection verified (Unix socket)"
  DB_HOST="/var/run/postgresql"
elif PGPASSWORD="${DB_PASSWORD}" psql -h /tmp -p "$PG_PORT" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
  success "Database connection verified (Unix socket /tmp)"
  DB_HOST="/tmp"
else
  warn "Could not verify database connection automatically."
  warn "You may need to configure pg_hba.conf manually for password auth."
  DB_HOST="localhost"
fi


# ═════════════════════════════════════════════════════════════════════
#  STEP 3 — Data directories
# ═════════════════════════════════════════════════════════════════════
step "3/7  Creating data directories"

DATA_DIR="${HOME}/arcellite-data"
DIRS=(
  "${DATA_DIR}/files"
  "${DATA_DIR}/photos"
  "${DATA_DIR}/videos"
  "${DATA_DIR}/music"
  "${DATA_DIR}/shared"
  "${DATA_DIR}/databases"
)
for d in "${DIRS[@]}"; do
  mkdir -p "$d"
done
success "Data directory created at ${DATA_DIR}"


# ═════════════════════════════════════════════════════════════════════
#  STEP 4 — Environment configuration (.env)
# ═════════════════════════════════════════════════════════════════════
step "4/7  Generating environment configuration"

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

# PostgreSQL Database
DB_HOST=${DB_HOST}
DB_PORT=${PG_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

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
#  STEP 5 — Install npm dependencies
# ═════════════════════════════════════════════════════════════════════
step "5/7  Installing npm dependencies"

npm install --production=false 2>&1 | tail -1
success "npm packages installed"


# ═════════════════════════════════════════════════════════════════════
#  STEP 6 — Build the application
# ═════════════════════════════════════════════════════════════════════
step "6/7  Building Arcellite"

info "Building frontend..."
npm run build 2>&1 | tail -1
success "Frontend built"

info "Compiling server..."
npm run build:server 2>&1 | tail -1
success "Server compiled"


# ═════════════════════════════════════════════════════════════════════
#  STEP 7 — systemd service (optional)
# ═════════════════════════════════════════════════════════════════════
step "7/7  Setting up system service"

SERVICE_NAME="arcellite"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

read -r -p "$(echo -e "${CYAN}Install Arcellite as a system service (starts on boot)? [Y/n]:${NC} ")" INSTALL_SERVICE
INSTALL_SERVICE=${INSTALL_SERVICE:-Y}

if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
  NODE_BIN=$(which node)

  sudo tee "$SERVICE_FILE" > /dev/null <<SVCEOF
[Unit]
Description=Arcellite — Personal Cloud Server
After=network.target postgresql.service
Wants=postgresql.service

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
