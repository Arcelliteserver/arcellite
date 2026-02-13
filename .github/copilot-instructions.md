## Purpose
Quick context for AI coding agents working on Arcellite — a self-hosted personal cloud platform.

## Quick start (dev)
- Install: `npm install`
- Run dev server: `npm run dev` (Vite, bound to `0.0.0.0`)
- Build production: `npm run build && npm run build:server && npm run server`

## Architecture
- **Frontend**: React 19 + Vite + TypeScript. Entry: `App.tsx`. Components under `components/`.
- **Backend (dev)**: Vite middleware plugin in `vite.config.ts` — routes `/api/*` requests to `server/*.ts` via dynamic imports.
- **Backend (prod)**: Standalone Node server at `server/index.ts` → compiled to `server/dist/`.
- **Database**: PostgreSQL — app DB for auth/sessions/recent files, plus user-created databases.
- **AI**: DeepSeek API (OpenAI-compatible) in `server/ai.ts` with SSE streaming.

## Key files
| File | Purpose |
|------|---------|
| `App.tsx` | Main component, routing, file operations, state management |
| `vite.config.ts` | Dev server middleware — all API endpoints for dev mode |
| `server/ai.ts` | AI assistant — system prompt, DeepSeek proxy, action execution |
| `server/files.ts` | File system operations (list, serve, upload, delete) |
| `server/databases.ts` | PostgreSQL database CRUD, table/query operations |
| `server/routes/` | Production route handlers (auth, files, AI, trash, etc.) |
| `server/services/auth.service.ts` | User auth, sessions, recent files |
| `server/db/connection.ts` | PostgreSQL connection pool + schema init |
| `types.ts` | Shared TypeScript interfaces |

## Conventions
- File IDs: `server-<category>-<path>` (e.g., `server-general-docs/readme.txt`)
- Categories: `general` → `files/`, `media` → `photos/`, `video_vault` → `videos/`, `music` → `music/`
- Data directory: `~/arcellite-data/` (configurable via `ARCELLITE_DATA` env var)
- In dev, edit `server/*.ts` and Vite auto-reloads. For prod, run `npm run build:server`.

## Adding features
- **New API**: Create handler in `server/`, add route in `vite.config.ts` (dev) and `server/routes/` (prod)
- **UI changes**: Edit `components/` and `App.tsx`
- **AI actions**: Add to action handlers in `server/ai.ts` `executeAction()` and update system prompt
