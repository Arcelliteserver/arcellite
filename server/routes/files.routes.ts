import type { IncomingMessage, ServerResponse } from 'http';
import Busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import os from 'os';

const homeDir = os.homedir();
let baseDir = process.env.ARCELLITE_DATA || path.join(homeDir, 'arcellite-data');
// Expand leading ~ to homedir
if (baseDir.startsWith('~/') || baseDir === '~') {
  baseDir = path.join(homeDir, baseDir.slice(2));
}

export function handleFileRoutes(req: IncomingMessage, res: ServerResponse, url: string) {
  // File upload
  if (url === '/api/files/upload' && req.method === 'POST') {
    const busboy = Busboy({ headers: req.headers as any });
    let category = 'general';
    let relativePath = '';
    const fileBuffers: { filename: string; buffer: Buffer }[] = [];

    busboy.on('field', (name: string, value: string) => {
      if (name === 'category') category = value;
      if (name === 'path') relativePath = value;
    });

    busboy.on('file', (name: string, file: any, info: { filename: string }) => {
      const chunks: Buffer[] = [];
      file.on('data', (chunk: Buffer) => chunks.push(chunk));
      file.on('end', () => {
        fileBuffers.push({ filename: info.filename, buffer: Buffer.concat(chunks) });
      });
    });

    busboy.on('finish', () => {
      try {
        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const categoryDir = catMap[category] || 'files';
        const targetDir = path.join(baseDir, categoryDir, relativePath);

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const uploadedFiles = fileBuffers.map(({ filename, buffer }) => {
          const targetPath = path.join(targetDir, filename);
          fs.writeFileSync(targetPath, buffer);
          return { filename, path: targetPath };
        });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, files: uploadedFiles }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });

    req.pipe(busboy);
    return true;
  }

  // File listing (but NOT list-external — that's handled separately in vite.config.ts middleware)
  if (url?.startsWith('/api/files/list') && !url?.startsWith('/api/files/list-external') && req.method === 'GET') {
    try {
      const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
      const category = urlObj.searchParams.get('category') || 'general';
      const pathParam = urlObj.searchParams.get('path') || '';

      const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
      const categoryDir = catMap[category] || 'files';
      const targetDir = path.join(baseDir, categoryDir, pathParam);

      if (!fs.existsSync(targetDir)) {
        // Return empty result instead of auto-creating missing directories
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ folders: [], files: [] }));
        return true;
      }

      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      const folders = entries
        .filter((e) => e.isDirectory())
        .map((e) => {
          const fullPath = path.join(targetDir, e.name);
          const stat = fs.statSync(fullPath);
          // Count children (files + subfolders) inside this folder
          let itemCount = 0;
          try {
            itemCount = fs.readdirSync(fullPath).length;
          } catch {}
          return { name: e.name, mtimeMs: stat.mtimeMs, itemCount };
        });

      const files = entries
        .filter((e) => e.isFile())
        .map((e) => {
          const fullPath = path.join(targetDir, e.name);
          const stat = fs.statSync(fullPath);
          return { name: e.name, mtimeMs: stat.mtimeMs, sizeBytes: stat.size };
        });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ folders, files }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    }
    return true;
  }

  // File serving (exclude serve-external which is handled by vite middleware)
  if (url?.startsWith('/api/files/serve') && !url?.startsWith('/api/files/serve-external') && req.method === 'GET') {
    try {
      const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
      const category = urlObj.searchParams.get('category') || 'general';
      const pathParam = urlObj.searchParams.get('path') || '';

      const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files' };
      const categoryDir = catMap[category] || 'files';
      const filePath = path.join(baseDir, categoryDir, pathParam);

      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('File not found');
        return true;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (e) {
      res.statusCode = 500;
      res.end('Server error');
    }
    return true;
  }

  // File download
  if (url?.startsWith('/api/files/download') && req.method === 'GET') {
    try {
      const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
      const category = urlObj.searchParams.get('category') || 'general';
      const pathParam = urlObj.searchParams.get('path') || '';

      const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files' };
      const categoryDir = catMap[category] || 'files';
      const filePath = path.join(baseDir, categoryDir, pathParam);

      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('File not found');
        return true;
      }

      const filename = path.basename(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (e) {
      res.statusCode = 500;
      res.end('Server error');
    }
    return true;
  }

  // File/folder creation (mkdir)
  if (url === '/api/files/mkdir' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const category = (body.category as string) || 'general';
        const relativePath = (body.path as string) || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const categoryDir = catMap[category] || 'files';
        const targetPath = path.join(baseDir, categoryDir, relativePath);

        fs.mkdirSync(targetPath, { recursive: true });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // File/folder creation
  if (url === '/api/files/create' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const category = (body.category as string) || 'general';
        const pathParam = (body.path as string) || '';
        const name = (body.name as string) || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files' };
        const categoryDir = catMap[category] || 'files';
        const targetPath = path.join(baseDir, categoryDir, pathParam, name);

        fs.mkdirSync(targetPath, { recursive: true });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // File/folder deletion
  if (url === '/api/files/delete' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const category = (body.category as string) || 'general';
        const pathParam = (body.path as string) || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files' };
        const categoryDir = catMap[category] || 'files';
        const targetPath = path.join(baseDir, categoryDir, pathParam);

        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }

        // Clean up from recent files database
        import('../services/auth.service.ts').then(({ removeRecentFilesUnderPath }) => {
          removeRecentFilesUnderPath(pathParam, category);
        }).catch(err => console.error('[Files] Failed to clean recent files:', err));

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // File/folder move
  if (url === '/api/files/move' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const category = (body.category as string) || 'general';
        const sourcePath = (body.sourcePath as string) || '';
        const targetPath = (body.targetPath as string) || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const categoryDir = catMap[category] || 'files';
        const sourceFullPath = path.join(baseDir, categoryDir, sourcePath);
        const targetFullPath = path.join(baseDir, categoryDir, targetPath);

        const targetDir = path.dirname(targetFullPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.renameSync(sourceFullPath, targetFullPath);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  return false;
}
