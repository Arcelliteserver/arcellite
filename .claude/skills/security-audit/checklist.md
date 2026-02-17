# Security Audit Checklist — OWASP Aligned

## A01: Broken Access Control
- [ ] All API endpoints require authentication (except public routes)
- [ ] Session tokens are validated on every request
- [ ] Users cannot access other users' files/data
- [ ] Admin-only operations are properly gated
- [ ] File serving is restricted to the user's data directory
- [ ] `serve-external` and `list-external` endpoints validate paths
- [ ] Directory traversal (`../`) is blocked in all file operations
- [ ] USB mount points are validated before operations

## A02: Cryptographic Failures
- [ ] Passwords hashed with bcrypt (cost >= 10)
- [ ] Session tokens generated with `crypto.randomBytes` or equivalent
- [ ] No secrets hardcoded in source code
- [ ] API keys stored securely (file permissions, not in repo)
- [ ] HTTPS enforced (or documented as requirement)
- [ ] No sensitive data in URL query parameters
- [ ] Session tokens have expiration

## A03: Injection
- [ ] All SQL queries use parameterized placeholders ($1, $2)
- [ ] No string concatenation in SQL queries
- [ ] User input in `databases.ts` query endpoint is parameterized
- [ ] AI action execution sanitizes parameters
- [ ] Shell commands in `stats.ts` don't include user input
- [ ] Shell commands in `storage.ts` (mount/umount) sanitize device paths
- [ ] File paths are resolved and validated before filesystem operations
- [ ] Email content is properly escaped

## A04: Insecure Design
- [ ] Rate limiting on login/register endpoints
- [ ] Account lockout after failed attempts
- [ ] Email verification required before full access
- [ ] Session limit (max 4) properly enforced
- [ ] Trash deletion is permanent and complete
- [ ] Database names are validated/sanitized before CREATE DATABASE

## A05: Security Misconfiguration
- [ ] Error messages don't leak stack traces in production
- [ ] Debug/development endpoints disabled in production
- [ ] Default credentials don't exist
- [ ] CORS is restrictive (not `*`)
- [ ] Security headers set (CSP, X-Frame-Options, etc.)
- [ ] Directory listing disabled
- [ ] `install.sh` sets proper file permissions

## A06: Vulnerable and Outdated Components
- [ ] Run `npm audit` — no critical/high vulnerabilities
- [ ] Dependencies are reasonably up to date
- [ ] No abandoned/unmaintained packages in critical paths

## A07: Identification and Authentication Failures
- [ ] Password complexity requirements enforced
- [ ] Brute force protection on login
- [ ] Session invalidation on logout works completely
- [ ] Session tokens rotated after privilege changes
- [ ] "Delete account" actually purges all data
- [ ] Password not returned in any API response

## A08: Software and Data Integrity Failures
- [ ] File uploads validated (type, size)
- [ ] AI responses sanitized before rendering
- [ ] Database import/export validates data integrity
- [ ] USB transfer data is validated before import

## A09: Security Logging and Monitoring Failures
- [ ] Failed login attempts are logged
- [ ] File access/deletion is logged
- [ ] Admin actions are logged in activity_log
- [ ] Logs don't contain sensitive data (passwords, tokens)

## A10: Server-Side Request Forgery (SSRF)
- [ ] AI API endpoint URL is hardcoded (not user-controllable)
- [ ] Email recipient validation prevents arbitrary sending
- [ ] No user-controlled URLs fetched server-side without validation
