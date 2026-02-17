/**
 * File/folder API: list and mkdir under a safe base path.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const CATEGORY_DIR: Record<string, string> = {
  general: 'files',
  media: 'photos',
  video_vault: 'videos',
  music: 'music',
};

export function getBaseDir(): string {
  // Use cached user storage path if available (set on startup and after transfer)
  const cached = (globalThis as any).__arcellite_storage_path;
  if (cached) return cached;
  let dir = process.env.ARCELLITE_DATA || path.join(os.homedir(), 'arcellite-data');
  // Expand leading ~ to homedir
  if (dir.startsWith('~/') || dir === '~') {
    dir = path.join(os.homedir(), dir.slice(2));
  }
  // Async: try to populate cache from DB so future calls use the correct path
  refreshStoragePathCache().catch(() => {});
  return dir;
}

/** Refresh the global storage path cache from the database */
export async function refreshStoragePathCache(): Promise<void> {
  try {
    const authSvc = await import('./services/auth.service.js');
    const storagePath = await authSvc.getActiveStoragePath();
    if (storagePath) {
      (globalThis as any).__arcellite_storage_path = storagePath;
    }
  } catch {
    // DB not ready — will use env fallback
  }
}

function getCategoryDir(category: string): string {
  const sub = CATEGORY_DIR[category] ?? 'files';
  return path.join(getBaseDir(), sub);
}

/** Resolve relative path under category; throws if path escapes. */
function resolvePath(category: string, relativePath: string): string {
  const base = getCategoryDir(category);
  const resolved = path.resolve(base, relativePath || '.');
  if (!resolved.startsWith(base)) throw new Error('Invalid path');
  return resolved;
}

export function ensureBaseExists(): void {
  const base = getBaseDir();
  // Create all standard folders: files, photos, videos, music, shared
  const allFolders = [
    ...Object.values(CATEGORY_DIR),
    'music', 'shared',
  ];
  const unique = [...new Set(allFolders)];
  for (const sub of unique) {
    const dir = path.join(base, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

export interface ListEntry {
  name: string;
  isFolder: boolean;
  mtimeMs: number;
  sizeBytes?: number;
}

export function listDir(category: string, relativePath: string): ListEntry[] {
  const dir = resolvePath(category, relativePath);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  const entries: ListEntry[] = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    entries.push({
      name,
      isFolder: stat.isDirectory(),
      mtimeMs: stat.mtimeMs,
      sizeBytes: stat.isFile() ? stat.size : undefined,
    });
  }
  return entries;
}

export function mkdir(category: string, relativePath: string): void {
  ensureBaseExists();
  const dir = resolvePath(category, relativePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function writeFile(category: string, relativePath: string, content: string): string {
  ensureBaseExists();
  const filePath = resolvePath(category, relativePath);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

export function uploadFile(category: string, relativePath: string, filename: string, buffer: Buffer): string {
  ensureBaseExists();
  const dir = resolvePath(category, relativePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const targetPath = path.join(dir, filename);
  fs.writeFileSync(targetPath, buffer);
  return targetPath;
}

export function deleteFile(category: string, relativePath: string): void {
  const filePath = resolvePath(category, relativePath);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
  }
}

export function moveFile(category: string, sourcePath: string, targetPath: string): void {
  const source = resolvePath(category, sourcePath);
  const target = resolvePath(category, targetPath);

  if (!fs.existsSync(source)) {
    throw new Error('Source file does not exist');
  }

  // Ensure target directory exists
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Move the file
  fs.renameSync(source, target);
}

export function moveFileCrossCategory(
  sourceCategory: string,
  sourcePath: string,
  targetCategory: string,
  targetPath: string
): void {
  const source = resolvePath(sourceCategory, sourcePath);
  const target = resolvePath(targetCategory, targetPath);

  if (!fs.existsSync(source)) {
    throw new Error('Source file does not exist');
  }

  if (fs.existsSync(target)) {
    throw new Error('A file with the same name already exists in the target location');
  }

  // Ensure target directory exists
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Use fs.copyFileSync + unlinkSync for cross-device moves (different mount points)
  try {
    fs.renameSync(source, target);
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      // Cross-device: copy then delete
      fs.copyFileSync(source, target);
      fs.unlinkSync(source);
    } else {
      throw err;
    }
  }
}

/**
 * Clear ALL user files across every category folder.
 * Empties files/, photos/, videos/, music/, shared/ but keeps the directories.
 */
export function clearAllFiles(): { deletedCount: number; categories: string[] } {
  const base = getBaseDir();
  const allFolders = [...new Set([...Object.values(CATEGORY_DIR), 'music', 'shared'])];
  let deletedCount = 0;
  const clearedCategories: string[] = [];

  for (const sub of allFolders) {
    const dir = path.join(base, sub);
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        } else {
          fs.unlinkSync(full);
        }
        deletedCount++;
      } catch (err) {
        console.error(`[clearAllFiles] Failed to delete ${full}:`, err);
      }
    }
    clearedCategories.push(sub);
  }

  // Also clear the trash folder
  const trashDir = path.join(base, '.trash');
  if (fs.existsSync(trashDir)) {
    const trashEntries = fs.readdirSync(trashDir);
    for (const entry of trashEntries) {
      const full = path.join(trashDir, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        } else {
          fs.unlinkSync(full);
        }
        deletedCount++;
      } catch (err) {
        console.error(`[clearAllFiles] Failed to delete trash item ${full}:`, err);
      }
    }
  }

  return { deletedCount, categories: clearedCategories };
}

