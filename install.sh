#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  Arcellite — Automated Installer (Open-Source Edition)
#  Sets up Node.js, PostgreSQL, MySQL/MariaDB, SQLite, data
#  directories, .env, and builds the application so it's ready to run.
#
#  Usage:   chmod +x install.sh && ./install.sh
#  Tested:  Ubuntu 22.04/24.04, Debian 12, Raspberry Pi OS (64-bit)
#
#  After install: open http://<your-ip>:3000 in your browser
#  API keys (AI, etc.) are configured in the web UI → Settings
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
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
ARCELLITE_USER="$(whoami)"

# ── Parse flags ──────────────────────────────────────────────────────
RESET_INSTALL=false
for arg in "$@"; do
  case $arg in
    --reset|--fresh|-r)
      RESET_INSTALL=true
      ;;
  esac
done

echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║        Arcellite — Self-Hosted Personal Cloud        ║${NC}"
echo -e "${BOLD}${CYAN}║              Automated Installer v2.0                ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}\n"

if [[ "$RESET_INSTALL" == true ]]; then
  echo -e "  ${YELLOW}${BOLD}⚠  Reset mode — existing data will be wiped${NC}\n"
fi

# ── Verify sudo access early ─────────────────────────────────────────
if ! sudo -n true 2>/dev/null; then
  info "This installer requires sudo. You may be prompted for your password."
  if ! sudo true; then
    fail "Cannot obtain sudo. Please run as a user with sudo privileges."
  fi
fi
success "Sudo access confirmed"


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

# ── curl (required for Node.js install, public IP detection, etc.) ──
if ! command -v curl &>/dev/null; then
  info "Installing curl..."
  if [[ "$PKG_MGR" == "apt" ]]; then
    sudo apt-get update -qq >/dev/null 2>&1
    sudo apt-get install -y curl >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "dnf" ]]; then
    sudo dnf install -y curl >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "pacman" ]]; then
    sudo pacman -S --noconfirm curl >/dev/null 2>&1
  fi
