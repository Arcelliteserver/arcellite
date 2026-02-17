import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import os from 'os';

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, error: string, status = 500) {
  sendJson(res, { error }, status);
}

export function handleAIRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {

  // ── Get configured providers (providers with API keys) ─────────
  if (url === '/api/ai/configured-providers' && req.method === 'GET') {
    import('../ai.js').then(({ getConfiguredProviders }) => {
      try {
        const providers = getConfiguredProviders();
        sendJson(res, { ok: true, providers });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String(e.message)));
    return true;
  }

  // ── Save API Keys ──────────────────────────────────────────────
  if (url === '/api/ai/keys/save' && req.method === 'POST') {
    parseBody(req).then(async (body) => {
      try {
        const { saveApiKeys } = await import('../ai.js');
        saveApiKeys(body.keys || {});
        sendJson(res, { ok: true });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // ── Load API Keys ──────────────────────────────────────────────
  if (url === '/api/ai/keys/load' && req.method === 'GET') {
    import('../ai.js').then(({ loadApiKeys }) => {
      try {
        const keys = loadApiKeys();
        // Mask the keys for frontend display (show first 8 + last 4 chars)
        const masked: Record<string, string> = {};
        for (const [provider, key] of Object.entries(keys)) {
          if (key && key.length > 12) {
            masked[provider] = key; // Send full key — masking is done in the frontend
          } else {
            masked[provider] = key;
          }
        }
        sendJson(res, { ok: true, keys: masked });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // ── Test Connection ────────────────────────────────────────────
  if (url === '/api/ai/keys/test' && req.method === 'POST') {
    parseBody(req).then(async (body) => {
      try {
        const { testConnection } = await import('../ai.js');
        const result = await testConnection(body.provider || 'DeepSeek');
        sendJson(res, result);
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // ── Chat (Streaming via SSE) ───────────────────────────────────
  if (url === '/api/ai/chat' && req.method === 'POST') {
    parseBody(req).then(async (body) => {
      try {
        const { chatWithAI, executeAction } = await import('../ai.js');

        const currentMessages = [...(body.messages || [])];
        const model = body.model || 'deepseek-chat';
        const userEmail = body.userEmail || undefined;

        // Load AI security permissions for this user
        let aiPermissions: Record<string, boolean> = {};
        if (userEmail) {
          try {
            const { getAIPermissionsByEmail } = await import('../services/auth.service.js');
            aiPermissions = await getAIPermissionsByEmail(userEmail);
          } catch {
            // Fallback: allow all if permissions can't be loaded
          }
        }

        // Map action type → permission key
        const ACTION_PERMISSION_MAP: Record<string, string> = {
          create_file: 'aiFileCreate',
          create_folder: 'aiFolderCreate',
          delete: 'aiFileDelete',
          rename: 'aiFileModify',
          trash: 'aiFileDelete',
          move_file: 'aiFileOrganize',
          organize: 'aiFileOrganize',
          list: 'aiFileRead',
          list_trash: 'aiTrashAccess',
          empty_trash: 'aiTrashEmpty',
          restore_from_trash: 'aiTrashRestore',
          delete_from_trash: 'aiTrashEmpty',
          create_database: 'aiDatabaseCreate',
          delete_database: 'aiDatabaseDelete',
          create_table: 'aiDatabaseCreate',
          query: 'aiDatabaseQuery',
          send_email: 'aiSendEmail',
          cast: 'aiCastMedia',
          discord_send: 'aiSendEmail',
          show_image: 'aiFileRead',
          show_file: 'aiFileRead',
          list_databases: 'aiFileRead',
        };

        const ACTION_LABELS: Record<string, string> = {
          create_file: 'create files',
          create_folder: 'create folders',
          delete: 'delete files',
          rename: 'modify/rename files',
          trash: 'delete files (move to trash)',
          move_file: 'organize/move files',
          organize: 'organize files',
          list: 'read files',
          list_trash: 'access trash',
          empty_trash: 'empty trash',
          restore_from_trash: 'restore from trash',
          delete_from_trash: 'permanently delete from trash',
          create_database: 'create databases/tables',
          delete_database: 'delete databases',
          create_table: 'create tables',
          query: 'run SQL queries',
          send_email: 'send emails',
          cast: 'cast to devices',
          discord_send: 'send Discord messages',
          show_image: 'view files',
          show_file: 'view files',
          list_databases: 'view database info',
        };

        /** Check if an action is allowed by current permissions */
        function checkPermission(actionType: string): { allowed: boolean; message?: string } {
          const permKey = ACTION_PERMISSION_MAP[actionType];
          if (!permKey) return { allowed: true }; // Unknown action — allow by default
          if (aiPermissions[permKey] === false) {
            const label = ACTION_LABELS[actionType] || actionType;
            return {
              allowed: false,
              message: `⚠️ Action blocked: I don't have permission to **${label}**. You can enable this in **AI Security** settings (Profile → AI Security).`,
            };
          }
          return { allowed: true };
        }

        // Set SSE headers for streaming
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        const sendSSE = (event: string, data: any) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        const MAX_CONTINUATION_ITERATIONS = 15;

        for (let iteration = 0; iteration < MAX_CONTINUATION_ITERATIONS; iteration++) {
          const result = await chatWithAI(currentMessages, model, userEmail);

          if (result.error) {
            sendSSE('error', { error: result.error });
            break;
          }

          // Parse action blocks from the response
          const actionRegex = /```action\s*\n([\s\S]*?)```/g;
          let match;
          const actions: any[] = [];
          while ((match = actionRegex.exec(result.content)) !== null) {
            try {
              actions.push(JSON.parse(match[1].trim()));
            } catch {
              // Skip malformed JSON
            }
          }

          // Stream text content immediately
          const cleanContent = result.content.replace(/```action\s*\n[\s\S]*?```/g, '').trim();
          if (cleanContent) {
            sendSSE('text', { content: cleanContent });
          }

          // Execute actions one by one and stream each result
          const iterationResults: any[] = [];
          for (const action of actions) {
            // Check AI security permissions before executing
            const permCheck = checkPermission(action.type);
            if (!permCheck.allowed) {
              const blockedResult = { success: false, message: permCheck.message, blocked: true };
              iterationResults.push(blockedResult);
              sendSSE('action', blockedResult);
              continue;
            }
            const actionResult = await executeAction(action, userEmail);
            iterationResults.push(actionResult);
            sendSSE('action', actionResult);
          }

          // If no actions were executed, AI has finished
          if (actions.length === 0) {
            break;
          }

          // ── Continuation: feed action results back to AI ──
          currentMessages.push({
            role: 'assistant',
            content: result.content,
          });

          const resultsSummary = iterationResults.map((r: any, i: number) => {
            const action = actions[i];
            if (r.ok !== false && r.success !== false) {
              let summary = `✅ Action "${action.type}" completed successfully. ${r.message || ''}`;
              // For query actions, include actual row data so the AI can read real results
              if (action.type === 'query' && r.data && r.data.rows) {
                const rows = r.data.rows;
                const rowCount = r.data.rowCount ?? rows.length;
                if (rows.length > 0) {
                  // Truncate to first 50 rows to avoid token overflow
                  const displayRows = rows.slice(0, 50);
                  summary += ` Returned ${rowCount} row(s). Data:\n${JSON.stringify(displayRows, null, 0)}`;
                  if (rows.length > 50) {
                    summary += `\n... (showing first 50 of ${rowCount} rows)`;
                  }
                } else {
                  summary += ` Query returned 0 rows.`;
                }
              } else if (!r.data) {
                summary += JSON.stringify('');
              }
              return summary;
            } else {
              return `❌ Action "${action.type}" FAILED: ${r.error || r.message || 'unknown error'}. This action DID NOT complete — do not tell the user it succeeded.`;
            }
          }).join('\n');

          // Count successes and failures for the AI
          const successCount = iterationResults.filter((r: any) => r.ok !== false && r.success !== false).length;
          const failCount = iterationResults.length - successCount;
          const verifyNote = failCount > 0
            ? `\n\nWARNING: ${failCount} action(s) FAILED. Do NOT tell the user these succeeded. Report the failures honestly and retry with corrected paths if possible.`
            : '';

          currentMessages.push({
            role: 'user',
            content: `[SYSTEM — ACTION RESULTS (${successCount} succeeded, ${failCount} failed)]\n${resultsSummary}${verifyNote}\n\nContinue with the remaining steps of the original request. If ALL steps are now complete, provide a brief final summary with actual counts. Do NOT repeat actions that already succeeded. Do NOT claim success for actions that failed.`,
          });
        }

        sendSSE('done', {});
        res.end();
      } catch (e) {
        if (!res.headersSent) {
          sendError(res, String((e as Error).message));
        } else {
          try {
            res.write(`event: error\ndata: ${JSON.stringify({ error: String((e as Error).message) })}\n\n`);
          } catch {}
          res.end();
        }
      }
    }).catch((e) => {
      if (!res.headersSent) {
        sendError(res, String((e as Error).message));
      }
    });
    return true;
  }

  // ── AI Batch Rename: Rename existing images with Gemini Vision (SSE) ──
  if (url === '/api/ai/batch-rename' && req.method === 'POST') {
    parseBody(req).then(async (body) => {
      try {
        const { category } = body;
        if (!category) {
          sendError(res, 'category is required', 400);
          return;
        }

        const { analyzeImageForTitle } = await import('../ai.js');
        const { listDir, moveFile } = await import('../files.js');
        const { markAsAiRenamed, isAiRenamed } = await import('../ai-metadata.js');

        // Set SSE headers for streaming progress
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        const sendSSE = (event: string, data: any) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        // Recursively collect all image files
        const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.avif', '.heic', '.heif']);
        const collectImages = (relDir: string): { name: string; relPath: string }[] => {
          const results: { name: string; relPath: string }[] = [];
          try {
            const entries = listDir(category, relDir);
            for (const entry of entries) {
              const entryPath = relDir ? `${relDir}/${entry.name}` : entry.name;
              if (entry.isFolder) {
                results.push(...collectImages(entryPath));
              } else {
                const ext = path.extname(entry.name).toLowerCase();
                if (IMAGE_EXTS.has(ext)) {
                  results.push({ name: entry.name, relPath: entryPath });
                }
              }
            }
          } catch { /* skip inaccessible dirs */ }
          return results;
        };

        const allImages = collectImages('');

        // Filter to images that likely have generic/auto-generated names
        const GENERIC_PATTERNS = [
          /^IMG[-_]/i, /^DSC[-_]/i, /^DCIM[-_]/i, /^P\d{6}/i,
          /^Screenshot/i, /^Screen Shot/i, /^Photo[-_\s]/i,
          /^image[-_\s]/i, /^PXL_/i, /^MVIMG/i, /^Snapchat/i,
          /^signal-/i, /^received_/i, /^photo_/i, /^pic_/i,
          /^\d{8}_\d{6}/,  // Timestamp-style: 20240101_120000
          /^[0-9a-f]{8}-[0-9a-f]{4}/i,  // UUID-style
          /^\d{13,}/, // Unix timestamp ms
        ];

        const candidates = allImages.filter(img => {
          const nameWithoutExt = path.parse(img.name).name;
          // Skip files already renamed by AI
          if (isAiRenamed(category, img.relPath)) return false;
          return GENERIC_PATTERNS.some(p => p.test(nameWithoutExt));
        });

        sendSSE('start', { total: candidates.length, scanned: allImages.length });

        if (candidates.length === 0) {
          sendSSE('done', { renamed: 0, failed: 0, skipped: 0, total: 0 });
          res.end();
          return;
        }

        let renamed = 0;
        let failed = 0;
        let skipped = 0;

        const catMap: Record<string, string> = { general: 'files', media: 'photos', video_vault: 'videos', music: 'music' };
        const catDir = catMap[category] || 'files';
        let dataDir = (globalThis as any).__arcellite_storage_path || process.env.ARCELLITE_DATA || path.join(os.homedir(), 'arcellite-data');
        if (dataDir.startsWith('~/') || dataDir === '~') {
          dataDir = path.join(os.homedir(), dataDir.slice(2));
        }

        for (let i = 0; i < candidates.length; i++) {
          const img = candidates[i];
          const fullImagePath = path.join(dataDir, catDir, img.relPath);

          sendSSE('progress', { current: i + 1, total: candidates.length, file: img.name });

          try {
            // Retry logic for rate-limited Gemini API calls
            let result: { ok: boolean; title?: string; error?: string } = { ok: false, error: 'Unknown' };
            for (let attempt = 0; attempt < 3; attempt++) {
              result = await analyzeImageForTitle(fullImagePath);
              // If rate-limited (error contains 429 or RESOURCE_EXHAUSTED), wait and retry
              if (!result.ok && result.error && (result.error.includes('429') || result.error.includes('RESOURCE_EXHAUSTED'))) {
                const backoffMs = (attempt + 1) * 8000; // 8s, 16s, 24s
                sendSSE('progress', { current: i + 1, total: candidates.length, file: `Rate limited, retrying in ${backoffMs / 1000}s...` });
                await new Promise(r => setTimeout(r, backoffMs));
                continue;
              }
              break; // Success or non-retryable error
            }

            if (result.ok && result.title) {
              const ext = path.extname(img.relPath);
              const dir = img.relPath.includes('/') ? img.relPath.substring(0, img.relPath.lastIndexOf('/')) : '';
              const newFileName = `${result.title}${ext}`;
              const newPath = dir ? `${dir}/${newFileName}` : newFileName;

              try {
                moveFile(category, img.relPath, newPath);
                markAsAiRenamed(category, newPath, img.name);
                renamed++;
                sendSSE('renamed', { oldName: img.name, newName: newFileName, index: i + 1 });
              } catch {
                failed++;
                sendSSE('error', { file: img.name, error: 'Rename failed', index: i + 1 });
              }
            } else {
              skipped++;
              sendSSE('skip', { file: img.name, reason: result.error || 'No title generated', index: i + 1 });
            }
          } catch (e) {
            failed++;
            sendSSE('error', { file: img.name, error: (e as Error).message, index: i + 1 });
          }

          // Delay between Gemini API calls to respect rate limits (free tier: ~15 RPM)
          if (i < candidates.length - 1) {
            await new Promise(r => setTimeout(r, 4500));
          }
        }

        sendSSE('done', { renamed, failed, skipped, total: candidates.length });
        res.end();
      } catch (e) {
        if (!res.headersSent) {
          sendError(res, String((e as Error).message));
        } else {
          res.end();
        }
      }
    }).catch((e) => {
      if (!res.headersSent) {
        sendError(res, String((e as Error).message));
      }
    });
    return true;
  }

  // ── AI Auto-Rename: Analyze image with Gemini Vision ───────────
  if (url === '/api/ai/analyze-image' && req.method === 'POST') {
    parseBody(req).then(async (body) => {
      try {
        const { category, filePath: relPath } = body;
        if (!category || !relPath) {
          sendError(res, 'category and filePath are required', 400);
          return;
        }

        const { analyzeImageForTitle } = await import('../ai.js');
        const { markAsAiRenamed } = await import('../ai-metadata.js');

        // Build full path from category
        const catMap: Record<string, string> = { general: 'files', media: 'photos', video_vault: 'videos', music: 'music' };
        const catDir = catMap[category] || 'files';
        let dataDir = (globalThis as any).__arcellite_storage_path || process.env.ARCELLITE_DATA || path.join(os.homedir(), 'arcellite-data');
        if (dataDir.startsWith('~/') || dataDir === '~') {
          dataDir = path.join(os.homedir(), dataDir.slice(2));
        }
        const fullImagePath = path.join(dataDir, catDir, relPath);

        const result = await analyzeImageForTitle(fullImagePath);

        if (result.ok && result.title) {
          // Auto-rename the file on disk
          const { moveFile } = await import('../files.js');
          const ext = path.extname(relPath);
          const dir = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '';
          const newFileName = `${result.title}${ext}`;
          const newPath = dir ? `${dir}/${newFileName}` : newFileName;

          try {
            await moveFile(category, relPath, newPath);
            markAsAiRenamed(category, newPath, path.basename(relPath));
            sendJson(res, { ok: true, title: result.title, newFileName, newPath, renamed: true });
          } catch (renameErr) {
            // Title generated but rename failed — still return the title
            sendJson(res, { ok: true, title: result.title, newFileName, renamed: false, renameError: (renameErr as Error).message });
          }
        } else {
          sendJson(res, { ok: false, error: result.error }, 422);
        }
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // ── Get AI-renamed files list ──────────────────────────────────
  if (url?.startsWith('/api/ai/renamed-files') && req.method === 'GET') {
    (async () => {
      try {
        const { getAiRenamedFiles } = await import('../ai-metadata.js');
        const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
        const category = urlObj.searchParams.get('category') || undefined;
        const renamedFiles = getAiRenamedFiles(category);
        sendJson(res, { ok: true, renamedFiles });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    })();
    return true;
  }

  return false;
}