/** Allowed prefixes for external (USB/removable) browsing. */
const EXTERNAL_ALLOWED_PREFIXES = ['/media/', '/run/media/', '/mnt/'];

/** List directory at an absolute path; only allowed under /media, /run/media, or /mnt. */
export function listExternal(absolutePath: string): ListEntry[] {
  const normalized = path.normalize(absolutePath);
  const resolved = path.resolve(normalized);
  const allowed = EXTERNAL_ALLOWED_PREFIXES.some((p) => resolved.startsWith(p) || resolved === p.replace(/\/$/, ''));
  if (!allowed) throw new Error('Path not allowed');

  console.log(`[listExternal] Listing: "${resolved}"`);

  // First try direct access
  try {
    // Quick check — try to read the directory directly
    const names = fs.readdirSync(resolved);
    console.log(`[listExternal] readdirSync returned ${names.length} entries`);
    const entries: ListEntry[] = [];
    for (const name of names) {
      const full = path.join(resolved, name);
      try {
        const stat = fs.statSync(full);
        entries.push({
          name,
          isFolder: stat.isDirectory(),
          mtimeMs: stat.mtimeMs,
          sizeBytes: stat.isFile() ? stat.size : undefined,
        });
      } catch {
        // Skip entries we can't stat
        entries.push({ name, isFolder: false, mtimeMs: Date.now() });
      }
    }
    return entries;
  } catch (directErr: any) {
    console.error(`[listExternal] Direct read failed: ${directErr.code} — ${directErr.message}`);
    // If permission denied, fall back to sudo
    if (directErr.code !== 'EACCES' && directErr.code !== 'EPERM') {
      // Not a permission issue — path doesn't exist or other problem
      if (directErr.code === 'ENOENT') return [];
      throw directErr;
    }
  }

  // Fallback: use sudo to list (for root-owned mount points like /media/root/...)
  console.log(`[listExternal] Permission denied for "${resolved}", falling back to sudo ls`);
  try {
    const out = execSync(
      `sudo -n ls -la --time-style=+%s ${JSON.stringify(resolved)}`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const entries: ListEntry[] = [];
    const lines = out.trim().split('\n');
    for (const line of lines) {
      // ls -la output format: drwxr-xr-x 2 root root 4096 1707123456 filename
      // Skip total line and . / .. entries
      if (line.startsWith('total ') || !line.trim()) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 7) continue;
      const perms = parts[0];
      const sizeStr = parts[4];
      const timestamp = parts[5]; // epoch seconds from --time-style=+%s
      const name = parts.slice(6).join(' ');
      if (name === '.' || name === '..') continue;
      const isFolder = perms.startsWith('d');
      const size = parseInt(sizeStr, 10);
      const mtimeMs = parseInt(timestamp, 10) * 1000;
      entries.push({
        name,
        isFolder,
        mtimeMs: isNaN(mtimeMs) ? Date.now() : mtimeMs,
        sizeBytes: !isFolder && !isNaN(size) ? size : undefined,
      });
    }
    return entries;
  } catch (sudoErr: any) {
    console.error('[listExternal] sudo ls failed:', sudoErr.message);
    throw new Error(`Cannot read directory: permission denied. Ensure the server can access ${resolved}`);
  }
}

