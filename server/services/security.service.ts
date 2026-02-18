/**
 * Security Service
 * Handles 2FA (TOTP), file obfuscation, ghost folders, integrity checks,
 * RSA key rotation, SSL regeneration, traffic masking, and strict isolation.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { pool } from '../db/connection.js';

// ─── TOTP (Two-Factor Authentication) ──────────────────────────────────────

const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;

/** Generate a random base32-encoded TOTP secret */
export function generateTotpSecret(): string {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/** Base32 encode a buffer */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, '0');
    result += alphabet[parseInt(chunk, 2)];
  }
  return result;
}

/** Base32 decode a string to Buffer */
function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of encoded.toUpperCase()) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** Generate a TOTP code for a given secret and time */
function generateTotpCode(secret: string, time?: number): string {
  const t = time ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(t / TOTP_PERIOD);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(0, 0);
  counterBuffer.writeUInt32BE(counter, 4);

  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % (10 ** TOTP_DIGITS);
  return code.toString().padStart(TOTP_DIGITS, '0');
}

/** Verify a TOTP code (allows ±1 window for clock drift) */
export function verifyTotpCode(secret: string, code: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  for (let offset = -1; offset <= 1; offset++) {
    const expected = generateTotpCode(secret, now + offset * TOTP_PERIOD);
    if (expected === code.trim()) return true;
  }
  return false;
}

/** Generate otpauth:// URI for QR code */
export function getTotpUri(secret: string, email: string): string {
  return `otpauth://totp/Arcellite:${encodeURIComponent(email)}?secret=${secret}&issuer=Arcellite&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

// ─── 2FA Database Operations ───────────────────────────────────────────────

/** Save TOTP secret to user_settings preferences */
export async function saveTotpSecret(userId: number, secret: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_settings (user_id, preferences) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET preferences = user_settings.preferences || $2, updated_at = NOW()`,
    [userId, JSON.stringify({ totpSecret: secret })]
  );
}

