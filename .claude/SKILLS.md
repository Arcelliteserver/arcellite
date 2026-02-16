# Arcellite — Project Skills Reference

> Self-hosted personal cloud platform. File management, AI assistant, database tools, and USB device transfer — all from a browser.

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Dev server (Vite, port 3000, host 0.0.0.0)
npm run build        # Build frontend
npm run build:server # Compile server TypeScript
npm run server       # Production server (builds + starts)
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React 19 + Vite + TypeScript)                 │
│  App.tsx → components/views/* → services/api.client.ts  │
├─────────────────────────────────────────────────────────┤
│  /api/* routes                                          │
│  Dev:  Vite middleware plugin (vite.config.ts)           │
│  Prod: Node HTTP server (server/index.ts)               │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (pg pool, server/db/connection.ts)           │
│  App DB: auth, sessions, activity, notifications        │
│  User DBs: created via Database Manager UI              │
├─────────────────────────────────────────────────────────┤
│  Filesystem: ~/arcellite-data/                          │
│  ├── files/  photos/  videos/  music/  shared/          │
│  ├── databases/metadata.json                            │
│  ├── config/api-keys.json                               │
│  └── .trash/ (30-day retention)                         │
└─────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Main component — routing, file ops, state management |
| `vite.config.ts` | Dev server middleware — all `/api/*` routes in dev mode |
| `server/index.ts` | Production HTTP server entry point |
| `server/ai.ts` | DeepSeek AI — system prompt, SSE streaming, action execution |
| `server/files.ts` | File system operations (list, upload, delete, move) |
| `server/databases.ts` | PostgreSQL database CRUD, table/query ops |
| `server/trash.ts` | Trash with 30-day retention + metadata |
| `server/storage.ts` | Root filesystem + removable USB device detection |
| `server/stats.ts` | CPU, memory, network, uptime, security, logs |
| `server/analytics.ts` | File category analytics + health index |
| `server/notifications.ts` | Real-time system alerts (CPU, memory, disk) |
| `server/db/connection.ts` | PostgreSQL pool + schema init |
| `server/db/schema.sql` | 8 tables: users, sessions, recent_files, file_metadata, connected_apps, user_settings, activity_log, notifications |
| `server/services/auth.service.ts` | User auth, sessions, device tracking (max 4) |
| `server/services/email.service.ts` | Branded HTML emails — verification, file delivery, support |
| `server/services/transfer.service.ts` | USB data transfer between devices |
| `services/api.client.ts` | Frontend API client with Bearer token injection |
| `types.ts` | Shared TypeScript interfaces |
| `constants.tsx` | AI model definitions |
| `install.sh` | Full production installer (7 steps: deps, PostgreSQL, dirs, env, npm, build, systemd) |

## API Routes

### Auth (`/api/auth/*`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create admin user (first-time only) |
| POST | `/api/auth/login` | Authenticate, returns session token |
| POST | `/api/auth/verify-email` | Verify email with 6-digit code |
| POST | `/api/auth/resend-code` | Resend verification code |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Destroy session |
| PUT | `/api/auth/profile` | Update profile (name, avatar) |
| POST | `/api/auth/complete-setup` | Mark setup wizard complete |
| GET | `/api/auth/sessions` | List active sessions |
| DELETE | `/api/auth/sessions/:id` | Revoke a session |
| DELETE | `/api/auth/account` | Delete entire account |
| GET | `/api/auth/settings` | Get user settings |
| PUT | `/api/auth/settings` | Update user settings |
| GET | `/api/auth/activity` | Get activity log |
| GET | `/api/auth/setup-status` | Check if setup is needed |

### Files (`/api/files/*`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/files/upload` | Upload files (multipart/Busboy) |
| GET | `/api/files/list` | List files (`?category=&path=`) |
| GET | `/api/files/serve` | Serve file content |
| GET | `/api/files/download` | Download with Content-Disposition |
| POST | `/api/files/mkdir` | Create directory |
| POST | `/api/files/create` | Create folder |
| POST | `/api/files/delete` | Delete file/folder |
| POST | `/api/files/move` | Move/rename |
| GET | `/api/files/list-external` | List files at absolute path (USB) |
| GET | `/api/files/serve-external` | Serve from absolute path |
| GET | `/api/files/recent` | Get recently accessed files |
| POST | `/api/files/track-recent` | Track file access |

### Trash (`/api/trash/*`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trash/list` | List trash items |
| POST | `/api/trash/restore` | Restore from trash |
| POST | `/api/trash/delete` | Permanently delete |
| POST | `/api/trash/empty` | Empty trash |
| POST | `/api/trash/move-to-trash` | Move to trash |

### Databases (`/api/databases/*`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/databases/list` | List all user databases |
| GET | `/api/databases/get?id=` | Get database details |
| POST | `/api/databases/create` | Create PostgreSQL database |
| POST | `/api/databases/delete` | Drop database |
| GET | `/api/databases/tables?id=` | List tables with row counts |
| GET | `/api/databases/columns?id=&table=` | Get column schema |
| GET | `/api/databases/data?id=&table=` | Get rows (limit/offset) |
| POST | `/api/databases/create-table` | Create table |
| POST | `/api/databases/drop-table` | Drop table |
| POST | `/api/databases/query` | Execute SQL |

### AI (`/api/ai/*`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/keys/save` | Save API keys |
| GET | `/api/ai/keys/load` | Load API keys |
| POST | `/api/ai/keys/test` | Test provider connection |
| POST | `/api/ai/chat` | Chat with AI (SSE streaming) |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/system/storage` | Root filesystem + removable devices |
| GET | `/api/system/stats` | CPU, memory, network, uptime, logs |
| POST | `/api/system/mount` | Mount USB device |
| POST | `/api/system/unmount` | Unmount device |
| GET | `/api/analytics` | File stats + health index |
| GET | `/api/notifications` | Get notifications |

### Transfer (`/api/transfer/*`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transfer/prepare` | Package data to USB |
| GET | `/api/transfer/status` | Transfer progress |
| GET | `/api/transfer/detect` | Detect transfer data on USB |
| POST | `/api/transfer/import` | Import from USB |

### Other
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/support/submit` | Contact support + AI auto-reply |
| GET | `/api/export/json` | Export all data as JSON |
| GET | `/api/export/csv` | Export file listing as CSV |
| GET | `/api/export/backup` | Full ZIP backup |

## AI System

**Provider**: DeepSeek API (OpenAI-compatible, `deepseek-chat` model)

### Action Types
The AI can execute filesystem and database actions via structured `action` blocks:

| Action | Description |
|--------|-------------|
| `create_file` | Create text file with content |
| `create_folder` | Create directory |
| `delete` / `trash` | Delete or trash files |
| `rename` / `move_file` | Rename or move files |
| `organize` | Auto-organize files by type |
| `list` / `list_databases` / `list_trash` | List items |
| `create_database` / `delete_database` | Manage databases |
| `create_table` / `query` | Table operations + SQL |
| `show_image` / `show_file` | Display media in chat |
| `send_email` | Email file attachments |
| `cast` | Cast media to smart devices |
| `restore_from_trash` / `delete_from_trash` / `empty_trash` | Trash management |

### Chat Flow (SSE)
1. Build system prompt with live filesystem + database context
2. Send to DeepSeek API
3. Parse `action` blocks from response
4. Stream text via `event: text`, results via `event: action`
5. Auto-continue with action results (max 8 iterations)
6. End with `event: done`

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Single admin user (email, password_hash, name, avatar, verification) |
| `sessions` | Session tokens with device tracking (name, type, IP, max 4) |
| `recent_files` | Recently accessed files with disk validation |
| `file_metadata` | Favorites, tags (TEXT[]), custom properties (JSONB) |
| `connected_apps` | Third-party integrations |
| `user_settings` | Theme, language, notification prefs (JSONB) |
| `activity_log` | User action audit trail |
| `notifications` | In-app alerts (info/warning/success/error) |

## Frontend Components

### Layout
- `App.tsx` — Root component, routing, top-level state
- `Header` — Top nav with search, notifications, profile
- `Sidebar` — Navigation + storage widget

### Views
- `FilesView` — Main file browser with category tabs
- `ChatView` — AI chat interface with SSE streaming
- `DatabaseView` — Database management (create, browse, query)
- `AccountSettingsView` — Profile, AI model, devices, danger zone, transfer
- `ServerView` — Server dashboard (CPU, memory, network)
- `TrashView` — Trash management with restore
- `RemovableStorageView` — USB device management
- `SetupWizard` — First-time onboarding + transfer import

### Auth
- `AuthView` — Login/register with email verification
- `SetupWizard` — Multi-step setup + USB transfer detection

## Conventions

- **File IDs**: `server-<category>-<path>` (e.g., `server-general-docs/readme.txt`)
- **Categories**: `general→files/`, `media→photos/`, `video_vault→videos/`, `music→music/`
- **Data directory**: `~/arcellite-data/` (env `ARCELLITE_DATA`)
- **Session**: Bearer token in `Authorization` header, stored in `localStorage`
- **Max devices**: 4 concurrent sessions
- **Trash retention**: 30 days
- **DB naming**: User databases are prefixed `arcellite_`

## Adding Features

### New API endpoint
1. Create handler in `server/` or `server/routes/`
2. Add route in `vite.config.ts` (dev) and `server/routes/index.ts` (prod)

### New UI view
1. Create component in `components/views/<category>/`
2. Add nav entry in `SidebarNavigation.tsx`
3. Add route case in `App.tsx`

### New AI action
1. Add handler in `server/ai.ts` → `executeAction()`
2. Update the system prompt in `buildSystemPrompt()`

### New email template
1. Add function in `server/services/email.service.ts`
2. Use `emailLayout()` wrapper with `headerTitle`, `headerSubtitle`, `bodyHtml`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port (default 5432) |
| `DB_NAME` | Database name (default: `arcellite`) |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `SESSION_SECRET` | Session signing secret |
| `NODE_ENV` | `production` or `development` |
| `ARCELLITE_DATA` | Data directory path |
| `SMTP_HOST` | SMTP server for system emails |
| `SMTP_PORT` | SMTP port (465 for SSL) |
| `SMTP_USER` / `SMTP_PASSWORD` | SMTP credentials |
| `SMTP_FROM` | System email from address |
| `AI_SMTP_*` | Optional separate SMTP for AI emails |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS |
| Icons | Lucide React |
| Charts | Recharts |
| PDF | pdfjs-dist |
| Backend | Node.js, custom HTTP server |
| Database | PostgreSQL (pg driver) |
| Auth | bcrypt + session tokens |
| Email | Nodemailer (Hostinger SMTP) |
| AI | DeepSeek API (OpenAI-compatible) |
| File Upload | Busboy (multipart) |
| Export | Archiver (ZIP) |
| PWA | Service Worker + manifest.json |
