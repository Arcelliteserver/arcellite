# Arcellite Full Codebase Audit Report

**Date:** 2025-01-21  
**Scope:** Security, Functionality, Design, Bug Hunt  
**Codebase:** React 19 + TypeScript + Node.js + PostgreSQL

---

## Executive Summary

| Category | Critical | High | Medium | Low | Info | Total |
|----------|----------|------|--------|-----|------|-------|
| Security | 3 | 3 | 5 | 4 | 2 | 17 |
| Functionality | 0 | 0 | 0 | 3 | 6 | 9 |
| Design | 0 | 3 | 4 | 5 | 4 | 16 |
| Bugs | 0 | 2 | 4 | 2 | 0 | 8 |
| **Total** | **3** | **8** | **13** | **14** | **12** | **50** |

**Top 5 Priority Fixes:**
1. **SEC-SQL-001** — Raw SQL execution via `executeQuery()` (CRITICAL)
2. **SEC-PT-004** — `serve-external` arbitrary file read (CRITICAL)
3. **SEC-SQL-007** — AI-generated SQL passthrough (CRITICAL)
4. **SEC-CI-005** — Command injection via tunnel token (HIGH)
5. **SEC-PT-001/002** — Path traversal on core file endpoints (HIGH)

---

## Phase 1: Security Audit

### SQL Injection

#### SEC-SQL-001 — Raw SQL execution via executeQuery() [CRITICAL]
- **File:** server/databases.ts `executeQuery()`
- **Issue:** `pool.query(sql)` executes user-supplied SQL with zero sanitization
- **Impact:** Full database compromise — read/write/drop any table
- **Fix:** Implement parameterized query builder or restrict to read-only operations with a whitelist

#### SEC-SQL-002 — Table name interpolation in getTableData/dropTable [MEDIUM]
- **File:** server/databases.ts
- **Issue:** Table names interpolated into SQL, guarded only by regex allowlist
- **Fix:** Use `pg-format` with `%I` identifier quoting

#### SEC-SQL-003 — CREATE TABLE column DEFAULT value interpolation [MEDIUM]
- **File:** server/databases.ts
- **Issue:** Column default values inserted into DDL via string concat
- **Fix:** Strengthen allowlist or use parameterized DDL generation

#### SEC-SQL-004 — Database name interpolation in CREATE/DROP DATABASE [LOW]
- **File:** server/databases.ts
- **Issue:** Names sanitized by `sanitizePgName()` — adequate but fragile
- **Fix:** Use `pg-format %I` for identifiers

#### SEC-SQL-005 — DROP DATABASE in deleteAccount with catalog value [MEDIUM]
- **File:** server/databases.ts
- **Issue:** Database name from `pg_database` catalog used in DROP statement
- **Fix:** Double-quote the identifier

#### SEC-SQL-006 — DROP DATABASE for MySQL with SCHEMA_NAME value [MEDIUM]
- **File:** server/databases.ts
- **Issue:** Similar to SEC-SQL-005 for MySQL databases
- **Fix:** Use proper escaping for MySQL identifiers

#### SEC-SQL-007 — AI-generated SQL passthrough [CRITICAL]
- **File:** server/ai.ts ~line 1740
- **Issue:** `executeQuery(dbId, action.sql)` — AI prompt injection → arbitrary SQL
- **Impact:** An adversarial AI prompt could execute DROP TABLE, data exfiltration, etc.
- **Fix:** Run AI SQL in read-only transaction, or present SQL for user approval before execution

#### SEC-SQL-008 — Dynamic UPDATE SET in family.service.ts [LOW]
- **File:** server/services/family.service.ts
- **Issue:** Dynamic column names in UPDATE — safe (hardcoded columns, parameterized values)
- **Status:** OK — no action needed

#### SEC-SQL-009 — SQLite PRAGMA with interpolated table name [MEDIUM]
- **File:** server/databases.ts
- **Issue:** Regex-guarded but should use proper quoting

### Path Traversal

#### SEC-PT-001 — File list/serve/download lack startsWith guard [HIGH]
- **File:** server/routes/files.routes.ts lines 238, 327, 402
- **Issue:** `path.join(baseDir, categoryDir, pathParam)` with no traversal check on read endpoints. Upload handler HAS the guard, but read handlers do NOT.
- **Fix:** Add `path.resolve()` + `startsWith(baseDir)` check before all file operations

#### SEC-PT-002 — Mkdir/create/delete/move lack startsWith guard [HIGH]
- **File:** server/routes/files.routes.ts lines 448-556
- **Issue:** POST endpoints accept `path` from body without traversal validation
- **Impact:** Authenticated user can delete arbitrary files: `path: "../../etc"`
- **Fix:** Same as SEC-PT-001

