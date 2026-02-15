/**
 * Transfer Service
 * Handles preparing transfer packages to USB and importing from them.
 * Transfer package structure on USB:
 *   .arcellite-transfer/
 *     manifest.json        — version, date, source hostname
 *     account.json         — user profile, settings, connected apps
 *     database.json        — all DB tables as JSON
 *     files/               — mirror of arcellite-data directory
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import bcrypt from 'bcrypt';
import { pool } from '../db/connection.js';
import { createSession } from './auth.service.js';

const homeDir = os.homedir();
let baseDir = process.env.ARCELLITE_DATA || path.join(homeDir, 'arcellite-data');
if (baseDir.startsWith('~/') || baseDir === '~') {
  baseDir = path.join(homeDir, baseDir.slice(2));
}

const TRANSFER_DIR_NAME = '.arcellite-transfer';
const TRANSFER_VERSION = '1.0';

const DATA_SUBDIRS = ['files', 'photos', 'videos', 'music', 'shared', 'databases'];

// ── Progress Tracking ──────────────────────────────────────────────────────────

export interface CategoryProgress {
  name: string;
  label: string;
  filesCopied: number;
  totalFiles: number;
  bytesCopied: number;
  done: boolean;
}

export interface TransferProgress {
  phase: 'idle' | 'exporting-db' | 'copying-files' | 'writing-manifest' | 'done' | 'error' | 'importing-db' | 'importing-files' | 'importing-account';
  percent: number;
  message: string;
  filesCopied: number;
  totalFiles: number;
  bytesWritten: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  sessionToken?: string;
  user?: { id: number; email: string; firstName: string; lastName: string; avatarUrl: string; isSetupComplete: boolean; emailVerified: boolean };
  // Detailed tracking
  currentFile?: string;
  currentCategory?: string;
  categories?: CategoryProgress[];
  dbRows?: { table: string; imported: number; total: number }[];
  speedBps?: number;
  etaSeconds?: number;
}

let currentProgress: TransferProgress = {
  phase: 'idle',
  percent: 0,
  message: '',
  filesCopied: 0,
  totalFiles: 0,
  bytesWritten: 0,
};

let lastSpeedCheck = { time: Date.now(), bytes: 0 };

export function getTransferProgress(): TransferProgress {
  return { ...currentProgress };
}

function resetProgress() {
  currentProgress = {
    phase: 'idle',
    percent: 0,
    message: '',
    filesCopied: 0,
    totalFiles: 0,
    bytesWritten: 0,
  };
  lastSpeedCheck = { time: Date.now(), bytes: 0 };
}

function updateProgress(update: Partial<TransferProgress>) {
  currentProgress = { ...currentProgress, ...update };
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Count all files recursively in a directory */
function countFiles(dir: string): number {
  let count = 0;
  if (!fs.existsSync(dir)) return 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) count++;
      else if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
    }
  } catch { /* skip unreadable dirs */ }
  return count;
}

const CATEGORY_LABELS: Record<string, string> = {
  files: 'Documents & Files',
  photos: 'Photos & Images',
  videos: 'Videos',
  music: 'Music & Audio',
  shared: 'Shared Files',
  databases: 'Databases',
};

let copyPercentBase = 20;
let copyPercentRange = 70;