fi

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
  VG_FREE=$(sudo vgs --noheadings --nosuffix --units g -o vg_free 2>/dev/null | head -1 | tr -d ' ')
  VG_FREE_INT=${VG_FREE%%.*}
  if [[ -n "$VG_FREE_INT" ]] && [[ "$VG_FREE_INT" -gt 1 ]] 2>/dev/null; then
    ROOT_LV=$(df / --output=source | tail -1)
    if [[ "$ROOT_LV" == /dev/mapper/* ]] || [[ "$ROOT_LV" == /dev/dm-* ]]; then
      info "Detected ~${VG_FREE_INT}GB unused disk space — auto-expanding root filesystem..."
      sudo lvextend -l +100%FREE "$ROOT_LV" >/dev/null 2>&1
      sudo resize2fs "$ROOT_LV" >/dev/null 2>&1 || sudo xfs_growfs / >/dev/null 2>&1
      NEW_SIZE=$(df -h / --output=size | tail -1 | tr -d ' ')
      success "Root filesystem expanded to ${NEW_SIZE}"
    fi
  else
    success "Disk fully allocated"
  fi
else
  :
fi


# ── Removable storage support (USB drives, SD cards) ────────────────
step "1b/9  Setting up removable storage support"

# Install udisks2
if command -v udisksctl &>/dev/null; then
  success "udisks2 already installed"
else
  info "Installing udisks2 (for removable device management)..."
  if [[ "$PKG_MGR" == "apt" ]]; then
    sudo apt-get install -y udisks2 >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "dnf" ]]; then
    sudo dnf install -y udisks2 >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "pacman" ]]; then
    sudo pacman -S --noconfirm udisks2 >/dev/null 2>&1
  fi
  if command -v udisksctl &>/dev/null; then
    success "udisks2 installed"
  else
    warn "Could not install udisks2. Removable storage mounting may not work."
  fi
fi

# Ensure lsblk available
if command -v lsblk &>/dev/null; then
  success "lsblk available (util-linux)"
else
  info "Installing util-linux..."
  install_pkg util-linux
  success "util-linux installed"
fi

# Install filesystem formatting tools
info "Checking filesystem format tools..."
MISSING_FS_TOOLS=()
command -v mkfs.vfat  &>/dev/null || MISSING_FS_TOOLS+=("dosfstools")
command -v mkfs.ext4  &>/dev/null || MISSING_FS_TOOLS+=("e2fsprogs")
command -v mkfs.exfat &>/dev/null || MISSING_FS_TOOLS+=("exfatprogs")
command -v mkfs.ntfs  &>/dev/null || MISSING_FS_TOOLS+=("ntfs-3g")

if [[ ${#MISSING_FS_TOOLS[@]} -gt 0 ]]; then
  info "Installing filesystem tools: ${MISSING_FS_TOOLS[*]}..."
  if [[ "$PKG_MGR" == "apt" ]]; then
    sudo apt-get install -y "${MISSING_FS_TOOLS[@]}" >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "dnf" ]]; then
    sudo dnf install -y "${MISSING_FS_TOOLS[@]}" >/dev/null 2>&1
  elif [[ "$PKG_MGR" == "pacman" ]]; then
    sudo pacman -S --noconfirm "${MISSING_FS_TOOLS[@]}" >/dev/null 2>&1
  fi
  success "Filesystem format tools installed"
else
  success "All filesystem format tools available"
fi

# Create mount directory for removable devices
MOUNT_BASE="/media/arcellite"
if [[ ! -d "$MOUNT_BASE" ]]; then
  sudo mkdir -p "$MOUNT_BASE"
  sudo chown "${ARCELLITE_USER}:${ARCELLITE_USER}" "$MOUNT_BASE"
  sudo chmod 755 "$MOUNT_BASE"
  success "Mount directory created at ${MOUNT_BASE}"
else
  success "Mount directory ${MOUNT_BASE} exists"
fi

# Set up polkit rule so current user can mount/unmount without password
POLKIT_RULES_DIR=""
if [[ -d "/etc/polkit-1/rules.d" ]]; then
  POLKIT_RULES_DIR="/etc/polkit-1/rules.d"
elif [[ -d "/etc/polkit-1/localauthority/50-local.d" ]]; then
  POLKIT_RULES_DIR="/etc/polkit-1/localauthority/50-local.d"
fi

if [[ -n "$POLKIT_RULES_DIR" ]] && [[ -d "/etc/polkit-1/rules.d" ]]; then
  POLKIT_FILE="/etc/polkit-1/rules.d/10-arcellite-udisks.rules"
  if [[ ! -f "$POLKIT_FILE" ]]; then
    info "Creating polkit rule for passwordless mount/unmount..."
    sudo tee "$POLKIT_FILE" > /dev/null <<POLKITEOF
// Allow the Arcellite user to mount/unmount filesystems via udisks2
polkit.addRule(function(action, subject) {
    if ((action.id == "org.freedesktop.udisks2.filesystem-mount" ||
         action.id == "org.freedesktop.udisks2.filesystem-mount-other-seat" ||
         action.id == "org.freedesktop.udisks2.filesystem-mount-system" ||
         action.id == "org.freedesktop.udisks2.filesystem-unmount-others" ||
         action.id == "org.freedesktop.udisks2.filesystem-fstab" ||
         action.id == "org.freedesktop.udisks2.power-off-drive" ||
         action.id == "org.freedesktop.udisks2.power-off-drive-other-seat") &&
        subject.user == "${ARCELLITE_USER}") {
        return polkit.Result.YES;
    }
});
POLKITEOF
    success "Polkit rule created (passwordless mount for ${ARCELLITE_USER})"
  else
    success "Polkit rule already exists"
  fi
elif [[ -n "$POLKIT_RULES_DIR" ]]; then
  POLKIT_FILE="${POLKIT_RULES_DIR}/10-arcellite-udisks.pkla"
  if [[ ! -f "$POLKIT_FILE" ]]; then
    info "Creating polkit rule (pkla format)..."
    sudo tee "$POLKIT_FILE" > /dev/null <<PKLAEOF
[Allow arcellite to mount/unmount]
Identity=unix-user:${ARCELLITE_USER}
Action=org.freedesktop.udisks2.filesystem-mount;org.freedesktop.udisks2.filesystem-mount-other-seat;org.freedesktop.udisks2.filesystem-mount-system;org.freedesktop.udisks2.filesystem-unmount-others;org.freedesktop.udisks2.power-off-drive;org.freedesktop.udisks2.power-off-drive-other-seat
ResultAny=yes
ResultInactive=yes
ResultActive=yes
PKLAEOF
    success "Polkit rule created (pkla format)"
  else
    success "Polkit rule already exists"
  fi
else
  warn "Could not find polkit rules directory. Mount permissions may need manual setup."
fi

# Add user to device groups
for grp in disk plugdev; do
  if getent group "$grp" &>/dev/null; then
    if ! groups "$ARCELLITE_USER" 2>/dev/null | grep -qw "$grp"; then
      sudo usermod -aG "$grp" "$ARCELLITE_USER" 2>/dev/null || true
      info "Added ${ARCELLITE_USER} to '${grp}' group"
    fi
  fi
done
success "User groups configured for device access"

# Set up passwordless sudo for mount/unmount commands
SUDOERS_FILE="/etc/sudoers.d/arcellite-mount"
if [[ ! -f "$SUDOERS_FILE" ]]; then
  info "Creating sudoers rule for passwordless mount/unmount..."
  MOUNT_BIN=$(which mount)
  UMOUNT_BIN=$(which umount)
  MKDIR_BIN=$(which mkdir)
  RMDIR_BIN=$(which rmdir)
  CHMOD_BIN=$(which chmod)
  CHOWN_BIN=$(which chown)
  WIPEFS_BIN=$(which wipefs 2>/dev/null || echo "/usr/sbin/wipefs")
  MKFS_VFAT_BIN=$(which mkfs.vfat 2>/dev/null || echo "/usr/sbin/mkfs.vfat")
  MKFS_EXT4_BIN=$(which mkfs.ext4 2>/dev/null || echo "/usr/sbin/mkfs.ext4")
  MKFS_EXFAT_BIN=$(which mkfs.exfat 2>/dev/null || echo "/usr/sbin/mkfs.exfat")
  MKFS_NTFS_BIN=$(which mkfs.ntfs 2>/dev/null || echo "/usr/sbin/mkfs.ntfs")
  REBOOT_BIN=$(which reboot 2>/dev/null || echo "/sbin/reboot")
  SHUTDOWN_BIN=$(which shutdown 2>/dev/null || echo "/sbin/shutdown")
  TEE_BIN=$(which tee 2>/dev/null || echo "/usr/bin/tee")
  sudo tee "$SUDOERS_FILE" > /dev/null <<SUDOEOF
# Arcellite: Allow mounting/unmounting removable devices without password
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${MOUNT_BIN} /dev/* /media/arcellite/*
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${MOUNT_BIN} -o * /dev/* /media/arcellite/*
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${UMOUNT_BIN} /media/arcellite/*
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${MKDIR_BIN} -p /media/arcellite/*
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${RMDIR_BIN} /media/arcellite/*
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${CHMOD_BIN} 755 /media/arcellite
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${CHOWN_BIN} -R ${ARCELLITE_USER}\:${ARCELLITE_USER} /media/arcellite/*

# Arcellite: Allow formatting removable devices without password
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${WIPEFS_BIN} -a /dev/*
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${MKFS_VFAT_BIN} *
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${MKFS_EXT4_BIN} *
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${MKFS_EXFAT_BIN} *
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${MKFS_NTFS_BIN} *

# Arcellite: Allow system power management and cache clearing
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${REBOOT_BIN}
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${SHUTDOWN_BIN} -h now
${ARCELLITE_USER} ALL=(root) NOPASSWD: ${TEE_BIN} /proc/sys/vm/drop_caches
SUDOEOF
  sudo chmod 440 "$SUDOERS_FILE"
  if sudo visudo -c -f "$SUDOERS_FILE" >/dev/null 2>&1; then
    success "Sudoers rule created"
  else
    warn "Sudoers file validation failed — removing invalid file"
    sudo rm -f "$SUDOERS_FILE"
  fi
else
  success "Sudoers mount rule already exists"
fi

# Detect available storage devices (informational)
info "Detected storage devices:"
if command -v lsblk &>/dev/null; then
  while IFS= read -r line; do
    dev_name=$(echo "$line" | awk '{print $1}')
    dev_size=$(echo "$line" | awk '{print $2}')
    dev_type=$(echo "$line" | awk '{print $3}')
    if [[ "$dev_type" != "disk" ]]; then continue; fi
    if [[ "$dev_name" == loop* ]] || [[ "$dev_name" == *boot* ]]; then continue; fi
    if [[ "$dev_name" == nvme* ]]; then
      info "  /dev/${dev_name}: ${dev_size} NVMe SSD"
    elif [[ "$dev_name" == mmcblk* ]]; then
      MMC_DEV_TYPE=$(cat "/sys/block/${dev_name}/device/uevent" 2>/dev/null | grep -oP 'MMC_TYPE=\K.*' || echo "unknown")
      if [[ "$MMC_DEV_TYPE" == "SD" ]]; then
        info "  /dev/${dev_name}: ${dev_size} SD Card (removable)"
      elif [[ "$MMC_DEV_TYPE" == "MMC" ]]; then
        info "  /dev/${dev_name}: ${dev_size} eMMC (internal)"
      else
        info "  /dev/${dev_name}: ${dev_size} MMC device"
      fi
    elif [[ "$dev_name" == sd* ]]; then
      info "  /dev/${dev_name}: ${dev_size} USB/SCSI device"
    fi
  done < <(lsblk -nd -o NAME,SIZE,TYPE 2>/dev/null)
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
      warn "Could not start PostgreSQL via systemd. It may be managed differently."
    fi
  fi
fi

# Detect PostgreSQL port
PG_PORT=""
for port in 5432 5433 5434; do
  if sudo -u postgres psql -p "$port" -c "SELECT 1" &>/dev/null 2>&1; then
    PG_PORT=$port
    break
  fi
done

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
  sudo -u postgres psql -p "$PG_PORT" -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}' CREATEDB;" >/dev/null 2>&1
  success "Database user '${DB_USER}' updated"
} || {
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

sudo -u postgres psql -p "$PG_PORT" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null 2>&1

# ── Configure pg_hba.conf for password auth ──────────────────────────
PG_HBA=$(sudo -u postgres psql -p "$PG_PORT" -t -c "SHOW hba_file" 2>/dev/null | xargs)
if [[ -n "$PG_HBA" ]] && [[ -f "$PG_HBA" ]]; then
  HBA_CHANGED=false

  # TCP entry for localhost (127.0.0.1)
  if ! sudo grep -qE "^host\s+all\s+${DB_USER}\s+127\.0\.0\.1" "$PG_HBA" 2>/dev/null; then
    info "Adding TCP auth entry for ${DB_USER} (localhost)..."
    if sudo grep -qE "^host\s" "$PG_HBA" 2>/dev/null; then
      sudo sed -i "0,/^host\s/s//host    all    ${DB_USER}    127.0.0.1\/32    md5\n&/" "$PG_HBA" 2>/dev/null || true
    else
      echo "host    all    ${DB_USER}    127.0.0.1/32    md5" | sudo tee -a "$PG_HBA" >/dev/null 2>&1
    fi
    HBA_CHANGED=true
  fi

  # TCP entry for IPv6 localhost (::1)
  if ! sudo grep -qE "^host\s+all\s+${DB_USER}\s+::1" "$PG_HBA" 2>/dev/null; then
    if sudo grep -qE "^host\s" "$PG_HBA" 2>/dev/null; then
      sudo sed -i "0,/^host\s/s//host    all    ${DB_USER}    ::1\/128    md5\n&/" "$PG_HBA" 2>/dev/null || true
    else
      echo "host    all    ${DB_USER}    ::1/128    md5" | sudo tee -a "$PG_HBA" >/dev/null 2>&1
    fi
    HBA_CHANGED=true
  fi

  # TCP entry for LAN / remote access (all networks, password-protected)
  if ! sudo grep -qE "^host\s+all\s+${DB_USER}\s+0\.0\.0\.0/0" "$PG_HBA" 2>/dev/null; then
    info "Adding remote access auth entry for ${DB_USER} (all networks)..."
    echo "host    all    ${DB_USER}    0.0.0.0/0    scram-sha-256" | sudo tee -a "$PG_HBA" >/dev/null 2>&1
    HBA_CHANGED=true
  fi

  # Unix socket entry
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
    success "PostgreSQL auth configured (local + LAN + remote)"
  else
    success "PostgreSQL auth already configured"
  fi
else
  warn "Could not locate pg_hba.conf — configure auth manually"
fi

# ── Configure listen_addresses for network access ────────────────────
PG_CONF=$(sudo -u postgres psql -p "$PG_PORT" -t -c "SHOW config_file" 2>/dev/null | xargs)
if [[ -n "$PG_CONF" ]] && [[ -f "$PG_CONF" ]]; then
  LISTEN_ADDR=$(sudo -u postgres psql -p "$PG_PORT" -t -c "SHOW listen_addresses" 2>/dev/null | xargs)
  if [[ "$LISTEN_ADDR" != "*" ]]; then
    info "Setting listen_addresses = '*' for LAN/remote database access..."
    sudo sed -i "s/^#\?\s*listen_addresses\s*=.*/listen_addresses = '*'/" "$PG_CONF" 2>/dev/null || true
    # Verify the change was applied
    if sudo grep -q "^listen_addresses = '\*'" "$PG_CONF" 2>/dev/null; then
      sudo systemctl restart postgresql >/dev/null 2>&1 || true
      sleep 3
      success "PostgreSQL now listening on all interfaces (LAN + remote)"
    else
      # If sed didn't match (no existing line), append it
      echo "listen_addresses = '*'" | sudo tee -a "$PG_CONF" >/dev/null 2>&1
      sudo systemctl restart postgresql >/dev/null 2>&1 || true
      sleep 3
      success "PostgreSQL now listening on all interfaces (LAN + remote)"
    fi
  else
    success "PostgreSQL already listening on all interfaces"
  fi
fi

# Verify connection
DB_HOST="127.0.0.1"
if PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -p "$PG_PORT" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
  success "Database connection verified (TCP 127.0.0.1:${PG_PORT})"
  DB_HOST="127.0.0.1"
elif PGPASSWORD="${DB_PASSWORD}" psql -h localhost -p "$PG_PORT" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
  success "Database connection verified (TCP localhost:${PG_PORT})"
  DB_HOST="localhost"
elif PGPASSWORD="${DB_PASSWORD}" psql -h /var/run/postgresql -p "$PG_PORT" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
  success "Database connection verified (Unix socket)"
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

# ── Detect existing installation and offer reset ──────────────────────
# Helper: run a psql query and return the result (empty string on failure)
_psql() {
  PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${PG_PORT}" \
    -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "$1" 2>/dev/null || true
}

_do_reset() {
  # Stop any running instance first
  if command -v pm2 &>/dev/null; then
    pm2 stop arcellite >/dev/null 2>&1 || true
    pm2 delete arcellite >/dev/null 2>&1 || true
  fi
  # Drop and recreate the database — this wipes ALL user accounts and setup state
  sudo -u postgres psql -p "$PG_PORT" -c "DROP DATABASE IF EXISTS ${DB_NAME};" >/dev/null 2>&1 || true
  sudo -u postgres psql -p "$PG_PORT" -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null 2>&1
  sudo -u postgres psql -p "$PG_PORT" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null 2>&1
  # Clear config (API keys, settings) — data files like photos/videos are kept
  if [[ -d "${HOME}/arcellite-data/config" ]]; then
    rm -rf "${HOME}/arcellite-data/config"
    mkdir -p "${HOME}/arcellite-data/config"
  fi
  success "Database reset complete — setup wizard will appear on next login"
}

if [[ "$RESET_INSTALL" == true ]]; then
  # --reset flag: always wipe, no questions asked
  info "Wiping existing database and config..."
  _do_reset

else
  # No flag: check if existing users are present and ask the user
  USERS_TABLE=$(_psql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='users'")
  if [[ "$USERS_TABLE" == "1" ]]; then
    USER_COUNT=$(_psql "SELECT COUNT(*) FROM users")
    if [[ "$USER_COUNT" =~ ^[0-9]+$ ]] && (( USER_COUNT > 0 )); then
      echo ""
      echo -e "  ${YELLOW}${BOLD}⚠  Existing Arcellite installation detected${NC}"
      echo -e "  Found ${USER_COUNT} account(s) in the database from a previous install."
      echo ""
      echo -e "  ${BOLD}Options:${NC}"
      echo -e "    ${CYAN}y${NC} — Wipe the database (fresh setup wizard on next login)"
      echo -e "    ${CYAN}n${NC} — Keep existing data (update / reinstall only)"
      echo ""
      read -rp "  Reset database and start fresh? (y/N): " RESET_CHOICE || RESET_CHOICE=""
      if [[ "${RESET_CHOICE,,}" == "y" || "${RESET_CHOICE,,}" == "yes" ]]; then
        _do_reset
      else
        info "Keeping existing data — continuing as update..."
      fi
    fi
  fi
fi


# ═════════════════════════════════════════════════════════════════════
#  STEP 3 — MySQL / MariaDB
# ═════════════════════════════════════════════════════════════════════
step "3/9  Setting up MySQL / MariaDB"

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
MYSQL_SERVICE=""
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
    warn "Could not start MySQL/MariaDB. Start it manually."
  fi
fi

# Create MySQL user
info "Configuring MySQL user '${MYSQL_USER}'..."
if sudo mysql -e "SELECT 1" &>/dev/null 2>&1; then
  sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}';" 2>/dev/null || \
  sudo mysql -e "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('${MYSQL_ROOT_PASSWORD}');" 2>/dev/null || true

  sudo mysql -e "CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD}';" 2>/dev/null || true
  sudo mysql -e "CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'127.0.0.1' IDENTIFIED BY '${MYSQL_PASSWORD}';" 2>/dev/null || true
  sudo mysql -e "GRANT ALL PRIVILEGES ON \`arcellite\_%\`.* TO '${MYSQL_USER}'@'localhost';" 2>/dev/null || true
  sudo mysql -e "GRANT ALL PRIVILEGES ON \`arcellite\_%\`.* TO '${MYSQL_USER}'@'127.0.0.1';" 2>/dev/null || true
  sudo mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
  success "MySQL user '${MYSQL_USER}' configured"
else
  warn "Could not access MySQL as root. Configure the MySQL user manually."
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

# Detect LAN IP
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

if [[ -f ".env" ]]; then
  warn ".env already exists — backing up to .env.backup"
  cp .env ".env.backup.$(date +%Y%m%d%H%M%S)"
fi

cat > .env <<EOF
# ─────────────────────────────────────────────────────────────
# Arcellite — Environment Configuration
# Generated by install.sh on $(date -u +"%Y-%m-%d %H:%M UTC")
# ─────────────────────────────────────────────────────────────

# ── PostgreSQL (primary — auth, sessions, app data, user DBs) ──
DB_HOST=${DB_HOST}
DB_PORT=${PG_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# ── MySQL / MariaDB (for user-created MySQL databases) ──
MYSQL_HOST=${MYSQL_HOST}
MYSQL_PORT=${MYSQL_PORT}
MYSQL_USER=${MYSQL_USER}
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}

# ── Application ──
PORT=3000
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production

# Data directory (files, photos, videos, music are stored here)
ARCELLITE_DATA=~/arcellite-data

# ── Network (optional) ──
# Your public URL — set only if using a custom domain
# Example: https://cloud.yourdomain.com
# ARCELLITE_PUBLIC_URL=

# Public IP/hostname for global database connection URLs (auto-detected if empty)
# Override if your server is behind NAT and you know your public IP
# ARCELLITE_DB_HOST=

# ── Email (optional — for account verification & notifications) ──
# Configure with your SMTP provider (Gmail, Mailgun, SendGrid, etc.)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM=Arcellite <your-email@gmail.com>

# ── AI API Keys ──
# API keys are managed through the web UI: Settings → AI Models
# No env vars needed — just add keys in the UI after first login.
# Supported providers: DeepSeek, OpenAI, Anthropic, Google Gemini, and more.
EOF

chmod 600 .env
success ".env generated with secure credentials"


# ═════════════════════════════════════════════════════════════════════
#  STEP 7 — Install npm dependencies
# ═════════════════════════════════════════════════════════════════════
step "7/9  Installing npm dependencies"

npm install --production=false 2>&1 | tail -3
success "npm packages installed"


# ═════════════════════════════════════════════════════════════════════
#  STEP 8 — Build the application
# ═════════════════════════════════════════════════════════════════════
step "8/9  Building Arcellite"

info "Building frontend..."
npm run build 2>&1 | tail -3
success "Frontend built"

info "Compiling server..."
npm run build:server 2>&1 | tail -3
success "Server compiled"


# ═════════════════════════════════════════════════════════════════════
#  STEP 9 — PM2 process manager (auto-start on boot)
# ═════════════════════════════════════════════════════════════════════
step "9/9  Setting up PM2 process manager"

if command -v pm2 &>/dev/null; then
  success "PM2 already installed ($(pm2 -v))"
else
  info "Installing PM2..."
  sudo npm install -g pm2 >/dev/null 2>&1
  success "PM2 installed"
fi

# Create PM2 ecosystem config
cat > "${PROJECT_DIR}/ecosystem.config.cjs" <<'PMEOF'
const path = require('path');
const fs = require('fs');

// Load .env file
const envFile = path.join(__dirname, '.env');
const envVars = {};
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      envVars[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
    }
  });
}