#### SEC-PT-003 — Share download joins file_path from DB without validation [MEDIUM]
- **File:** server/routes/share.routes.ts line 417
- **Issue:** `path.join(ownerStorage, share.file_path)` — malicious sharer could craft `../` in file_path
- **Fix:** Validate `fullPath.startsWith(ownerStorage)` after resolution

#### SEC-PT-004 — serve-external serves any absolute path [CRITICAL]
- **File:** server/routes/system.routes.ts line 541
- **Issue:** Only blocks `..` but does NOT validate allowed mount prefixes. Any absolute path like `/etc/passwd` is served.
- **Impact:** Arbitrary file read — `/etc/shadow`, SSH keys, DB credentials
- **Fix:** Add same ALLOWED prefix check used in `list-external` endpoint

### Command Injection

#### SEC-CI-005 — Tunnel token interpolated into exec() [HIGH]
- **File:** server/routes/domain.routes.ts line 251
- **Issue:** `exec(\`sudo cloudflared service install ${token}\`)` — no shell escaping
- **Impact:** Root-level arbitrary command execution
- **Fix:** Use `execFile`/`spawn` with argument arrays, or validate token format `/^[a-zA-Z0-9_\-\.]+$/`

#### SEC-CI-006 — SSL cert generation with execSync [LOW]
- **File:** server/services/security.service.ts line 246
- **Issue:** String interpolation in `execSync` — paths are server-controlled
- **Status:** Low risk — note for defense in depth

#### SEC-CI-007 — JSON.stringify used for shell quoting [MEDIUM]
- **Files:** server/files.ts line 298, server/routes/system.routes.ts line 447
- **Issue:** `JSON.stringify(path)` is not proper shell escaping — `$()` and backticks bypass
- **Fix:** Use `spawn`/`spawnSync` with argument arrays

### Authentication & Sessions

#### SEC-AUTH-008 — /api/system/storage returns data without auth [LOW]
- **File:** server/routes/system.routes.ts line 222
- **Issue:** Unauthenticated fallback returns disk sizes, mount points, device info
- **Fix:** Add auth check and return 401

#### SEC-AUTH-009 — System info/stats/USB endpoints lack auth [LOW]
- **File:** server/routes/system.routes.ts lines 186, 362
- **Issue:** `/api/system/info`, `/api/system/usb-events`, `/api/system/stats` unprotected
- **Fix:** Add auth middleware to these handlers

#### SEC-AUTH-010 — Session tokens in URL query parameters [MEDIUM]
- **File:** server/routes/share.routes.ts line 49
- **Issue:** Share download uses `?token=` in URLs — logged in browser history, proxies
- **Fix:** Use short-lived download tokens or cookie-based auth

#### SEC-AUTH-011 — 30-day sessions, no rotation [LOW]
- **File:** server/services/auth.service.ts
- **Issue:** Sessions valid 30 days with no token rotation. Bcrypt rounds = 10 (12+ recommended).
- **Positive:** Token generation uses `crypto.randomBytes(32)`, passwords never returned, timing-safe comparison

#### SEC-AUTH-012 — Storage request: family member check [OK]
- **File:** server/routes/auth.routes.ts line 1710
- **Status:** Properly guarded — verified

#### SEC-AUTH-013 — Share delete/keep: ownership check [OK]
- **File:** server/routes/share.routes.ts line 293
- **Status:** Properly guarded — verified

### Other Security Notes

- **Security headers:** Production server sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `X-XSS-Protection` ✅
- **CORS:** Configurable via `ALLOWED_ORIGIN` env var, defaults to no CORS header (same-origin) ✅  
- **Rate limiting:** Auth endpoints rate-limited (10 req/IP/60s) ✅
- **SSRF protection:** Webhook proxy blocks internal IPs, metadata endpoints, non-HTTP protocols ✅
- **CSP:** Defined in security.service.ts (allows `unsafe-inline` and `unsafe-eval` — could be tightened)
- **No dangerouslySetInnerHTML:** Zero occurrences in the component tree ✅
- **Credentials:** All from `process.env`, no hardcoded secrets ✅
- **File upload:** 10GB limit, streams to temp file, path traversal guard on upload ✅
- **No XSS via frontend:** React auto-escapes by default ✅

---

## Phase 2: Functionality Audit

