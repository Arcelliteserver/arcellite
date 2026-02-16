import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import archiver from 'archiver';
import { pool } from '../db/connection.js';

const homeDir = os.homedir();
let baseDir = process.env.ARCELLITE_DATA || path.join(homeDir, 'arcellite-data');
if (baseDir.startsWith('~/') || baseDir === '~') {
  baseDir = path.join(homeDir, baseDir.slice(2));
}

const CATEGORY_DIR: Record<string, string> = {
  general: 'files',
  media: 'photos',
  video_vault: 'videos',
  music: 'music',
  shared: 'shared',
};

/** Recursively walk a directory and collect file info */
function walkDir(dir: string, basePath: string = ''): Array<{ name: string; path: string; size: number; modified: string; isFolder: boolean }> {
  const results: Array<{ name: string; path: string; size: number; modified: string; isFolder: boolean }> = [];
  if (!fs.existsSync(dir)) return results;

  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      try {
        const stat = fs.statSync(fullPath);
        const relativePath = basePath ? `${basePath}/${entry}` : entry;
        results.push({
          name: entry,
          path: relativePath,
          size: stat.isFile() ? stat.size : 0,
          modified: stat.mtime.toISOString(),
          isFolder: stat.isDirectory(),
        });
        if (stat.isDirectory()) {
          results.push(...walkDir(fullPath, relativePath));
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Skip directories we can't read
  }
  return results;
}

/** Collect all files across all categories */
function getAllFiles(): Array<{ category: string; name: string; path: string; size: number; modified: string; isFolder: boolean }> {
  const allFiles: Array<{ category: string; name: string; path: string; size: number; modified: string; isFolder: boolean }> = [];
  for (const [category, dirName] of Object.entries(CATEGORY_DIR)) {
    const categoryPath = path.join(baseDir, dirName);
    const files = walkDir(categoryPath);
    for (const file of files) {
      allFiles.push({ category, ...file });
    }
  }
  return allFiles;
}

/** Get all user data from the database */
async function getUserData(userId?: number) {
  const client = await pool.connect();
  try {
    // Get user profile (strip password hash)
    const userResult = await client.query(
      'SELECT id, email, first_name, last_name, avatar_url, storage_path, is_setup_complete, email_verified, created_at, updated_at FROM users' +
      (userId ? ' WHERE id = $1' : ' LIMIT 1'),
      userId ? [userId] : []
    );

    // Get recent files
    const recentResult = await client.query(
      'SELECT file_path, file_name, file_type, category, size_bytes, accessed_at FROM recent_files ORDER BY accessed_at DESC'
    );

    // Get file metadata
    const metadataResult = await client.query(
      'SELECT file_path, is_favorite, tags, custom_properties, created_at, updated_at FROM file_metadata'
    );

    // Get activity log
    const activityResult = await client.query(
      'SELECT action, details, resource_type, resource_path, metadata, created_at FROM activity_log ORDER BY created_at DESC LIMIT 500'
    );

    // Get notifications
    const notificationsResult = await client.query(
      'SELECT title, message, type, category, is_read, created_at FROM notifications ORDER BY created_at DESC LIMIT 200'
    );

    // Get user settings
    const settingsResult = await client.query(
      'SELECT theme, language, notifications_enabled, preferences, created_at, updated_at FROM user_settings LIMIT 1'
    );

    // Get connected apps (without credentials)
    const appsResult = await client.query(
      'SELECT app_type, app_name, config, is_active, created_at, updated_at FROM connected_apps'
    );

    return {
      exportDate: new Date().toISOString(),
      version: '1.0',
      application: 'Arcellite',
      user: userResult.rows[0] || null,
      recentFiles: recentResult.rows,
      fileMetadata: metadataResult.rows,
      activityLog: activityResult.rows,
      notifications: notificationsResult.rows,
      settings: settingsResult.rows[0] || null,
      connectedApps: appsResult.rows,
    };
  } finally {
    client.release();
  }
}

export function handleExportRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  // JSON Export — all user data as JSON
  if (url === '/api/export/json' && req.method === 'GET') {
    (async () => {
      try {
        const userData = await getUserData();
        const files = getAllFiles();

        const exportData = {
          ...userData,
          fileSystem: files,
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="arcellite-export-${timestamp}.json"`);
        res.setHeader('Content-Length', Buffer.byteLength(jsonStr));
        res.end(jsonStr);
      } catch (e) {
        console.error('[Export] JSON export error:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Export failed: ' + (e as Error).message }));
      }
    })();
    return true;
  }

  // CSV Export — file listing as CSV
  if (url === '/api/export/csv' && req.method === 'GET') {
    try {
      const files = getAllFiles();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      // Build CSV
      const headers = ['Category', 'Name', 'Path', 'Type', 'Size (bytes)', 'Modified'];
      const rows = files.map(f => [
        escapeCsv(f.category),
        escapeCsv(f.name),
        escapeCsv(f.path),
        f.isFolder ? 'folder' : 'file',
        f.size.toString(),
        f.modified,
      ].join(','));

      const csv = [headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="arcellite-files-${timestamp}.csv"`);
      res.setHeader('Content-Length', Buffer.byteLength(csv));
      res.end(csv);
    } catch (e) {
      console.error('[Export] CSV export error:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Export failed: ' + (e as Error).message }));
    }
    return true;
  }

  // Full Backup — ZIP containing JSON + CSV + metadata
  if (url === '/api/export/backup' && req.method === 'GET') {
    (async () => {
      try {
        const userData = await getUserData();
        const files = getAllFiles();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

        // JSON data
        const jsonData = JSON.stringify({ ...userData, fileSystem: files }, null, 2);

        // CSV data
        const csvHeaders = ['Category', 'Name', 'Path', 'Type', 'Size (bytes)', 'Modified'];
        const csvRows = files.map(f => [
          escapeCsv(f.category),
          escapeCsv(f.name),
          escapeCsv(f.path),
          f.isFolder ? 'folder' : 'file',
          f.size.toString(),
          f.modified,
        ].join(','));
        const csvData = [csvHeaders.join(','), ...csvRows].join('\n');

        // Metadata JSON (local file if it exists)
        const metadataPath = path.join(baseDir, 'databases', 'metadata.json');
        let metadataContent = '{}';
        if (fs.existsSync(metadataPath)) {
          metadataContent = fs.readFileSync(metadataPath, 'utf-8');
        }

        // Create ZIP archive
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="arcellite-backup-${timestamp}.zip"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err: Error) => {
          console.error('[Export] Archive error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Backup failed' }));
          }
        });

        archive.pipe(res);

        // Add files to archive
        archive.append(jsonData, { name: 'arcellite-data.json' });
        archive.append(csvData, { name: 'arcellite-files.csv' });
        archive.append(metadataContent, { name: 'databases-metadata.json' });

        // Add a README
        const readme = `Arcellite Backup
================
Created: ${new Date().toISOString()}

Contents:
- arcellite-data.json    — Full data export (user profile, recent files, activity log, notifications, settings, file listing)
- arcellite-files.csv    — File listing in CSV format
- databases-metadata.json — Database instances metadata

This backup contains your Arcellite configuration and metadata.
Actual file contents are NOT included in this backup.
`;
        archive.append(readme, { name: 'README.txt' });

        await archive.finalize();
      } catch (e) {
        console.error('[Export] Backup export error:', e);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Backup failed: ' + (e as Error).message }));
        }
      }
    })();
    return true;
  }

  return false;
}

/** Escape a CSV field value */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