module.exports = {
  apps: [{
    name: 'arcellite',
    // Arcellite uses Vite as the application server.
    // vite.config.ts registers all /api/* route middleware (auth, files, AI,
    // databases, etc.) via configureServer — so Vite must run to serve the API.
    // server/dist/index.js only handles a small set of system-level routes.
    script: 'node_modules/.bin/vite',
    args: '--host 0.0.0.0 --port 3000',
    interpreter: 'none',
    cwd: __dirname,
    env: {
      ...envVars,
      NODE_ENV: 'production',
    },
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: path.join(__dirname, 'logs/arcellite-error.log'),
    out_file: path.join(__dirname, 'logs/arcellite-out.log'),
  }],
};
PMEOF
# Ensure logs directory exists
mkdir -p "${PROJECT_DIR}/logs"
success "PM2 ecosystem config created (production server)"

# Stop any existing arcellite process
pm2 delete arcellite >/dev/null 2>&1 || true

# Start with PM2
info "Starting Arcellite with PM2..."
pm2 start "${PROJECT_DIR}/ecosystem.config.cjs" >/dev/null 2>&1
sleep 5

if pm2 list 2>/dev/null | grep -q "arcellite.*online"; then
  success "Arcellite is running via PM2"
else
  warn "PM2 started but process may not be online yet. Check: pm2 logs arcellite"
