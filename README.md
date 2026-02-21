<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="Version" />
<img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
<img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="Node" />
<img src="https://img.shields.io/badge/react-19-blue?style=flat-square" alt="React" />
<img src="https://img.shields.io/badge/typescript-5.8-blue?style=flat-square" alt="TypeScript" />
<img src="https://img.shields.io/badge/PM2-managed-blueviolet?style=flat-square" alt="PM2" />

# Arcellite

**Your personal cloud. Self-hosted file management, AI assistant, and database tools — all in one.**

</div>

---

Arcellite is a self-hosted personal cloud platform built with React and Node.js. It gives you full control over your files, databases, and AI assistant from a clean, modern interface — no third-party cloud required.

## Features

### File Management
- **Multi-category storage** — General, Photos, Videos, and Music categories
- **Drag-and-drop upload** with real-time progress tracking
- **Grid and list views** with sorting and type filtering
- **File preview** — Images, PDF thumbnails, video/audio playback
- **Folder navigation** with breadcrumb paths
- **File operations** — Rename, move, download, delete with trash/restore
- **Removable storage** — Mount and browse USB drives from the UI
- **Search** across all files and categories

### AI Assistant
- **Built-in chat** powered by DeepSeek (or any OpenAI-compatible API)
- **File-aware** — The AI knows your file system and can organize, move, and create files
- **Database-aware** — Query, create, and manage databases through natural conversation
- **Streaming responses** via Server-Sent Events

### Database Management
- **PostgreSQL & MySQL** — Create, manage, and query databases from the UI
- **SQL editor** with syntax-highlighted results
- **Table browser** — View schemas, data, row counts, and sizes
- **SQLite** — File-based databases, no setup required

### Security
- **Two-factor authentication** (2FA via TOTP — Google Authenticator, Authy)
- **Session management** with multi-device support
- **IP allowlist** (Strict Isolation mode)
- **Ghost folders** — Hidden folders not visible in the main UI
- **Screen lock** with PIN protection
- **Email verification** via SMTP

### System
- **Activity logging** and system stats (CPU, memory, network, storage)
- **Family sharing** — Multi-user support with storage quotas per member
- **Export data** — Full account data export as ZIP
- **PWA support** — Install as a standalone app on any device
- **Dark/light mode**

---

## Quick Start

### Requirements

- Linux server (Ubuntu 22.04+, Debian 12, Raspberry Pi OS 64-bit, Fedora)
- A user account with **sudo privileges**
- That's it — the installer handles everything else

### One-command install

```bash
git clone https://github.com/Roberadesissai/arcellite.git
cd arcellite
chmod +x install.sh && ./install.sh
```

Open `http://<your-server-ip>:3000` in your browser and complete the setup wizard.

### What the installer does

| Step | Action |
|------|--------|
| 1 | Install Node.js 20 (if not present) |
| 1b | Set up removable storage support (udisks2) |
| 2 | Install and configure PostgreSQL |
| 3 | Install MariaDB (for user-created MySQL databases) |
| 4 | SQLite (ready out of the box via sql.js) |
| 5 | Create `~/arcellite-data/` with all category folders |
| 6 | Generate `.env` with secure random credentials |
| 7 | Run `npm install` |
| 8 | Build the frontend and compile the server |
| 9 | Install PM2, start the app, configure auto-start on boot |
| 10 | Configure firewall securely: SSH (rate-limited), 3000, 80, 443 — database NOT exposed |
| 11 | Optional: install Cloudflare Tunnel for remote access |

---

## Fresh Reinstall

If you already have Arcellite installed and want to start completely fresh (new setup wizard, new account), run with the `--reset` flag:

```bash
./install.sh --reset
```

This will:
- Drop and recreate the PostgreSQL database (wipes all accounts and settings)
- Clear the config directory (`~/arcellite-data/config/`)
- Your uploaded files in `~/arcellite-data/` are **not** deleted

Without the flag, the installer will detect an existing installation and ask you interactively:

```
⚠  Existing Arcellite installation detected
Found 1 account(s) in the database from a previous install.

  Reset database and start fresh? (y/N):
```

---

## After Install

