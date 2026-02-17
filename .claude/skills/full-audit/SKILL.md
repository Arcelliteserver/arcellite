---
name: full-audit
description: Run all Arcellite audit skills in sequence — security, functionality, design, and bug hunt — producing a unified report with severity ratings
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(npm audit)
---

# Full Audit — Arcellite

Run a **comprehensive audit** of the entire Arcellite codebase covering all four domains. This is the master command that produces a unified report.

## Audit Sequence

Execute each audit domain in order. For each domain, follow the detailed instructions in the corresponding skill files:

### Phase 1: Security Audit
Follow the full instructions in `.claude/skills/security-audit/SKILL.md` and use the checklist from `.claude/skills/security-audit/checklist.md`.

Scan all server files for:
- SQL injection, path traversal, command injection
- Auth bypass, session vulnerabilities
- XSS, CSRF, SSRF vectors
- Hardcoded secrets, insecure dependencies
- Missing security headers, rate limiting

### Phase 2: Functionality Audit
Follow the full instructions in `.claude/skills/functionality-audit/SKILL.md` and reference `.claude/skills/functionality-audit/routes-matrix.md`.

For every UI component, verify:
- All buttons/forms have real handlers
- All handlers call real API endpoints
- All endpoints have real server logic (no stubs)
- Dev and production routes match
- Error states are shown to users

### Phase 3: Design Audit
Follow the full instructions in `.claude/skills/design-audit/SKILL.md`.

Check:
- Design consistency (spacing, colors, radius, fonts)
- Responsive breakpoints
- Desktop-mobile parity
- Loading, error, and empty states
- Accessibility (ARIA, focus, contrast, keyboard)

### Phase 4: Bug Hunt
Follow the full instructions in `.claude/skills/bug-hunt/SKILL.md`.

Hunt for:
- Race conditions, memory leaks
- Stale closures, unhandled errors
- Dead code, TypeScript safety issues
- Null/undefined access patterns
- Server-side bugs (connection leaks, hanging requests)

## Unified Report Format

Combine all findings into a single report sorted by severity:

```
# Full Audit Report — Arcellite
Generated: [date]

## Executive Summary
- Total Findings: X
- Critical: X | High: X | Medium: X | Low: X | Info: X

### By Domain
| Domain | Critical | High | Medium | Low | Info |
|--------|----------|------|--------|-----|------|
| Security | X | X | X | X | X |
| Functionality | X | X | X | X | X |
| Design | X | X | X | X | X |
| Bugs | X | X | X | X | X |

## Critical Findings (fix immediately)

### [SEC-001] SQL Injection in database query endpoint
- **Domain:** Security
- **Severity:** Critical
- **File:** `server/databases.ts:142`
- **Description:** ...
- **Fix:** ...

### [BUG-001] Race condition in state management
- **Domain:** Bugs
- **Severity:** Critical
- **File:** `App.tsx:89`
- **Description:** ...
- **Fix:** ...

## High Priority Findings (fix before release)
...

## Medium Priority Findings (fix soon)
...

## Low Priority Findings (fix when convenient)
...

## Info / Recommendations
...

## Checklist for Open-Source Readiness
- [ ] All critical and high findings resolved
- [ ] No hardcoded secrets in source code
- [ ] No API keys or credentials in the repository
- [ ] Error messages don't leak internal paths
- [ ] `.env.example` file exists with placeholder values
- [ ] `install.sh` sets secure file permissions
- [ ] README documents security requirements
- [ ] All dependencies are up to date (`npm audit` clean)
- [ ] No dead/sample/fake features visible to users
- [ ] Mobile and desktop feature parity achieved
```

Be thorough but concise. Every finding must have a specific file path, line number, code snippet, and actionable fix. Prioritize findings that would be exploitable or user-visible.