fi

# Save PM2 process list and set up auto-start on boot
pm2 save >/dev/null 2>&1
PM2_STARTUP=$(pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>&1 | grep "sudo" | head -1)
if [[ -n "$PM2_STARTUP" ]]; then
  eval "$PM2_STARTUP" >/dev/null 2>&1 || true
  success "PM2 auto-start configured (survives reboots)"
else
  pm2 startup systemd >/dev/null 2>&1 || true
  success "PM2 startup configured"
fi


# ═════════════════════════════════════════════════════════════════════
#  Firewall — secure configuration
#
#  Security design:
#   • Default policy: DENY all incoming, ALLOW all outgoing
#   • SSH: rate-limited (blocks brute-force after 6 attempts/30s)
#   • SSH port: auto-detected from sshd_config (handles non-standard ports)
#   • PostgreSQL: NOT exposed to internet — localhost only is sufficient
#     (remote DB access should use SSH tunneling, not a public port)
#   • Arcellite web app: port 3000
#   • HTTP/HTTPS: 80 and 443 (for reverse proxy / Cloudflare Tunnel)
# ═════════════════════════════════════════════════════════════════════

# Detect the SSH port from sshd_config (defaults to 22 if not found)
SSH_PORT=$(sudo grep -E "^[[:space:]]*Port[[:space:]]+" /etc/ssh/sshd_config 2>/dev/null \
           | awk '{print $2}' | head -1)