/** Validate and resolve an external path; throws if invalid. */
function resolveExternalPath(absolutePath: string): string {
  const normalized = path.normalize(absolutePath);
  const resolved = path.resolve(normalized);
  const allowed = EXTERNAL_ALLOWED_PREFIXES.some((p) => resolved.startsWith(p) || resolved === p.replace(/\/$/, ''));
  if (!allowed) throw new Error('Path not allowed');
  if (resolved.includes('..')) throw new Error('Invalid path');
  return resolved;
}

/** Delete a file or folder at an absolute external path. */
export function deleteExternal(absolutePath: string): void {
  const resolved = resolveExternalPath(absolutePath);
  console.log(`[deleteExternal] Deleting: "${resolved}"`);

  // Try direct first
  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      fs.rmSync(resolved, { recursive: true, force: true });
    } else {
      fs.unlinkSync(resolved);
    }
    return;
  } catch (err: any) {
    if (err.code !== 'EACCES' && err.code !== 'EPERM') throw err;
  }

  // Fallback: sudo rm
  try {
    execSync(`sudo -n rm -rf ${JSON.stringify(resolved)}`, { timeout: 15000 });
  } catch (sudoErr: any) {
    console.error('[deleteExternal] sudo rm failed:', sudoErr.message);
    throw new Error('Permission denied: cannot delete');
  }
}

/** Rename a file or folder at an absolute external path. */
export function renameExternal(oldPath: string, newName: string): string {
  const resolvedOld = resolveExternalPath(oldPath);
  // newName must not contain path separators
  if (newName.includes('/') || newName.includes('\\') || newName.includes('..')) {
    throw new Error('Invalid name');
  }
  const parentDir = path.dirname(resolvedOld);
  const resolvedNew = path.join(parentDir, newName);

  // Ensure destination doesn't already exist
  if (fs.existsSync(resolvedNew)) {
    throw new Error('A file or folder with that name already exists');
  }

  console.log(`[renameExternal] Renaming: "${resolvedOld}" -> "${resolvedNew}"`);

  // Try direct first
  try {
    fs.renameSync(resolvedOld, resolvedNew);
    return resolvedNew;
  } catch (err: any) {
    if (err.code !== 'EACCES' && err.code !== 'EPERM') throw err;
  }

  // Fallback: sudo mv
  try {
    execSync(`sudo -n mv ${JSON.stringify(resolvedOld)} ${JSON.stringify(resolvedNew)}`, { timeout: 15000 });
    return resolvedNew;
  } catch (sudoErr: any) {
    console.error('[renameExternal] sudo mv failed:', sudoErr.message);
    throw new Error('Permission denied: cannot rename');
  }
}

/** Create a folder at an absolute external path. */
export function mkdirExternal(absolutePath: string): void {
  const resolved = resolveExternalPath(absolutePath);
  console.log(`[mkdirExternal] Creating folder: "${resolved}"`);

  if (fs.existsSync(resolved)) {
    throw new Error('Folder already exists');
  }

  // Try direct first
  try {
    fs.mkdirSync(resolved, { recursive: true });
    return;
  } catch (err: any) {
    if (err.code !== 'EACCES' && err.code !== 'EPERM') throw err;
  }

  // Fallback: sudo mkdir
  try {
    execSync(`sudo -n mkdir -p ${JSON.stringify(resolved)}`, { timeout: 10000 });
  } catch (sudoErr: any) {
    console.error('[mkdirExternal] sudo mkdir failed:', sudoErr.message);
    throw new Error('Permission denied: cannot create folder');
  }
}
