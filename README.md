<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="Version" />
<img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
<img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="Node" />
<img src="https://img.shields.io/badge/react-19-blue?style=flat-square" alt="React" />
<img src="https://img.shields.io/badge/typescript-5.8-blue?style=flat-square" alt="TypeScript" />

# Arcellite

**Your personal cloud. Self-hosted file management, AI assistant, and database tools — all in one.**

</div>

---

Arcellite is a minimalist, self-hosted personal cloud platform built with React and Node.js. It gives you full control over your files, databases, and connected services from a clean, modern interface — no third-party cloud required.

## Features

### File Management
- **Multi-category storage** — Organize files across General, Photos, Videos, and Music categories
- **Drag-and-drop upload** with real-time progress tracking
- **Grid and list views** with sorting and type filtering
- **File preview** — Inline image display, PDF thumbnails with cover art, video/audio playback
- **Folder navigation** with breadcrumb paths and accurate item counts
- **File operations** — Rename, move, download, delete with trash/restore support
- **Removable storage** — Mount and browse USB drives and external devices
- **Search** across all files and categories

### AI Assistant
- **Built-in chat** powered by DeepSeek (or any OpenAI-compatible API)
- **File-aware** — The AI knows your file system and can organize, move, and create files
- **Database-aware** — Query, create, and manage databases through natural conversation
- **Multi-step actions** — The AI can chain operations (create database → add tables → insert data)
- **Streaming responses** via Server-Sent Events

### Database Management
- **PostgreSQL integration** — Create, manage, and query databases from the UI
- **SQL editor** with syntax-highlighted results
- **Table browser** — View schemas, data, row counts, and sizes
- **AI-powered queries** — Ask questions in natural language, get SQL results

### Connected Apps
- **n8n workflows** — Connect to your n8n instance to trigger automations
- **MCP servers** — Connect Model Context Protocol servers
- **External databases** — Connect to remote PostgreSQL and MySQL instances

### System & Security
- **User authentication** with session management and multi-device support
- **Email verification** via SMTP (Gmail, custom providers)
- **Activity logging** and system stats (CPU, memory, network, storage)
- **Export data** — Full account data export as ZIP
- **PWA support** — Install as a standalone app on any device
- **Dark/light mode** with customizable appearance

## Quick Start

### One-command install (recommended)

The install script handles everything — Node.js, PostgreSQL, database setup, data directories, environment config, build, and optional systemd service:

```bash
git clone https://github.com/ArcelliteProject/arcellite.git
cd arcellite
chmod +x install.sh && ./install.sh
```

That's it. Open the URL shown at the end and complete the setup wizard.

---

<details>
<summary><strong>Manual setup</strong> (if you prefer doing it yourself)</summary>

#### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **npm** ≥ 9

#### 1. Clone and install

```bash
git clone https://github.com/ArcelliteProject/arcellite.git
cd arcellite
npm install
```

#### 2. Set up PostgreSQL

```sql
CREATE USER arcellite_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE arcellite OWNER arcellite_user;
GRANT ALL PRIVILEGES ON DATABASE arcellite TO arcellite_user;
ALTER USER arcellite_user CREATEDB;  -- allows AI to create user databases
```

#### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your database credentials and a random session secret
```

#### 4. Create data directories

```bash
mkdir -p ~/arcellite-data/{files,photos,videos,music,shared,databases}
```

#### 5. Run in development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the setup wizard will guide you through creating your first account.

#### 6. Run in production

```bash
npm run build          # Build the frontend
npm run build:server   # Compile the server
npm run server         # Start the production server
```

The server binds to `0.0.0.0:3999` by default (or the next available port).

</details>

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
│       ├── settings/          # Account, Appearance, API Keys
│       └── system/            # Stats, Logs, Database, Trash
├── server/
│   ├── index.ts               # Production HTTP server
│   ├── ai.ts                  # AI assistant (DeepSeek integration)
│   ├── databases.ts           # PostgreSQL database management
│   ├── files.ts               # File system operations
│   ├── storage.ts             # Storage & mount helpers
│   ├── trash.ts               # Trash management
│   ├── db/                    # App database (connection, schema)
│   ├── routes/                # API route handlers
│   └── services/              # Auth, email services
├── services/
│   └── api.client.ts          # Frontend API client
├── vite.config.ts             # Vite + dev API middleware
└── types.ts                   # Shared TypeScript types
```

## API Overview

| Endpoint | Description |
|----------|-------------|
| `GET /api/files/list` | List files and folders in a category/path |
| `POST /api/files/upload` | Upload files (multipart/form-data) |
| `GET /api/files/serve` | Serve/download a file |
| `POST /api/files/delete` | Delete files |
| `POST /api/ai/chat` | AI assistant (SSE streaming) |
| `GET /api/databases/list` | List managed databases |
| `POST /api/databases/create` | Create a new database |
| `POST /api/databases/query` | Execute SQL queries |
| `GET /api/system/stats` | System stats (CPU, memory, etc.) |
| `GET /api/trash/list` | List trashed items |
| `POST /api/auth/login` | User authentication |

## Configuration

### AI Models

Arcellite uses DeepSeek by default. To configure an API key:

1. Go to **Profile → AI Models → API Keys**
2. Enter your DeepSeek API key
3. The AI assistant is now ready to use

Any OpenAI-compatible API can be used by modifying the endpoint in `server/ai.ts`.

### Data Storage

All user data is stored under the data directory (default `~/arcellite-data/`):

```
~/arcellite-data/
├── files/       # General files
├── photos/      # Media/photos
├── videos/      # Video vault
├── music/       # Music library
├── shared/      # Shared files
├── databases/   # Database metadata
└── config/      # API keys, settings
```

### Removable Storage

Arcellite can mount and browse USB drives on Linux. Requires `udisksctl` and appropriate permissions. For password-protected mounts, the UI will prompt for credentials.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Lucide Icons, Recharts
- **Backend**: Node.js, custom HTTP server (Vite middleware in dev)
- **Database**: PostgreSQL (via `pg`)
- **AI**: DeepSeek API (OpenAI-compatible)
- **File handling**: `busboy` (uploads), `archiver` (exports)
- **Auth**: bcrypt, session tokens, SMTP email verification

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -am 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

MIT License — see [LICENSE](LICENSE) for details.

Copyright (c) 2026 Arcellite — Created by Robera Desissa