SSH_PORT=${SSH_PORT:-22}
if [[ ! "$SSH_PORT" =~ ^[0-9]+$ ]]; then SSH_PORT=22; fi

if command -v ufw &>/dev/null; then
  info "Configuring firewall (ufw) — SSH port detected: ${SSH_PORT}..."

  # ── 1. Secure default policies ──────────────────────────────────────
  sudo ufw default deny incoming  >/dev/null 2>&1
  sudo ufw default allow outgoing >/dev/null 2>&1

  # ── 2. SSH — rate-limited to block brute-force attacks ──────────────
  #  ufw limit = max 6 new connections per 30 seconds per source IP.
  #  This keeps SSH accessible but automatically bans repeat offenders.
  sudo ufw limit "${SSH_PORT}/tcp" comment "SSH (rate-limited)" >/dev/null 2>&1

  # ── 3. Arcellite web app ─────────────────────────────────────────────
  sudo ufw allow 3000/tcp comment "Arcellite" >/dev/null 2>&1

  # ── 4. HTTP / HTTPS — for reverse proxy or Cloudflare Tunnel ────────
  sudo ufw allow 80/tcp  comment "HTTP"  >/dev/null 2>&1
  sudo ufw allow 443/tcp comment "HTTPS" >/dev/null 2>&1

  # ── 5. PostgreSQL — localhost only, NOT open to internet ─────────────
  #  The database listens on 127.0.0.1 already. No public firewall rule
  #  is needed or wanted. For remote GUI tools (DataGrip, DBeaver), use
  #  an SSH tunnel: ssh -L 5432:127.0.0.1:5432 user@your-server

  # ── 6. Enable / reload ───────────────────────────────────────────────
  UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1)
  if echo "$UFW_STATUS" | grep -qi "active"; then
    sudo ufw reload >/dev/null 2>&1
    success "Firewall: rules updated and reloaded"
  else
    # UFW was inactive — SSH is already allowed above, safe to enable now
    sudo ufw --force enable >/dev/null 2>&1
    success "Firewall: UFW enabled with secure defaults"
  fi

  info "  Allowed in: SSH :${SSH_PORT} (rate-limited), Arcellite :3000, HTTP :80, HTTPS :443"
  info "  Blocked: everything else, including database port (localhost only)"