```bash
pm2 status              # Check if arcellite is running
pm2 logs arcellite      # View live logs
pm2 restart arcellite   # Restart after config changes
pm2 monit               # Real-time monitoring dashboard
```

---

## Updating

```bash
cd arcellite
git pull
npm install
npm run build
npm run build:server
pm2 restart arcellite
```

---

## Environment Variables

The `.env` file is generated automatically by `install.sh`. Key variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host (auto-detected) | `127.0.0.1` or `/var/run/postgresql` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `arcellite` |
| `DB_USER` | Database user | `arcellite_user` |
| `DB_PASSWORD` | Database password | *(auto-generated)* |
| `MYSQL_HOST` | MySQL host | `127.0.0.1` |
| `MYSQL_PORT` | MySQL port | `3306` |
| `SESSION_SECRET` | Session encryption key | *(auto-generated)* |
| `NODE_ENV` | Environment | `production` |
| `ARCELLITE_DATA` | Data storage path | `~/arcellite-data` |
| `SMTP_HOST` | Email server (optional) | `smtp.gmail.com` |
| `SMTP_PORT` | Email port | `587` |
| `SMTP_USER` | Email username | `you@gmail.com` |
| `SMTP_PASSWORD` | Email app password | *(your password)* |

---

## Security

The installer configures the firewall with a **secure-by-default** policy:

| Port | Rule | Reason |
|------|------|--------|
| SSH (auto-detected) | Rate-limited (`ufw limit`) | Blocks brute-force attacks — max 6 attempts/30s per IP |
| 3000 | Allowed | Arcellite web app |
| 80 | Allowed | HTTP (for reverse proxy / Cloudflare Tunnel) |
| 443 | Allowed | HTTPS |
| 5432 (PostgreSQL) | **Blocked** | Database stays localhost-only — never exposed to internet |
| Everything else | **Denied** | Default deny incoming |

**Connecting to PostgreSQL remotely** (DataGrip, DBeaver, etc.):

The database is intentionally not exposed publicly. Use an SSH tunnel instead:

```bash
# On your local machine — forwards localhost:5432 → server's localhost:5432
ssh -L 5432:127.0.0.1:5432 your_user@your_server_ip

# Then connect your DB tool to: localhost:5432
```

This is significantly more secure than opening a database port to the internet.

---

## Troubleshooting

### Can't reach the app — `ERR_CONNECTION_TIMED_OUT`

The installer automatically opens port 3000. If you still can't connect:

```bash
# 1. Check if the app is running
pm2 status
pm2 logs arcellite

# 2. Check firewall status
sudo ufw status verbose

# 3. Manually open port 3000 if missing
sudo ufw limit ssh        # ALWAYS do this first to protect yourself
sudo ufw allow 3000/tcp
sudo ufw reload
```

Then try `http://<your-ip>:3000` again.

### Setup wizard doesn't appear — shows login instead

This means a previous installation's data is still in the PostgreSQL database. Run:

```bash
./install.sh --reset
```

Or wipe the database manually:

```bash
sudo -u postgres psql -c "DROP DATABASE arcellite;"
sudo -u postgres psql -c "CREATE DATABASE arcellite OWNER arcellite_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE arcellite TO arcellite_user;"
pm2 restart arcellite
```

### MySQL warnings during install

```
[WARN]  Could not access MySQL as root. Configure the MySQL user manually.
```

This is non-critical. PostgreSQL is the primary database. MySQL/MariaDB is only used for user-created MySQL databases through the Database Manager UI. The app works fully without it.

To fix manually:

