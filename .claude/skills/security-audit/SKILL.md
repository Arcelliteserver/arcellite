---
name: security-audit
description: Deep security audit of the Arcellite codebase — finds SQL injection, path traversal, command injection, auth bypass, XSS, hardcoded secrets, and other OWASP Top 10 vulnerabilities
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(npm audit)
---

# Security Audit

You are a senior application security engineer performing a thorough security audit of **Arcellite**, a self-hosted personal cloud platform (Node.js + React + PostgreSQL). This app may be open-sourced, so every finding matters.

## Audit Scope

Scan the **entire codebase** methodically. Do NOT skim — read every server file and every route handler line by line. Use the checklist in [checklist.md](checklist.md) as your reference.

## Critical Files to Audit

### Server-side (highest priority)
- `server/index.ts` — HTTP server, auth middleware, request routing
- `server/files.ts` — File system operations (upload, serve, delete, move)
- `server/databases.ts` — PostgreSQL operations, raw SQL execution
- `server/ai.ts` — AI chat, action execution, system prompt building
- `server/stats.ts` — System stats, shell commands (`exec`)
- `server/storage.ts` — USB mount/unmount, `lsblk`, filesystem ops
- `server/trash.ts` — Trash operations, file deletion
- `server/analytics.ts` — File analytics
- `server/notifications.ts` — Notification system
- `server/services/auth.service.ts` — Auth, sessions, password hashing
- `server/services/email.service.ts` — SMTP email sending
- `server/services/transfer.service.ts` — USB data transfer
- `server/db/connection.ts` — Database pool, schema initialization
- `server/db/schema.sql` — Table definitions, constraints
- `server/routes/*.ts` — All route handlers

### Client-side
- `vite.config.ts` — Dev server middleware (has API route handlers!)
- `services/api.client.ts` — API client, token handling
- `App.tsx` — Auth state management
- `components/auth/AuthView.tsx` — Login/register forms

### Configuration
- `.env` or environment variable handling
- `config/api-keys.json` — API key storage
- `install.sh` — Installation script security

## What to Check

### 1. SQL Injection (CRITICAL)
- Search for string concatenation or template literals in SQL queries
- Verify ALL queries use parameterized queries (`$1, $2` placeholders)
- Pay special attention to `server/databases.ts` (user-created databases, raw query execution)
- Check the AI's `query` action in `server/ai.ts`

### 2. Path Traversal (CRITICAL)
- Check ALL file path construction in `server/files.ts`
- Verify `../` sequences are blocked or paths are resolved and validated
- Check that file serving cannot escape `~/arcellite-data/`
- Audit `server/storage.ts` for path manipulation
- Check `list-external` and `serve-external` endpoints (absolute path access!)

### 3. Command Injection (CRITICAL)
- Find all uses of `exec()`, `execSync()`, `spawn()`, `child_process`
- Check `server/stats.ts` — system stats commands
- Check `server/storage.ts` — `mount`, `umount`, `lsblk` commands
- Verify user input never flows into shell commands unsanitized

### 4. Authentication & Authorization
- Verify session token validation on ALL protected routes
- Check for routes that skip auth (should only be login/register/setup-status)
- Verify password hashing (bcrypt with sufficient rounds)
- Check session token generation (cryptographically secure?)
- Verify max session limit (4 devices) is enforced
- Check for timing attacks in auth comparisons
- Verify email verification cannot be bypassed

### 5. XSS / Injection
- Search for `dangerouslySetInnerHTML` in React components
- Check if user-supplied filenames are rendered unsafely
- Verify URL parameters are sanitized before use
- Check AI chat output rendering for injection vectors

### 6. Sensitive Data Exposure
- Search for hardcoded passwords, API keys, tokens in source
- Check if `.env` values are exposed to the frontend
- Verify API keys file permissions
- Check if error messages leak internal paths or stack traces
- Verify passwords are never logged or returned in API responses

### 7. Insecure Dependencies
- Run `npm audit` and report findings
- Check for known vulnerable package versions

### 8. Missing Security Headers
- Check for CORS configuration
- Check for CSP (Content Security Policy)
- Check for X-Frame-Options, X-Content-Type-Options
- Check for rate limiting on auth endpoints

### 9. File Upload Security
- Check file size limits
- Check file type validation
- Verify uploaded files can't be executed
- Check for zip bomb / decompression attacks

### 10. SSRF / External Requests
- Check AI API calls — can user input influence the target URL?
- Check email sending — can user control recipient or content unsafely?

## Output Format

Produce a **Markdown report** with this structure:

```
# Security Audit Report — Arcellite

## Summary
- Critical: X findings
- High: X findings
- Medium: X findings
- Low: X findings
- Info: X findings

## Critical Findings

### [SEC-001] Title
- **Severity:** Critical
- **Category:** SQL Injection
- **File:** `server/databases.ts:142`
- **Description:** ...
- **Proof:** Show the vulnerable code snippet
- **Fix:** Specific remediation steps

## High Findings
...

## Recommendations
Prioritized list of security improvements
```

Be specific. Reference exact file paths and line numbers. Show the actual vulnerable code. Do NOT produce generic advice — every finding must be backed by real code you read.