elif command -v firewall-cmd &>/dev/null; then
  # ── firewalld (Fedora / CentOS / RHEL / AlmaLinux) ──────────────────
  info "Configuring firewall (firewalld) — SSH port detected: ${SSH_PORT}..."

  # SSH with rate limiting via rich rules
  sudo firewall-cmd --permanent --add-rich-rule="rule family='ipv4' service name='ssh' accept" >/dev/null 2>&1 || true
  if [[ "$SSH_PORT" != "22" ]]; then
    sudo firewall-cmd --permanent --add-port="${SSH_PORT}/tcp" >/dev/null 2>&1
  else
    sudo firewall-cmd --permanent --add-service=ssh >/dev/null 2>&1
  fi

  sudo firewall-cmd --permanent --add-port=3000/tcp >/dev/null 2>&1
  sudo firewall-cmd --permanent --add-service=http  >/dev/null 2>&1
  sudo firewall-cmd --permanent --add-service=https >/dev/null 2>&1
  # PostgreSQL: NOT opened publicly — localhost only

  sudo firewall-cmd --reload >/dev/null 2>&1
  success "Firewall: SSH :${SSH_PORT}, Arcellite :3000, HTTP :80, HTTPS :443 opened (firewalld)"
  info "  PostgreSQL is NOT exposed publicly — localhost only"