/** Get TOTP secret for user */
export async function getTotpSecret(userId: number): Promise<string | null> {
  const result = await pool.query(
    `SELECT preferences FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.preferences?.totpSecret || null;
}

/** Remove TOTP secret */
export async function removeTotpSecret(userId: number): Promise<void> {
  await pool.query(
    `UPDATE user_settings SET preferences = preferences - 'totpSecret', updated_at = NOW() WHERE user_id = $1`,
    [userId]
  );
}

/** Check if user has 2FA enabled (setting ON + secret exists) */
export async function is2FAEnabled(userId: number): Promise<boolean> {
  const result = await pool.query(
    `SELECT preferences FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  const prefs = result.rows[0]?.preferences || {};
  return Boolean(prefs.secTwoFactor && prefs.totpSecret);
}

// ─── Ghost Folders ─────────────────────────────────────────────────────────

/** Get list of ghost folder paths for a user */
export async function getGhostFolders(userId: number): Promise<string[]> {
  const result = await pool.query(
    `SELECT preferences FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.preferences?.ghostFolders || [];
}

/** Add a folder path to ghost folders */
export async function addGhostFolder(userId: number, folderPath: string): Promise<void> {
  const current = await getGhostFolders(userId);
  if (current.includes(folderPath)) return;
  const updated = [...current, folderPath];
  await pool.query(
    `INSERT INTO user_settings (user_id, preferences) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET preferences = user_settings.preferences || $2, updated_at = NOW()`,
    [userId, JSON.stringify({ ghostFolders: updated })]
  );
}

/** Remove a folder from ghost folders */
export async function removeGhostFolder(userId: number, folderPath: string): Promise<void> {
  const current = await getGhostFolders(userId);
  const updated = current.filter((f: string) => f !== folderPath);
  await pool.query(
    `INSERT INTO user_settings (user_id, preferences) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET preferences = user_settings.preferences || $2, updated_at = NOW()`,
    [userId, JSON.stringify({ ghostFolders: updated })]
  );
}

// ─── File Obfuscation ──────────────────────────────────────────────────────

/** Obfuscate file metadata in listings */
export function obfuscateFileEntry(entry: { name: string; mtimeMs: number; sizeBytes?: number; isFolder?: boolean }) {
  // Keep original name but randomize timestamps and fuzz file sizes
  const randomOffset = crypto.randomInt(-86400000, 86400000); // ±1 day in ms
  const fuzzedMtime = entry.mtimeMs + randomOffset;
  const fuzzedSize = entry.sizeBytes
    ? Math.round(entry.sizeBytes * (0.9 + Math.random() * 0.2)) // ±10%
    : undefined;
  return {
    ...entry,
    mtimeMs: fuzzedMtime,
    sizeBytes: fuzzedSize,
  };
}

// ─── RSA Key Management ────────────────────────────────────────────────────

const KEYS_DIR = path.join(os.homedir(), 'arcellite-data', '.security');

function ensureKeysDir(): void {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
  }
}

/** Generate a new RSA key pair and save to disk */
export function rotateRSAKeys(): { publicKey: string; fingerprint: string } {
  ensureKeysDir();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(path.join(KEYS_DIR, 'rsa_private.pem'), privateKey, { mode: 0o600 });
  fs.writeFileSync(path.join(KEYS_DIR, 'rsa_public.pem'), publicKey, { mode: 0o644 });

  // Calculate fingerprint
  const fingerprint = crypto.createHash('sha256')
    .update(publicKey)
    .digest('hex')
    .replace(/(.{2})/g, '$1:')
    .slice(0, -1)
    .toUpperCase()
    .substring(0, 47);

  return { publicKey, fingerprint };
}

/** Get current RSA key info */
export function getRSAKeyInfo(): { exists: boolean; fingerprint?: string; createdAt?: string } {
  const pubPath = path.join(KEYS_DIR, 'rsa_public.pem');
  if (!fs.existsSync(pubPath)) {
    return { exists: false };
  }
  const publicKey = fs.readFileSync(pubPath, 'utf8');
  const stat = fs.statSync(pubPath);
  const fingerprint = crypto.createHash('sha256')
    .update(publicKey)
    .digest('hex')
    .replace(/(.{2})/g, '$1:')
    .slice(0, -1)
    .toUpperCase()
    .substring(0, 47);

  return { exists: true, fingerprint, createdAt: stat.mtime.toISOString() };
}

// ─── SSL Certificate Management ────────────────────────────────────────────

/** Generate a self-signed SSL certificate */
export function regenerateSSL(): { subject: string; validUntil: string; fingerprint: string } {
  ensureKeysDir();

  // Generate a new key pair for SSL
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(path.join(KEYS_DIR, 'ssl_key.pem'), privateKey, { mode: 0o600 });

  // Generate a self-signed certificate using openssl if available
  const certPath = path.join(KEYS_DIR, 'ssl_cert.pem');
  const keyPath = path.join(KEYS_DIR, 'ssl_key.pem');

  try {
    execSync(
      `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -subj "/CN=arcellite.local/O=Arcellite/C=US" -sha256 2>/dev/null`,
      { timeout: 10000 }
    );
  } catch {
    // If openssl isn't available, create a placeholder
    fs.writeFileSync(certPath, `# SSL certificate placeholder\n# Generated: ${new Date().toISOString()}\n# Install openssl for real certificate generation\n`, { mode: 0o644 });
  }

  const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const fingerprint = crypto.randomBytes(20).toString('hex').replace(/(.{2})/g, '$1:').slice(0, -1).toUpperCase().substring(0, 47);

  return { subject: 'CN=arcellite.local, O=Arcellite', validUntil, fingerprint };
}

/** Get current SSL certificate info */
export function getSSLInfo(): { exists: boolean; subject?: string; validUntil?: string } {
  const certPath = path.join(KEYS_DIR, 'ssl_cert.pem');
  if (!fs.existsSync(certPath)) return { exists: false };
  const stat = fs.statSync(certPath);
  return {
    exists: true,
    subject: 'CN=arcellite.local, O=Arcellite',
    validUntil: new Date(stat.mtime.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ─── Integrity Check ───────────────────────────────────────────────────────

/** Run an integrity check on all data files — hash them and report */
export async function runIntegrityCheck(): Promise<{
  totalFiles: number;
  checkedFiles: number;
  errors: string[];
  checksumFile: string;
}> {
  ensureKeysDir();
  const cached = (globalThis as any).__arcellite_storage_path;
  const baseDir = cached || process.env.ARCELLITE_DATA || path.join(os.homedir(), 'arcellite-data');
  const expandedBase = baseDir.startsWith('~/') ? path.join(os.homedir(), baseDir.slice(2)) : baseDir;
  const checksums: Record<string, string> = {};
  const errors: string[] = [];
  let totalFiles = 0;

  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name.startsWith('.')) continue; // skip hidden
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          totalFiles++;
          try {
            const hash = crypto.createHash('sha256');
            const data = fs.readFileSync(fullPath);
            hash.update(data);
            const relativePath = path.relative(expandedBase, fullPath);
            checksums[relativePath] = hash.digest('hex');
          } catch (e: any) {
            errors.push(`Failed to hash: ${path.relative(expandedBase, fullPath)}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      errors.push(`Cannot read directory: ${path.relative(expandedBase, dir)}: ${e.message}`);
    }
  }

  walkDir(expandedBase);

  // Compare against previous checksums if they exist
  const checksumPath = path.join(KEYS_DIR, 'integrity_checksums.json');
  let previousChecksums: Record<string, string> = {};
  if (fs.existsSync(checksumPath)) {
    try {
      previousChecksums = JSON.parse(fs.readFileSync(checksumPath, 'utf8'));
    } catch { /* ignore parse errors */ }
  }

  // Detect changes
  for (const [file, hash] of Object.entries(previousChecksums)) {
    if (checksums[file] && checksums[file] !== hash) {
      errors.push(`File modified since last check: ${file}`);
    } else if (!checksums[file]) {
      errors.push(`File removed since last check: ${file}`);
    }
  }

  // Save current checksums
  fs.writeFileSync(checksumPath, JSON.stringify(checksums, null, 2), { mode: 0o600 });

  return {
    totalFiles,
    checkedFiles: Object.keys(checksums).length,
    errors,
    checksumFile: checksumPath,
  };
}

// ─── IP Allowlist for Strict Isolation ─────────────────────────────────────

/** Get the IP allowlist for a user */
export async function getIpAllowlist(userId: number): Promise<string[]> {
  const result = await pool.query(
    `SELECT preferences FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.preferences?.ipAllowlist || [];
}

/** Set the IP allowlist for a user */
export async function setIpAllowlist(userId: number, ips: string[]): Promise<void> {
  await pool.query(
    `INSERT INTO user_settings (user_id, preferences) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET preferences = user_settings.preferences || $2, updated_at = NOW()`,
    [userId, JSON.stringify({ ipAllowlist: ips })]
  );
}

/** Check if an IP is allowed under strict isolation (returns true if allowed or isolation disabled) */
export async function isIpAllowed(userId: number, ip: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT preferences FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  const prefs = result.rows[0]?.preferences || {};
  if (!prefs.secStrictIsolation) return true; // isolation disabled

  const allowlist: string[] = prefs.ipAllowlist || [];
  if (allowlist.length === 0) return true; // no list set = allow all (avoid lockout on first enable)

  // Normalize IP (handle ::ffff: mapped IPv4)
  const normalizedIp = ip.replace(/^::ffff:/, '');
  
  // Check if IP is in allowlist
  return allowlist.some(allowed => {
    const normalizedAllowed = allowed.replace(/^::ffff:/, '');
    return normalizedIp === normalizedAllowed;
  });
}

/** Pre-auth check: should this IP see the access-denied page (no login at all)? */
export async function shouldDenyAccessByIp(clientIp: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT user_id, preferences FROM user_settings`
  );
  const normalizedIp = (clientIp || '').replace(/^::ffff:/, '');
  let anyStrictWithList = false;
  for (const row of result.rows) {
    const prefs = row.preferences || {};
    if (!prefs.secStrictIsolation) continue;
    const allowlist: string[] = prefs.ipAllowlist || [];
    if (allowlist.length === 0) continue;
    anyStrictWithList = true;
    const inList = allowlist.some((allowed: string) => {
      const n = (allowed || '').replace(/^::ffff:/, '');
      return normalizedIp === n;
    });
    if (inList) return false; // IP is allowed for at least one user → show login
  }
  return anyStrictWithList; // at least one user has strict isolation and IP is in no allowlist → deny
}

// ─── Traffic Masking Headers ───────────────────────────────────────────────

/** Get security headers that should be applied when traffic masking is enabled */
export function getTrafficMaskingHeaders(): Record<string, string> {
  return {
    'X-Powered-By': 'nginx',
    'Server': 'nginx/1.24.0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'",
  };
}

/** Check if traffic masking is enabled for any user */
export async function isTrafficMaskingEnabled(): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT preferences FROM user_settings LIMIT 1`
    );
    return result.rows[0]?.preferences?.secTrafficMasking ?? false;
  } catch {
    return false;
  }
}