```bash
sudo mysql
CREATE USER IF NOT EXISTS 'arcellite_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON `arcellite_%`.* TO 'arcellite_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Then update `MYSQL_PASSWORD` in `.env` and run `pm2 restart arcellite`.

### PM2 shows `errored` status

```bash
pm2 logs arcellite --lines 50   # See the crash reason
pm2 restart arcellite
```

Common causes:
- Database not running: `sudo systemctl restart postgresql`
- Wrong `.env` credentials: check `DB_HOST`, `DB_PASSWORD` in `.env`
- Port 3000 already in use: `sudo lsof -i :3000`

### App starts but shows a blank page

```bash
npm run build
pm2 restart arcellite
```

### Lost SSH access after install (firewall locked you out)

If you somehow lost SSH access (e.g., running install on a remote machine via console):

```bash
# From the server console / recovery mode:
sudo ufw allow ssh
sudo ufw reload
# Or disable UFW temporarily:
sudo ufw disable
```

The installer always allows SSH before enabling UFW, so this should not happen with the current version.

### Sudo password fails during install

```bash
# Add your user to sudoers (run as root)
usermod -aG sudo your_username
# Then log out, log back in, and re-run install.sh
```

---

## Manual Setup

<details>
<summary>Prefer setting things up yourself?</summary>

### Prerequisites

- Node.js ≥ 18
- PostgreSQL ≥ 14
- PM2 (`npm install -g pm2`)
- npm ≥ 9

### 1. Clone and install

```bash
git clone https://github.com/Roberadesissai/arcellite.git
cd arcellite
npm install
```

### 2. Set up PostgreSQL

```sql
CREATE USER arcellite_user WITH PASSWORD 'your_secure_password' CREATEDB;
CREATE DATABASE arcellite OWNER arcellite_user;
GRANT ALL PRIVILEGES ON DATABASE arcellite TO arcellite_user;
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 4. Create data directories

```bash
mkdir -p ~/arcellite-data/{files,photos,videos,music,shared,databases,config}
```

### 5. Build and run

```bash
npm run build           # Build frontend
npm run build:server    # Compile backend
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 6. Open the firewall

```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

Open `http://localhost:3000` — the setup wizard will guide you through creating your admin account.

</details>

---

## Project Structure

```
├── App.tsx                    # Main application component
├── components/
│   ├── auth/                  # Login, setup wizard
│   ├── files/                 # FileGrid, FileDetails, FileIcon
│   ├── header/                # Header, search, notifications
│   ├── sidebar/               # Navigation, storage widget
│   └── views/
│       ├── features/          # AI Chat, My Apps, Help
│       ├── files/             # Files browser, Shared view
│       ├── settings/          # Account, Appearance, API Keys, Family Sharing
│       └── system/            # Stats, Logs, Database, Trash, Security Vault
├── hooks/                     # Custom React hooks (auth, files, upload, layout)
├── server/
│   ├── index.ts               # Production HTTP server
│   ├── ai.ts                  # AI assistant integration
│   ├── databases.ts           # Database management
│   ├── files.ts               # File system operations
│   ├── db/                    # PostgreSQL connection and schema
│   ├── routes/                # API route handlers (23 modules)
│   └── services/              # Auth, email, security, family services
├── services/
│   └── api.client.ts          # Frontend API client
├── vite.config.ts             # Vite + dev API middleware
├── ecosystem.config.cjs       # PM2 configuration (auto-generated)
├── install.sh                 # One-command installer
└── types.ts                   # Shared TypeScript types
```

---

## API Overview

| Endpoint | Description |
|----------|-------------|
| `GET /api/files/list` | List files and folders |
| `POST /api/files/upload` | Upload files (multipart/form-data) |
| `GET /api/files/serve` | Serve / download a file |
| `POST /api/files/delete` | Delete files |
| `POST /api/ai/chat` | AI assistant (SSE streaming) |
| `GET /api/databases/list` | List managed databases |
| `POST /api/databases/create` | Create a new database |
| `POST /api/databases/query` | Execute SQL queries |
| `GET /api/system/stats` | System stats (CPU, memory, etc.) |
| `GET /api/trash/list` | List trashed items |
| `POST /api/auth/login` | User authentication |

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Node.js 20, TypeScript, PM2
- **Database**: PostgreSQL (primary), MySQL/MariaDB, SQLite (via sql.js)
- **AI**: DeepSeek, OpenAI, Anthropic, Google Gemini, Grok, Qwen, Ollama
- **File handling**: busboy (uploads), archiver (exports), sharp (image processing)
- **Auth**: bcrypt, session tokens, SMTP email verification, otplib (2FA)
- **PWA**: Service worker, installable on any device

---

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

Copyright (c) 2026 Arcellite — Created by Robera Desissa