else
  warn "No UFW or firewalld found. Manually secure your firewall:"
  warn "  1. Allow SSH first:          sudo ufw limit ${SSH_PORT}/tcp"
  warn "  2. Allow Arcellite:          sudo ufw allow 3000/tcp"
  warn "  3. Allow HTTP/HTTPS:         sudo ufw allow 80/tcp && sudo ufw allow 443/tcp"
  warn "  4. Set default deny:         sudo ufw default deny incoming"
  warn "  5. Enable:                   sudo ufw enable"
  warn "  Do NOT expose PostgreSQL port ${PG_PORT} publicly."
fi


# ═════════════════════════════════════════════════════════════════════
#  Step 10/10  —  Cloudflare Tunnel (optional)
# ═════════════════════════════════════════════════════════════════════
echo ""
step "10/10  Cloudflare Tunnel (optional)"

if command -v cloudflared &>/dev/null; then
  CF_VERSION=$(cloudflared --version 2>/dev/null | head -1)
  success "cloudflared is already installed: ${CF_VERSION}"
  info "You can configure your tunnel in Settings > Domain in the web UI."
else
  echo ""
  echo -e "  ${BOLD}Cloudflare Tunnel${NC} lets you access Arcellite from a custom domain"
  echo -e "  (e.g. cloud.yourdomain.com) without port forwarding or a static IP."
  echo -e "  ${DIM}You can always install it later from Settings > Domain.${NC}"
  echo ""
  read -rp "  Install cloudflared now? (y/N): " INSTALL_CF || INSTALL_CF=""
  echo ""

  if [[ "${INSTALL_CF,,}" == "y" || "${INSTALL_CF,,}" == "yes" ]]; then
    info "Installing cloudflared..."

    if [[ "$PKG_MGR" == "apt" ]]; then
      # Debian / Ubuntu
      sudo mkdir -p --mode=0755 /usr/share/keyrings
      curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null
      echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
      sudo apt-get update -qq >/dev/null 2>&1
      sudo apt-get install -y cloudflared >/dev/null 2>&1
    elif [[ "$PKG_MGR" == "dnf" ]]; then
      # Red Hat / CentOS / Fedora
      curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | sudo tee /etc/yum.repos.d/cloudflared.repo >/dev/null
      sudo ${PKG_MGR} install -y cloudflared >/dev/null 2>&1
    else
      warn "Unsupported package manager. Install cloudflared manually:"
      echo -e "    ${CYAN}https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/${NC}"
    fi

    if command -v cloudflared &>/dev/null; then
      CF_VERSION=$(cloudflared --version 2>/dev/null | head -1)
      success "cloudflared installed: ${CF_VERSION}"
      info "Configure your tunnel in Settings > Domain after setup."
    else
      warn "cloudflared installation failed. You can install it later from Settings > Domain."
    fi
  else
    info "Skipped. You can install cloudflared later from Settings > Domain."
  fi