/** Recursively copy a directory, updating progress with per-category tracking */
function copyDirRecursive(src: string, dest: string, categoryName?: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    try {
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath, categoryName);
      } else {
        fs.copyFileSync(srcPath, destPath);
        const stat = fs.statSync(destPath);
        currentProgress.filesCopied++;
        currentProgress.bytesWritten += stat.size;
        currentProgress.currentFile = entry.name;
        currentProgress.currentCategory = categoryName;

        // Update per-category progress
        if (currentProgress.categories && categoryName) {
          const cat = currentProgress.categories.find(c => c.name === categoryName);
          if (cat) {
            cat.filesCopied++;
            cat.bytesCopied += stat.size;
            cat.done = cat.filesCopied >= cat.totalFiles;
          }
        }

        // Calculate speed (update every 500ms)
        const now = Date.now();
        const elapsed = now - lastSpeedCheck.time;
        if (elapsed > 500) {
          const bytesDelta = currentProgress.bytesWritten - lastSpeedCheck.bytes;
          currentProgress.speedBps = Math.round((bytesDelta / elapsed) * 1000);
          lastSpeedCheck = { time: now, bytes: currentProgress.bytesWritten };

          // Calculate ETA
          if (currentProgress.speedBps > 0 && currentProgress.totalFiles > 0) {
            const remainingFiles = currentProgress.totalFiles - currentProgress.filesCopied;
            const avgFileSize = currentProgress.bytesWritten / currentProgress.filesCopied;
            const remainingBytes = remainingFiles * avgFileSize;
            currentProgress.etaSeconds = Math.round(remainingBytes / currentProgress.speedBps);
          }
        }

        currentProgress.message = `Copying: ${entry.name}`;

        // Update percent using configurable base/range
        if (currentProgress.totalFiles > 0) {
          currentProgress.percent = copyPercentBase + Math.round((currentProgress.filesCopied / currentProgress.totalFiles) * copyPercentRange);
        }
      }
    } catch (e) {
      console.error(`[Transfer] Failed to copy ${srcPath}:`, (e as Error).message);
    }
  }
}

// ── Export: Prepare Transfer Package ────────────────────────────────────────────

/** Export all database tables as JSON */
async function exportDatabaseJSON(): Promise<Record<string, any[]>> {
  const client = await pool.connect();
  try {
    const tables: Record<string, any[]> = {};

    // User (strip password for security — new device gets fresh password)
    const users = await client.query(
      'SELECT id, email, first_name, last_name, avatar_url, storage_path, is_setup_complete, email_verified, created_at, updated_at FROM users'
    );
    tables.users = users.rows;

    // Recent files
    const recent = await client.query('SELECT * FROM recent_files ORDER BY accessed_at DESC');
    tables.recent_files = recent.rows;

    // File metadata
    const metadata = await client.query('SELECT * FROM file_metadata');
    tables.file_metadata = metadata.rows;

    // Activity log
    const activity = await client.query('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 2000');
    tables.activity_log = activity.rows;

    // Notifications
    const notifications = await client.query('SELECT * FROM notifications ORDER BY created_at DESC');
    tables.notifications = notifications.rows;

    // User settings
    const settings = await client.query('SELECT * FROM user_settings');
    tables.user_settings = settings.rows;

    // Connected apps (without sensitive tokens)
    const apps = await client.query(
      'SELECT id, user_id, app_type, app_name, config, is_active, created_at, updated_at FROM connected_apps'
    );
    tables.connected_apps = apps.rows;

    // Trash
    try {
      const trash = await client.query('SELECT * FROM trash');
      tables.trash = trash.rows;
    } catch { /* table might not exist */ }

    return tables;
  } finally {
    client.release();
  }
}

