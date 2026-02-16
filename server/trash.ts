/**
 * Trash management for Arcellite
 * Files moved to trash are stored with metadata and auto-deleted after 30 days
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const TRASH_RETENTION_DAYS = 30;

export interface TrashMetadata {
  originalPath: string;
  originalCategory: string;
  trashedAt: number;
  name: string;
  sizeBytes: number;
}

export interface TrashItem {
  id: string;
  name: string;
  originalPath: string;
  category: string;
  trashedAt: number;
  sizeBytes: number;
  sizeHuman: string;
}

function getBaseDir(): string {
  // Use cached user storage path from files.routes if available
  const cached = (globalThis as any).__arcellite_storage_path;
  if (cached) return cached;
  let dir = process.env.ARCELLITE_DATA || path.join(os.homedir(), 'arcellite-data');
  if (dir.startsWith('~/') || dir === '~') {
    dir = path.join(os.homedir(), dir.slice(2));
  }
  return dir;
}

function getTrashDir(): string {
  return path.join(getBaseDir(), '.trash');
}

function getTrashMetadataPath(): string {
  return path.join(getTrashDir(), '.metadata.json');
}

function ensureTrashDir(): void {
  const trashDir = getTrashDir();
  if (!fs.existsSync(trashDir)) {
    fs.mkdirSync(trashDir, { recursive: true });
  }
}

function loadMetadata(): Record<string, TrashMetadata> {
  ensureTrashDir();
  const metadataPath = getTrashMetadataPath();

  if (!fs.existsSync(metadataPath)) {
    return {};
  }

  try {
    const data = fs.readFileSync(metadataPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Error loading trash metadata:', (e as Error).message);
    return {};
  }
}

function saveMetadata(metadata: Record<string, TrashMetadata>): void {
  ensureTrashDir();
  const metadataPath = getTrashMetadataPath();
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

/**
 * Move a file or folder to trash
 */
export function moveToTrash(category: string, relativePath: string): string {
  ensureTrashDir();

  const categoryDirs: Record<string, string> = {
    general: 'files',
    media: 'photos',
    video_vault: 'videos',
    music: 'music',
  };

  const subDir = categoryDirs[category] || 'files';
  const baseDir = getBaseDir();
  const sourcePath = path.join(baseDir, subDir, relativePath);

  if (!fs.existsSync(sourcePath)) {
    throw new Error('File not found');
  }

  const stat = fs.statSync(sourcePath);
  const timestamp = Date.now();
  const trashId = `${timestamp}_${path.basename(relativePath)}`;
  const trashPath = path.join(getTrashDir(), trashId);

  // Move file to trash
  fs.renameSync(sourcePath, trashPath);

  // Save metadata
  const metadata = loadMetadata();
  metadata[trashId] = {
    originalPath: relativePath,
    originalCategory: category,
    trashedAt: timestamp,
    name: path.basename(relativePath),
    sizeBytes: stat.size || 0,
  };
  saveMetadata(metadata);

  return trashId;
}

/**
 * List all items in trash
 */
export function listTrash(): TrashItem[] {
  ensureTrashDir();
  const metadata = loadMetadata();
  const items: TrashItem[] = [];

  for (const [id, meta] of Object.entries(metadata)) {
    items.push({
      id,
      name: meta.name,
      originalPath: meta.originalPath,
      category: meta.originalCategory,
      trashedAt: meta.trashedAt,
      sizeBytes: meta.sizeBytes,
      sizeHuman: formatBytes(meta.sizeBytes),
    });
  }

  // Sort by most recently trashed
  items.sort((a, b) => b.trashedAt - a.trashedAt);

  return items;
}

/**
 * Restore a file from trash to its original location
 */
export function restoreFromTrash(trashId: string): void {
  const metadata = loadMetadata();
  const item = metadata[trashId];

  if (!item) {
    throw new Error('Item not found in trash');
  }

  const trashPath = path.join(getTrashDir(), trashId);

  if (!fs.existsSync(trashPath)) {
    throw new Error('Trash file not found');
  }

  const categoryDirs: Record<string, string> = {
    general: 'files',
    media: 'photos',
    video_vault: 'videos',
    music: 'music',
  };

  const subDir = categoryDirs[item.originalCategory] || 'files';
  const baseDir = getBaseDir();
  const targetPath = path.join(baseDir, subDir, item.originalPath);

  // Ensure target directory exists
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Restore file
  fs.renameSync(trashPath, targetPath);

  // Remove from metadata
  delete metadata[trashId];
  saveMetadata(metadata);
}

/**
 * Permanently delete a file from trash
 */
export function permanentlyDelete(trashId: string): void {
  const metadata = loadMetadata();
  const item = metadata[trashId];

  if (!item) {
    throw new Error('Item not found in trash');
  }

  const trashPath = path.join(getTrashDir(), trashId);

  if (fs.existsSync(trashPath)) {
    const stat = fs.statSync(trashPath);
    if (stat.isDirectory()) {
      fs.rmSync(trashPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(trashPath);
    }
  }

  // Remove from metadata
  delete metadata[trashId];
  saveMetadata(metadata);
}

/**
 * Empty entire trash (permanently delete all items)
 */
export function emptyTrash(): number {
  const metadata = loadMetadata();
  let deletedCount = 0;

  for (const trashId of Object.keys(metadata)) {
    try {
      permanentlyDelete(trashId);
      deletedCount++;
    } catch (e) {
      console.error(`Error deleting ${trashId}:`, (e as Error).message);
    }
  }

  return deletedCount;
}

/**
 * Clean up trash items older than retention period (30 days)
 */
export function cleanupOldTrashItems(): number {
  const metadata = loadMetadata();
  const now = Date.now();
  const retentionMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  for (const [trashId, item] of Object.entries(metadata)) {
    const age = now - item.trashedAt;

    if (age > retentionMs) {
      try {
        permanentlyDelete(trashId);
        deletedCount++;
        console.log(`Auto-deleted old trash item: ${item.name} (${Math.floor(age / (24 * 60 * 60 * 1000))} days old)`);
      } catch (e) {
        console.error(`Error auto-deleting ${trashId}:`, (e as Error).message);
      }
    }
  }

  return deletedCount;
}
