import type { IncomingMessage, ServerResponse } from 'http';
import Busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as authService from '../services/auth.service.js';
import * as securityService from '../services/security.service.js';

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
    (async () => {
      try {
        const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
        const category = urlObj.searchParams.get('category') || 'general';
        const pathParam = urlObj.searchParams.get('path') || '';
        const searchQuery = urlObj.searchParams.get('q') || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const categoryDir = catMap[category] || 'files';
        const targetDir = path.join(baseDir, categoryDir, pathParam);

        if (!fs.existsSync(targetDir)) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ folders: [], files: [] }));
          return;
        }

        // Get user for security settings
        let ghostFolders: string[] = [];
        let obfuscateFiles = false;
        try {
          const authHeader = req.headers.authorization;
          if (authHeader?.startsWith('Bearer ')) {
            const user = await authService.validateSession(authHeader.substring(7));
            if (user) {
              const settings = await authService.getUserSettings(user.id);
              if (settings.secGhostFolders) {
                ghostFolders = await securityService.getGhostFolders(user.id);
              }
              obfuscateFiles = settings.secFileObfuscation;
            }
          }
        } catch { /* continue without security features */ }

        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        let folders = entries
          .filter((e) => e.isDirectory())
          .map((e) => {
            const fullPath = path.join(targetDir, e.name);
            const stat = fs.statSync(fullPath);
            let itemCount = 0;
            try {
              itemCount = fs.readdirSync(fullPath).length;
            } catch {}
            return { name: e.name, mtimeMs: stat.mtimeMs, itemCount };
          });

        // Apply ghost folders filter (hide unless explicitly searched)
        if (ghostFolders.length > 0 && !searchQuery) {
          const currentPath = path.join(categoryDir, pathParam);
          folders = folders.filter(f => {
            const folderFullPath = path.join(currentPath, f.name);
            return !ghostFolders.some(gf => folderFullPath === gf || folderFullPath.startsWith(gf + '/'));
          });
        }

        let files = entries
          .filter((e) => e.isFile())
          .map((e) => {
            const fullPath = path.join(targetDir, e.name);
            const stat = fs.statSync(fullPath);
            return { name: e.name, mtimeMs: stat.mtimeMs, sizeBytes: stat.size };
          });

        // Apply file obfuscation (randomize timestamps and fuzz sizes)
        if (obfuscateFiles) {
          files = files.map(f => securityService.obfuscateFileEntry(f) as typeof f);
          folders = folders.map(f => ({
            ...securityService.obfuscateFileEntry({ name: f.name, mtimeMs: f.mtimeMs, isFolder: true }),
            itemCount: f.itemCount,
          }));
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ folders, files }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    })();
    return true;
  }

  // File serving (exclude serve-external which is handled by vite middleware)
  if (url?.startsWith('/api/files/serve') && !url?.startsWith('/api/files/serve-external') && req.method === 'GET') {
    try {
      const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
      const category = urlObj.searchParams.get('category') || 'general';
      const pathParam = urlObj.searchParams.get('path') || '';

      const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
      const categoryDir = catMap[category] || 'files';
      const filePath = path.join(baseDir, categoryDir, pathParam);

      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('File not found');
        return true;
      }

      // Guard against trying to read a directory
      const fileStat = fs.statSync(filePath);
      if (fileStat.isDirectory()) {
        res.statusCode = 400;
        res.end('Cannot serve a directory');
        return true;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg',
        '.aac': 'audio/aac',
        '.m4a': 'audio/mp4',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      const fileSize = fileStat.size;

      // Support HTTP Range requests (required for mobile video/audio playback)
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
        });

        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000',
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      }
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

      const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
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

  // Cross-category file move (e.g., move a PDF from Videos to Files)
  if (url === '/api/files/move-cross' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const sourceCategory = (body.sourceCategory as string) || 'general';
        const sourcePath = (body.sourcePath as string) || '';
        const targetCategory = (body.targetCategory as string) || 'general';
        const targetPath = (body.targetPath as string) || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const srcDir = catMap[sourceCategory] || 'files';
        const tgtDir = catMap[targetCategory] || 'files';
        const sourceFullPath = path.join(baseDir, srcDir, sourcePath);
        const targetFullPath = path.join(baseDir, tgtDir, targetPath);

        if (!fs.existsSync(sourceFullPath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Source file does not exist' }));
          return;
        }

        if (fs.existsSync(targetFullPath)) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'A file with the same name already exists in the target location' }));
          return;
        }

        const targetDir = path.dirname(targetFullPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        try {
          fs.renameSync(sourceFullPath, targetFullPath);
        } catch (err: any) {
          if (err.code === 'EXDEV') {
            fs.copyFileSync(sourceFullPath, targetFullPath);
            fs.unlinkSync(sourceFullPath);
          } else {
            throw err;
          }
        }

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

  // Save shared file from external service (Google Drive, etc.) to vault
  if ((url === '/api/files/save-shared' || url?.startsWith('/api/files/save-shared?')) && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { fileId, fileName, mimeType, appId, webhookUrl } = JSON.parse(body);
        if (!fileId || !fileName) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'fileId and fileName are required' }));
          return;
        }

        // Determine the download webhook — use the same webhook base with a download action
        const baseWebhookUrl = webhookUrl || 'https://n8n.arcelliteserver.com/webhook/google-files';

        // Try to download the file via n8n webhook by POSTing with download action
        let downloadResponse: Response | null = null;

        // Strategy 1: POST to the same webhook with download action
        try {
          downloadResponse = await fetch(baseWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'download', fileId, mimeType }),
          });

          // If POST returned error or HTML, try GET with query param
          if (!downloadResponse.ok || downloadResponse.headers.get('content-type')?.includes('text/html')) {
            downloadResponse = null;
          }
        } catch {
          downloadResponse = null;
        }

        // Strategy 2: GET with fileId query param
        if (!downloadResponse) {
          try {
            downloadResponse = await fetch(`${baseWebhookUrl}?action=download&fileId=${encodeURIComponent(fileId)}&mimeType=${encodeURIComponent(mimeType || '')}`, {
              method: 'GET',
            });
            if (!downloadResponse.ok) {
              downloadResponse = null;
            }
          } catch {
            downloadResponse = null;
          }
        }

        // Strategy 3: Try a dedicated download webhook
        if (!downloadResponse) {
          const downloadWebhookUrl = baseWebhookUrl.replace(/\/webhook\/.*$/, '/webhook/google-download');
          try {
            downloadResponse = await fetch(`${downloadWebhookUrl}?fileId=${encodeURIComponent(fileId)}&mimeType=${encodeURIComponent(mimeType || '')}`, {
              method: 'GET',
            });
            if (!downloadResponse.ok) {
              downloadResponse = null;
            }
          } catch {
            downloadResponse = null;
          }
        }

        if (!downloadResponse) {
          res.statusCode = 422;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Could not download file. Your n8n workflow needs to support file downloads.',
            hint: 'Update your Google Drive n8n workflow to handle POST requests with { action: "download", fileId } and return the file binary data.',
          }));
          return;
        }

        // Determine target category and file extension
        const ext = path.extname(fileName).toLowerCase();
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm'];
        const audioExts = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];

        let category = 'files';
        if (imageExts.includes(ext)) category = 'photos';
        else if (videoExts.includes(ext)) category = 'videos';
        else if (audioExts.includes(ext)) category = 'music';

        // Add extension for Google Workspace files (Docs → .pdf, Sheets → .xlsx, Slides → .pptx)
        let savedFileName = fileName;
        if (!ext || ext === '.') {
          if (mimeType?.includes('google-apps.document')) savedFileName += '.pdf';
          else if (mimeType?.includes('google-apps.spreadsheet')) savedFileName += '.xlsx';
          else if (mimeType?.includes('google-apps.presentation')) savedFileName += '.pptx';
          else savedFileName += '.pdf';
        }

        // Sanitize filename
        savedFileName = savedFileName.replace(/[<>:"|?*]/g, '_');

        // Save to vault
        const targetDir = path.join(baseDir, category);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Avoid overwriting — add number suffix if file exists
        let finalPath = path.join(targetDir, savedFileName);
        let counter = 1;
        const baseName = path.parse(savedFileName).name;
        const finalExt = path.extname(savedFileName);
        while (fs.existsSync(finalPath)) {
          finalPath = path.join(targetDir, `${baseName} (${counter})${finalExt}`);
          counter++;
        }

        // Write file to disk
        const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
        fs.writeFileSync(finalPath, fileBuffer);

        const savedName = path.basename(finalPath);
        const fileSizeBytes = fs.statSync(finalPath).size;

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ok: true,
          savedFileName: savedName,
          category,
          sizeBytes: fileSizeBytes,
          path: `${category}/${savedName}`,
        }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // Clear all files (Danger Zone)
  if (url === '/api/files/clear-all' && req.method === 'POST') {
    import('../files.ts').then(({ clearAllFiles }) => {
      try {
        const result = clearAllFiles();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // Delete external file/folder (removable devices)
  if (url === '/api/files/delete-external' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        const { deleteExternal } = await import('../files.js');
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!body.path) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing path' }));
          return;
        }
        deleteExternal(body.path);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return true;
  }

  // Rename external file/folder (removable devices)
  if (url === '/api/files/rename-external' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        const { renameExternal } = await import('../files.js');
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!body.path || !body.newName) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing path or newName' }));
          return;
        }
        const newPath = renameExternal(body.path, body.newName);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, newPath }));
      } catch (e: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return true;
  }

  // Create folder on external path (removable devices)
  if (url === '/api/files/mkdir-external' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        const { mkdirExternal } = await import('../files.js');
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!body.path) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing path' }));
          return;
        }
        mkdirExternal(body.path);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return true;
  }

  return false;
}