/** Prepare and write a transfer package to a USB mountpoint */
export async function prepareTransferPackage(mountpoint: string): Promise<{ success: boolean; error?: string; transferPath?: string }> {
  const transferDir = path.join(mountpoint, TRANSFER_DIR_NAME);

  try {
    // Validate mountpoint exists and is writable
    if (!fs.existsSync(mountpoint)) {
      return { success: false, error: 'USB drive not found at ' + mountpoint };
    }

    // Test write access
    const testFile = path.join(mountpoint, '.arcellite-write-test');
    try {
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch {
      return { success: false, error: 'USB drive is not writable. Check permissions or mount options.' };
    }

    resetProgress();

    const exportDbRows: { table: string; imported: number; total: number }[] = [
      { table: 'Settings', imported: 0, total: 0 },
      { table: 'File Metadata', imported: 0, total: 0 },
      { table: 'Recent Files', imported: 0, total: 0 },
      { table: 'Connected Apps', imported: 0, total: 0 },
      { table: 'Activity Log', imported: 0, total: 0 },
      { table: 'Notifications', imported: 0, total: 0 },
    ];

    updateProgress({
      phase: 'exporting-db',
      percent: 5,
      message: 'Exporting database...',
      startedAt: new Date().toISOString(),
      dbRows: [...exportDbRows],
    });

    // Clean up any old transfer data
    if (fs.existsSync(transferDir)) {
      fs.rmSync(transferDir, { recursive: true, force: true });
    }
    fs.mkdirSync(transferDir, { recursive: true });

    // 1. Export database with per-table tracking
    const dbData = await exportDatabaseJSON();

    // Update row counts from exported data
    exportDbRows[0].total = dbData.user_settings?.length || 0;
    exportDbRows[0].imported = exportDbRows[0].total;
    exportDbRows[1].total = dbData.file_metadata?.length || 0;
    exportDbRows[1].imported = exportDbRows[1].total;
    exportDbRows[2].total = dbData.recent_files?.length || 0;
    exportDbRows[2].imported = exportDbRows[2].total;
    exportDbRows[3].total = dbData.connected_apps?.length || 0;
    exportDbRows[3].imported = exportDbRows[3].total;
    exportDbRows[4].total = dbData.activity_log?.length || 0;
    exportDbRows[4].imported = exportDbRows[4].total;
    exportDbRows[5].total = dbData.notifications?.length || 0;
    exportDbRows[5].imported = exportDbRows[5].total;

    fs.writeFileSync(
      path.join(transferDir, 'database.json'),
      JSON.stringify(dbData, null, 2)
    );
    updateProgress({ percent: 15, message: 'Database exported', dbRows: [...exportDbRows] });

    // 2. Export account info separately for quick detection
    const accountInfo = {
      user: dbData.users?.[0] || null,
      settings: dbData.user_settings?.[0] || null,
    };
    fs.writeFileSync(
      path.join(transferDir, 'account.json'),
      JSON.stringify(accountInfo, null, 2)
    );
    updateProgress({ percent: 20, message: 'Account info saved' });

    // 3. Copy all files with per-category tracking
    updateProgress({ phase: 'copying-files', message: 'Counting files...' });
    copyPercentBase = 20;
    copyPercentRange = 70;

    // Count files per category
    const exportCategories: CategoryProgress[] = [];
    let totalFiles = 0;
    for (const subdir of DATA_SUBDIRS) {
      const catCount = countFiles(path.join(baseDir, subdir));
      totalFiles += catCount;
      exportCategories.push({
        name: subdir,
        label: CATEGORY_LABELS[subdir] || subdir,
        filesCopied: 0,
        totalFiles: catCount,
        bytesCopied: 0,
        done: false,
      });
    }
    updateProgress({
      totalFiles,
      message: `Copying ${totalFiles} files...`,
      categories: exportCategories,
    });

    const filesDestDir = path.join(transferDir, 'files');
    fs.mkdirSync(filesDestDir, { recursive: true });

    for (const subdir of DATA_SUBDIRS) {
      const src = path.join(baseDir, subdir);
      const dest = path.join(filesDestDir, subdir);
      if (fs.existsSync(src)) {
        copyDirRecursive(src, dest, subdir);
      } else {
        // Mark empty categories as done
        const cat = currentProgress.categories?.find(c => c.name === subdir);
        if (cat) cat.done = true;
      }
    }

    // 4. Write manifest
    updateProgress({ phase: 'writing-manifest', percent: 95, message: 'Finalizing...' });

    const manifest = {
      version: TRANSFER_VERSION,
      application: 'Arcellite',
      createdAt: new Date().toISOString(),
      sourceHostname: os.hostname(),
      sourcePlatform: os.platform(),
      sourceArch: os.arch(),
      totalFiles,
      bytesWritten: currentProgress.bytesWritten,
      dataDir: baseDir,
      userName: accountInfo.user?.first_name
        ? `${accountInfo.user.first_name} ${accountInfo.user.last_name || ''}`.trim()
        : accountInfo.user?.email || 'Unknown',
      userEmail: accountInfo.user?.email || '',
    };

    fs.writeFileSync(
      path.join(transferDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    updateProgress({
      phase: 'done',
      percent: 100,
      message: 'Transfer package ready',
      completedAt: new Date().toISOString(),
    });

    return { success: true, transferPath: transferDir };
  } catch (e) {
    const errorMsg = (e as Error).message;
    console.error('[Transfer] Prepare error:', errorMsg);
    updateProgress({ phase: 'error', message: errorMsg, error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

// ── Detect: Check USBs for transfer data ────────────────────────────────────────

export interface TransferManifest {
  version: string;
  application: string;
  createdAt: string;
  sourceHostname: string;
  sourcePlatform: string;
  sourceArch: string;
  totalFiles: number;
  bytesWritten: number;
  dataDir: string;
  userName: string;
  userEmail: string;
}

/** Check if a specific mountpoint has transfer data */
export function detectTransferOnDevice(mountpoint: string): TransferManifest | null {
  const manifestPath = path.join(mountpoint, TRANSFER_DIR_NAME, 'manifest.json');
  try {
    if (fs.existsSync(manifestPath)) {
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (data.application === 'Arcellite' && data.version) {
        return data as TransferManifest;
      }
    }
  } catch { /* not valid transfer data */ }
  return null;
}

// ── Import: Restore from transfer package ───────────────────────────────────────

/** Import transfer data from a USB drive. Used during setup wizard. */
export async function importTransferData(
  mountpoint: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; user?: any; sessionToken?: string }> {
  const transferDir = path.join(mountpoint, TRANSFER_DIR_NAME);

  try {
    // Validate
    const manifest = detectTransferOnDevice(mountpoint);
    if (!manifest) {
      return { success: false, error: 'No valid transfer data found on this device' };
    }

    resetProgress();
    updateProgress({
      phase: 'importing-account',
      percent: 5,
      message: 'Importing account...',
      startedAt: new Date().toISOString(),
    });

    // 1. Read database JSON
    const dbPath = path.join(transferDir, 'database.json');
    if (!fs.existsSync(dbPath)) {
      return { success: false, error: 'Transfer package is incomplete — missing database.json' };
    }
    const dbData: Record<string, any[]> = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

    // 2. Import user account — create new user with transferred info + new password
    const oldUser = dbData.users?.[0];
    if (!oldUser) {
      return { success: false, error: 'No user account found in transfer data' };
    }

updateProgress({ percent: 8, message: 'Creating user account...' });

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, avatar_url, storage_path, is_setup_complete, email_verified, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, NOW())
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           avatar_url = EXCLUDED.avatar_url,
           is_setup_complete = TRUE,
           email_verified = TRUE
         RETURNING id, email, first_name, last_name, avatar_url, is_setup_complete, email_verified`,
        [
          oldUser.email,
          passwordHash,
          oldUser.first_name || 'User',
          oldUser.last_name || '',
          oldUser.avatar_url || '',
          baseDir,
        ]
      );
      const newUser = userResult.rows[0];
      const userId = newUser.id;

      // Build DB row count tracking
      const dbRowCounts: { table: string; imported: number; total: number }[] = [
        { table: 'Settings', imported: 0, total: dbData.user_settings?.length || 0 },
        { table: 'File Metadata', imported: 0, total: dbData.file_metadata?.length || 0 },
        { table: 'Recent Files', imported: 0, total: dbData.recent_files?.length || 0 },
        { table: 'Connected Apps', imported: 0, total: dbData.connected_apps?.length || 0 },
        { table: 'Activity Log', imported: 0, total: dbData.activity_log?.length || 0 },
        { table: 'Notifications', imported: 0, total: dbData.notifications?.length || 0 },
      ];

      updateProgress({
        phase: 'importing-db',
        percent: 10,
        message: 'Restoring user settings...',
        dbRows: dbRowCounts,
      });

      // Import user settings
      if (dbData.user_settings?.length) {
        const s = dbData.user_settings[0];
        const prefs = typeof s.preferences === 'string' ? s.preferences : JSON.stringify(s.preferences || {});
        await client.query(
          `INSERT INTO user_settings (user_id, theme, language, notifications_enabled, preferences)
           VALUES ($1, $2, $3, $4, $5::jsonb)
           ON CONFLICT (user_id) DO UPDATE SET
             theme = EXCLUDED.theme, language = EXCLUDED.language,
             notifications_enabled = EXCLUDED.notifications_enabled,
             preferences = EXCLUDED.preferences`,
          [userId, s.theme || 'system', s.language || 'en', s.notifications_enabled ?? true, prefs]
        );
        dbRowCounts[0].imported = 1;
        updateProgress({ percent: 12, message: 'Settings restored', dbRows: [...dbRowCounts] });
      }

      // Import file metadata
      if (dbData.file_metadata?.length) {
        for (let i = 0; i < dbData.file_metadata.length; i++) {
          const m = dbData.file_metadata[i];
          try {
            await client.query(
              `INSERT INTO file_metadata (user_id, file_path, is_favorite, tags, custom_properties, created_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (user_id, file_path) DO UPDATE SET
                 is_favorite = EXCLUDED.is_favorite, tags = EXCLUDED.tags, custom_properties = EXCLUDED.custom_properties`,
              [userId, m.file_path, m.is_favorite || false, m.tags || '{}', m.custom_properties || '{}', m.created_at || new Date().toISOString()]
            );
            dbRowCounts[1].imported = i + 1;
          } catch { /* skip duplicates */ }
        }
        updateProgress({ percent: 14, message: `${dbRowCounts[1].imported} file metadata entries restored`, dbRows: [...dbRowCounts] });
      }

      // Import recent files (all of them)
      if (dbData.recent_files?.length) {
        const totalRecent = dbData.recent_files.length;
        for (let i = 0; i < totalRecent; i++) {
          const r = dbData.recent_files[i];
          try {
            await client.query(
              `INSERT INTO recent_files (user_id, file_path, file_name, file_type, category, size_bytes, accessed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (user_id, file_path) DO UPDATE SET accessed_at = EXCLUDED.accessed_at`,
              [userId, r.file_path, r.file_name, r.file_type || 'file', r.category || 'general', r.size_bytes || 0, r.accessed_at || new Date().toISOString()]
            );
            dbRowCounts[2].imported = i + 1;
            // Update progress every 20 rows
            if ((i + 1) % 20 === 0 || i === totalRecent - 1) {
              const dbPercent = 14 + Math.round(((i + 1) / totalRecent) * 8); // 14-22%
              updateProgress({ percent: dbPercent, message: `Restoring recent files... ${i + 1}/${totalRecent}`, dbRows: [...dbRowCounts] });
            }
          } catch { /* skip */ }
        }
      }

      // Import connected apps
      if (dbData.connected_apps?.length) {
        for (let i = 0; i < dbData.connected_apps.length; i++) {
          const app = dbData.connected_apps[i];
          try {
            await client.query(
              `INSERT INTO connected_apps (user_id, app_type, app_name, config, is_active)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT DO NOTHING`,
              [userId, app.app_type, app.app_name, app.config || '{}', app.is_active ?? true]
            );
            dbRowCounts[3].imported = i + 1;
          } catch { /* skip */ }
        }
        updateProgress({ percent: 23, message: `Connected apps restored`, dbRows: [...dbRowCounts] });
      }

      // Import activity log
      if (dbData.activity_log?.length) {
        const totalActivity = dbData.activity_log.length;
        for (let i = 0; i < totalActivity; i++) {
          const a = dbData.activity_log[i];
          try {
            const metadata = typeof a.metadata === 'string' ? a.metadata : JSON.stringify(a.metadata || {});
            await client.query(
              `INSERT INTO activity_log (user_id, action, details, resource_type, resource_path, metadata, ip_address, user_agent, created_at)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
              [userId, a.action, a.details || null, a.resource_type || null, a.resource_path || null, metadata, a.ip_address || null, a.user_agent || null, a.created_at || new Date().toISOString()]
            );
            dbRowCounts[4].imported = i + 1;
          } catch { /* skip duplicates */ }
        }
        updateProgress({ percent: 26, message: `${totalActivity} activity log entries restored`, dbRows: [...dbRowCounts] });
      }

      // Import notifications
      if (dbData.notifications?.length) {
        const totalNotif = dbData.notifications.length;
        for (let i = 0; i < totalNotif; i++) {
          const n = dbData.notifications[i];
          try {
            await client.query(
              `INSERT INTO notifications (user_id, title, message, type, category, is_read, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [userId, n.title, n.message || null, n.type || 'info', n.category || 'system', n.is_read ?? false, n.created_at || new Date().toISOString()]
            );
            dbRowCounts[5].imported = i + 1;
          } catch { /* skip */ }
        }
        updateProgress({ percent: 28, message: `${totalNotif} notifications restored`, dbRows: [...dbRowCounts] });
      }

      await client.query('COMMIT');
      updateProgress({ percent: 30, message: 'Database import complete', dbRows: [...dbRowCounts] });

      // 3. Copy files — build per-category tracking
      copyPercentBase = 30;
      copyPercentRange = 65;
      updateProgress({ phase: 'importing-files', percent: 30, message: 'Scanning file categories...' });

      const srcFilesDir = path.join(transferDir, 'files');
      if (fs.existsSync(srcFilesDir)) {
        // Count files per category
        const categoryProgress: CategoryProgress[] = [];
        let totalFiles = 0;
        for (const subdir of DATA_SUBDIRS) {
          const catDir = path.join(srcFilesDir, subdir);
          const catCount = countFiles(catDir);
          if (catCount > 0 || fs.existsSync(catDir)) {
            categoryProgress.push({
              name: subdir,
              label: CATEGORY_LABELS[subdir] || subdir,
              filesCopied: 0,
              totalFiles: catCount,
              bytesCopied: 0,
              done: catCount === 0,
            });
            totalFiles += catCount;
          }
        }
        updateProgress({
          totalFiles,
          categories: categoryProgress,
          message: `Found ${totalFiles.toLocaleString()} files across ${categoryProgress.filter(c => c.totalFiles > 0).length} categories`,
        });

        for (const subdir of DATA_SUBDIRS) {
          const src = path.join(srcFilesDir, subdir);
          const dest = path.join(baseDir, subdir);
          if (fs.existsSync(src)) {
            const catLabel = CATEGORY_LABELS[subdir] || subdir;
            updateProgress({ currentCategory: subdir, message: `Copying ${catLabel}...` });
            fs.mkdirSync(dest, { recursive: true });
            copyDirRecursive(src, dest, subdir);
            // Mark category done
            const cat = currentProgress.categories?.find(c => c.name === subdir);
            if (cat) cat.done = true;
            updateProgress({ categories: currentProgress.categories ? [...currentProgress.categories] : undefined });
          }
        }
      }

      // Create a session so the user is automatically logged in (before setting phase to 'done')
      let sessionToken: string | undefined;
      try {
        const session = await createSession(newUser.id, {
          userAgent: 'Arcellite Transfer Import',
          isCurrentHost: true,
        });
        sessionToken = session.sessionToken;
      } catch (e) {
        console.error('[Transfer] Failed to create session after import:', (e as Error).message);
      }

      updateProgress({
        phase: 'done',
        percent: 100,
        message: 'Transfer complete!',
        completedAt: new Date().toISOString(),
        sessionToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          avatarUrl: newUser.avatar_url,
          isSetupComplete: true,
          emailVerified: true,
        },
      });

      return {
        success: true,
        sessionToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          avatarUrl: newUser.avatar_url,
          isSetupComplete: true,
          emailVerified: true,
        },
      };
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (e) {
    const errorMsg = (e as Error).message;
    console.error('[Transfer] Import error:', errorMsg);
    updateProgress({ phase: 'error', message: errorMsg, error: errorMsg });
    return { success: false, error: errorMsg };
  }
}
