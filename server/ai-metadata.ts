/**
 * AI Metadata: Track files that have been renamed by AI (Gemini Vision).
 * Stores metadata in ~/arcellite-data/config/ai-metadata.json
 */

import fs from 'fs';
import path from 'path';
import { getBaseDir } from './files.js';

interface AiRenamedEntry {
  originalName: string;
  renamedAt: number;
}

interface AiMetadata {
  renamedFiles: Record<string, AiRenamedEntry>;
}

function getMetadataPath(): string {
  return path.join(getBaseDir(), 'config', 'ai-metadata.json');
}

function loadMetadata(): AiMetadata {
  const metaPath = getMetadataPath();
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }
  } catch {
    // Corrupted file — start fresh
  }
  return { renamedFiles: {} };
}

function saveMetadata(metadata: AiMetadata): void {
  const metaPath = getMetadataPath();
  const dir = path.dirname(metaPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
}

/**
 * Record that a file was renamed by AI.
 * @param category - File category (media, general, etc.)
 * @param newRelPath - New relative path after rename
 * @param originalName - Original filename before rename
 */
export function markAsAiRenamed(category: string, newRelPath: string, originalName: string): void {
  const metadata = loadMetadata();
  const key = `${category}/${newRelPath}`;
  metadata.renamedFiles[key] = {
    originalName,
    renamedAt: Date.now(),
  };
  saveMetadata(metadata);
}

/**
 * Check if a file has been AI-renamed.
 * @param category - File category
 * @param relPath - Relative path within category
 */
export function isAiRenamed(category: string, relPath: string): boolean {
  const metadata = loadMetadata();
  return `${category}/${relPath}` in metadata.renamedFiles;
}

/**
 * Get all AI-renamed file keys for a category.
 * Returns a Set of relative paths that have been AI-renamed.
 */
export function getAiRenamedFiles(category?: string): Record<string, AiRenamedEntry> {
  const metadata = loadMetadata();
  if (!category) return metadata.renamedFiles;

  const prefix = `${category}/`;
  const filtered: Record<string, AiRenamedEntry> = {};
  for (const [key, value] of Object.entries(metadata.renamedFiles)) {
    if (key.startsWith(prefix)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Update the key when a file is moved/renamed (not by AI).
 * Keeps the AI-renamed flag if the file is simply relocated.
 */
export function updateAiRenamedPath(category: string, oldRelPath: string, newRelPath: string): void {
  const metadata = loadMetadata();
  const oldKey = `${category}/${oldRelPath}`;
  const newKey = `${category}/${newRelPath}`;
  if (oldKey in metadata.renamedFiles) {
    metadata.renamedFiles[newKey] = metadata.renamedFiles[oldKey];
    delete metadata.renamedFiles[oldKey];
    saveMetadata(metadata);
  }
}

/**
 * Remove metadata entry when a file is deleted.
 */
export function removeAiRenamedEntry(category: string, relPath: string): void {
  const metadata = loadMetadata();
  const key = `${category}/${relPath}`;
  if (key in metadata.renamedFiles) {
    delete metadata.renamedFiles[key];
    saveMetadata(metadata);
  }
}