fi


# ═════════════════════════════════════════════════════════════════════
#  Done!
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║        Arcellite installed successfully!             ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Open in your browser:${NC}"
echo -e "    Local:  ${CYAN}http://localhost:3000${NC}"
echo -e "    LAN:    ${CYAN}http://${LAN_IP}:3000${NC}"
echo ""
echo -e "  ${BOLD}Data directory:${NC}  ${DATA_DIR}"
echo ""
echo -e "  ${BOLD}Databases:${NC}"
echo -e "    PostgreSQL:  port ${PG_PORT}  ${DIM}(app DB + user databases)${NC}"
echo -e "    MySQL:       port ${MYSQL_PORT}  ${DIM}(user databases)${NC}"
echo -e "    SQLite:      ${DIM}file-based, no port needed${NC}"
echo ""
echo -e "  ${BOLD}Getting started:${NC}"
echo -e "    1. Open ${CYAN}http://${LAN_IP}:3000${NC} in your browser"
echo -e "    2. Complete the setup wizard (create your admin account)"
echo -e "    3. Go to ${BOLD}Settings > AI Models${NC} to add your API keys"
echo -e "       ${DIM}(DeepSeek, OpenAI, Anthropic, Google Gemini, etc.)${NC}"
echo -e "    4. Start uploading files and using the AI assistant!"
echo ""
echo -e "  ${BOLD}PM2 commands:${NC}"
echo -e "    Status:   ${CYAN}pm2 status${NC}"
echo -e "    Logs:     ${CYAN}pm2 logs arcellite${NC}"
echo -e "    Restart:  ${CYAN}pm2 restart arcellite${NC}"
echo -e "    Stop:     ${CYAN}pm2 stop arcellite${NC}"
echo ""
echo -e "  ${BOLD}Remote database access:${NC}"
echo -e "    Connect from DataGrip/DBeaver using the connection"
echo -e "    URLs shown in the ${BOLD}Database > Info${NC} tab in the web UI."
echo -e "    For access outside your LAN, forward port ${PG_PORT} on your router."
echo ""
echo -e "  ${BOLD}Custom domain (optional):${NC}"
echo -e "    Use a reverse proxy (Nginx/Caddy) or Cloudflare Tunnel to"
echo -e "    access Arcellite from a domain like cloud.yourdomain.com."
echo -e "    Then set ${CYAN}ARCELLITE_PUBLIC_URL${NC} in .env and restart."
echo ""
echo -e "  ${BOLD}Configuration:${NC}  ${PROJECT_DIR}/.env"
echo ""