### FUNC-001 — Duplicate external-file route handlers (dead code) [MINOR]
- **Files:** server/routes/files.routes.ts lines 783-835 vs server/routes/system.routes.ts lines 668-724
- **Issue:** `delete-external`, `rename-external`, `mkdir-external` defined in both files. `files.routes.ts` runs first → `system.routes.ts` versions are unreachable
- **Fix:** Remove the 3 duplicate handlers from system.routes.ts

### FUNC-002 — Backend routes with no frontend consumer [INFO]
- 5 endpoints have no frontend `fetch()` call:
  - `GET /api/analytics`
  - `GET /api/databases/get`
  - `POST /api/chat/generate-title`
  - `POST /api/files/create`
  - `POST /api/files/save-shared`
- These may be reserved for AI actions or future use

### FUNC-003 — TrashView.tsx missing Authorization headers [MINOR]
- **File:** components/views/system/TrashView.tsx lines 56, 107, 152, 193
- **Issue:** All 4 fetch calls lack `Authorization: Bearer` header. Cookie fallback covers it, but inconsistent with rest of codebase and fails if cookies are blocked.
- **Fix:** Add auth headers to all trash fetch calls

### FUNC-004 — ExportDataView.tsx missing Authorization headers [MINOR]
- **File:** components/views/system/ExportDataView.tsx line 41
- **Issue:** Export fetch calls lack auth headers
- **Fix:** Add auth headers

### FUNC-005 — Trash feature: fully wired ✅ [INFO]
### FUNC-006 — Notification endpoints: fully wired ✅ [INFO]
### FUNC-007 — ManageStorageView: all 4 API calls verified ✅ [INFO]
### FUNC-008 — SharedView: all 4 API calls verified ✅ [INFO]
### FUNC-009 — Zero orphaned frontend API calls ✅ [INFO]

---

## Phase 3: Design Audit

### Color Consistency

#### DES-001 — SharedView uses Tailwind purple instead of brand color [LOW]
- **File:** components/views/files/SharedView.tsx line 145
- **Issue:** `bg-purple-50 border-purple-100` instead of `bg-[#5D5FEF]/5`

#### DES-002 — DomainSetupView mixes purple-50 with brand color [LOW]
- **File:** components/views/settings/DomainSetupView.tsx line 809

#### DES-003 — FileListView uses violet/indigo for file-type colors [INFO]
- **File:** components/files/FileListView.tsx lines 136, 139
- Intentional semantic differentiators — acceptable

#### DES-004 — File thumbnail placeholders use non-brand colors [INFO]
- **File:** components/files/FileGrid.tsx lines 101-105

### Accessibility

#### DES-005 — Only 26 ARIA attributes across 64 components [HIGH]
- **Issue:** Interactive elements (icon buttons, menus, modals) overwhelmingly lack labels
- **Fix:** Audit all `<button>` without visible text; add `aria-label` everywhere

#### DES-006 — FileGrid lacks ARIA on cards, checkboxes, context menus [HIGH]
- **File:** components/files/FileGrid.tsx lines 346, 466, 476
- **Fix:** Add `aria-label`, `role="menu"`, `aria-selected`

#### DES-007 — FileListView action buttons lack ARIA labels [HIGH]
- **File:** components/files/FileListView.tsx lines 123, 188, 204

#### DES-008 — Sidebar missing navigation role [MEDIUM]
- **File:** components/sidebar/Sidebar.tsx
- **Fix:** Wrap in `<nav aria-label="Main navigation">`

#### DES-009 — SearchBar missing search role [MEDIUM]
- **File:** components/header/SearchBar.tsx
- **Fix:** Add `role="search"` and `aria-label`

### Images

#### DES-010 — Family member avatars have empty alt [MEDIUM]
- **File:** components/views/settings/FamilySharingView.tsx line 502
- **Fix:** `alt={member.name}`

#### DES-011 — Mobile family avatars have empty alt [MEDIUM]
- **File:** components/mobile/MobileFamilySharingView.tsx lines 428, 494

#### DES-012 — Database type icons have empty alt [LOW]
- **File:** components/views/system/DatabaseView.tsx line 464

#### DES-013 — Mobile database type icons empty alt [LOW]
- **File:** components/mobile/MobileDatabaseView.tsx line 733

#### DES-014 — Decorative icons use alt="" [INFO]
- **File:** components/views/files/SharedView.tsx — acceptable, add `aria-hidden="true"`

### Other Design

#### DES-015 — ManageStorageView loading states ✅ [PASS]
#### DES-016 — SharedView loading states ✅ [PASS]

#### DES-017 — Zero dark mode support [HIGH]
- **Issue:** No `dark:` Tailwind classes anywhere. Currently pure light theme.
- **Note:** This is an architectural decision, not necessarily a bug

