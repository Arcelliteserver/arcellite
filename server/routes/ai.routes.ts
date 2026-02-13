import type { IncomingMessage, ServerResponse } from 'http';

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

        const MAX_CONTINUATION_ITERATIONS = 8;

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
              return `❌ Action "${action.type}" failed: ${r.error || r.message || 'unknown error'}`;
            }
          }).join('\n');

          currentMessages.push({
            role: 'user',
            content: `[SYSTEM — ACTION RESULTS]\n${resultsSummary}\n\nContinue with the remaining steps of the original request. If ALL steps are now complete, provide a brief final summary. Do NOT repeat actions that already succeeded.`,
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

  return false;
}