#### DES-018 — Two conflicting error display patterns [MEDIUM]
- **Issue:** `showToast` callback prop vs local `setError` state. Should standardize on `useToast()` context

#### DES-019 — Raw error messages shown to users [LOW]
- **File:** components/views/features/MyAppsView.tsx lines 625, 903, 953
- **Fix:** Show user-friendly messages, log technical details

#### DES-020 — Inconsistent empty state styling [LOW]
- **Fix:** Create reusable `<EmptyState>` component

#### DES-021 — Dynamic empty text (good pattern) [INFO]
- **File:** components/views/settings/NotificationsView.tsx line 227

---

## Phase 4: Bug Hunt

### BUG-001 — Missing stream error handlers on .pipe() calls [HIGH]
- **Files:** server/routes/files.routes.ts lines 388, 398, 429; server/index.ts line 352
- **Issue:** `fs.createReadStream().pipe(res)` without `.on('error')` — I/O error crashes the process
- **Fix:** Add `stream.on('error', handler)` before every `.pipe(res)`

### BUG-002 — No graceful shutdown [HIGH]
- **File:** server/index.ts
- **Issue:** No `SIGTERM`/`SIGINT` handlers. PM2 restarts abort in-flight requests, leak PG connections.
- **Fix:** Add signal handlers that close server, drain pool, then exit

### BUG-003 — No global unhandledRejection handler [MEDIUM]
- **File:** server/index.ts
- **Issue:** Unhandled promise rejections crash or silently fail
- **Fix:** Add `process.on('unhandledRejection')` and `process.on('uncaughtException')`

### BUG-004 — Transfer progress setInterval leaks on unmount [MEDIUM]
- **File:** components/views/settings/AccountSettingsView.tsx line 490
- **Issue:** `setInterval` in onClick handler, never cleared on component unmount
- **Fix:** Store interval in ref, clear in useEffect cleanup

### BUG-005 — ErrorBoundary has no componentDidCatch [LOW]
- **File:** index.tsx line 7
- **Issue:** Errors caught but never logged — silent failures in production
- **Fix:** Add `componentDidCatch` with `console.error`

### BUG-006 — Notification polling every 3s with full payload [MEDIUM]
- **Files:** components/header/Header.tsx line 101, components/mobile/MobileHeader.tsx line 78
- **Issue:** Fetches 50 full notifications every 3s just to count unread ones (~20 req/min/client)
- **Fix:** Add `/api/notifications/unread-count` endpoint; increase poll interval to 15-30s; or use SSE

### BUG-007 — Duplicate USB SSE connections [LOW]
- **Files:** App.tsx line 161, StorageWidget.tsx line 66, RemovableStorageView.tsx line 254
- **Issue:** 3 separate EventSource connections to same endpoint
- **Fix:** Consolidate into shared `useUsbEvents()` context/hook

### BUG-008 — Static file serving path traversal [MEDIUM]
- **File:** server/index.ts lines 333-352
- **Issue:** `path.join(DIST, url)` without `startsWith` check
- **Fix:** Add `path.resolve()` + boundary check

---

## Recommendations by Priority

### Immediate (Critical/High)
1. Add path traversal validation to ALL file endpoint handlers (SEC-PT-001, SEC-PT-002, SEC-PT-004)
2. Restrict `executeQuery()` to parameterized queries or read-only mode (SEC-SQL-001)
3. Sandbox AI SQL execution in read-only transactions (SEC-SQL-007)
4. Fix command injection in tunnel token handler (SEC-CI-005)
5. Add stream error handlers to all `.pipe()` calls (BUG-001)
6. Implement graceful shutdown (BUG-002)

### Short-term (Medium)
7. Use `pg-format %I` for all identifier interpolation (SEC-SQL-002, 005, 006, 009)
8. Replace `JSON.stringify` shell quoting with `spawn` arrays (SEC-CI-007)
9. Use short-lived download tokens instead of session in URLs (SEC-AUTH-010)
10. Add global error handlers (BUG-003)
11. Fix notification polling efficiency (BUG-006)
12. Add auth headers to TrashView/ExportDataView (FUNC-003, 004)
13. Add ARIA labels to interactive elements (DES-005, 006, 007)
14. Standardize error display pattern (DES-018)

### Long-term (Low/Info)
15. Clean up dead code — duplicate route handlers (FUNC-001)
16. Consolidate SSE connections (BUG-007)
17. Add `componentDidCatch` logging (BUG-005)
18. Create reusable `<EmptyState>` component (DES-020)
19. Evaluate dark mode support (DES-017)
20. Increase bcrypt rounds to 12+ (SEC-AUTH-011)
