import type { IncomingMessage, ServerResponse } from 'http';
import pg from 'pg';

const { Pool } = pg;

// ── Dedicated connection pool for cloudnest_chat_history database ─────────
const rawHost = process.env.DB_HOST || 'localhost';
const chatPool = new Pool({
  host: rawHost.startsWith('/') ? 'localhost' : rawHost,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'cloudnest_chat_history',
  user: process.env.DB_USER || 'arcellite_user',
  password: process.env.DB_PASSWORD || 'changeme',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

// Auto-create chat tables in cloudnest_chat_history on first load
let chatSchemaInitialized = false;
async function ensureChatSchema() {
  if (chatSchemaInitialized) return;
  try {
    await chatPool.query(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER DEFAULT 1,
        title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
        model VARCHAR(100) DEFAULT 'deepseek-chat',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        actions JSONB,
        blocks JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_chat_conv_user ON chat_conversations(user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages(conversation_id, created_at ASC);
    `);
    chatSchemaInitialized = true;
    console.log('[Chat] Schema initialized in cloudnest_chat_history');
  } catch (e) {
    console.error('[Chat] Failed to initialize schema:', (e as Error).message);
  }
}

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

export function handleChatRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {

  // ── List conversations ─────────────────────────────────────────
  if (url?.startsWith('/api/chat/conversations') && req.method === 'GET' && !url.includes('/api/chat/conversations/')) {
    (async () => {
      try {
        await ensureChatSchema();
        const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
        const limit = parseInt(urlObj.searchParams.get('limit') || '50');
        const result = await chatPool.query(
          `SELECT c.id, c.title, c.model, c.created_at, c.updated_at,
                  (SELECT COUNT(*)::int FROM chat_messages WHERE conversation_id = c.id) AS message_count
           FROM chat_conversations c
           ORDER BY c.updated_at DESC
           LIMIT $1`,
          [limit]
        );
        sendJson(res, { ok: true, conversations: result.rows });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    })();
    return true;
  }

  // ── Get single conversation with messages ──────────────────────
  const getConvoMatch = url?.match(/^\/api\/chat\/conversations\/([a-f0-9-]+)$/);
  if (getConvoMatch && req.method === 'GET') {
    const conversationId = getConvoMatch[1];
    (async () => {
      try {
        await ensureChatSchema();
        const convoResult = await chatPool.query(
          'SELECT id, title, model, created_at, updated_at FROM chat_conversations WHERE id = $1',
          [conversationId]
        );
        if (convoResult.rows.length === 0) {
          sendError(res, 'Conversation not found', 404);
          return;
        }
        const messagesResult = await chatPool.query(
          'SELECT id, role, content, actions, blocks, created_at FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
          [conversationId]
        );
        sendJson(res, {
          ok: true,
          conversation: convoResult.rows[0],
          messages: messagesResult.rows.map(m => ({
            role: m.role,
            content: m.content,
            actions: m.actions || undefined,
            blocks: m.blocks || undefined,
            timestamp: new Date(m.created_at).getTime(),
          })),
        });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    })();
    return true;
  }

  // ── Create new conversation ────────────────────────────────────
  if (url === '/api/chat/conversations' && req.method === 'POST') {
    parseBody(req).then(async (body) => {
      try {
        await ensureChatSchema();
        const { title, model } = body;
        const result = await chatPool.query(
          'INSERT INTO chat_conversations (user_id, title, model) VALUES (1, $1, $2) RETURNING id, title, model, created_at, updated_at',
          [title || 'New Chat', model || 'deepseek-chat']
        );
        sendJson(res, { ok: true, conversation: result.rows[0] });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String(e.message)));
    return true;
  }

  // ── Save message to conversation ───────────────────────────────
  if (url === '/api/chat/messages' && req.method === 'POST') {
    parseBody(req).then(async (body) => {
      try {
        await ensureChatSchema();
        const { conversationId, role, content, actions, blocks } = body;
        if (!conversationId || !role || !content) {
          sendError(res, 'conversationId, role, and content are required', 400);
          return;
        }
        const result = await chatPool.query(
          'INSERT INTO chat_messages (conversation_id, role, content, actions, blocks) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
          [conversationId, role, content, actions ? JSON.stringify(actions) : null, blocks ? JSON.stringify(blocks) : null]
        );

        // Update conversation timestamp and auto-title from first user message
        if (role === 'user') {
          const countResult = await chatPool.query(
            'SELECT COUNT(*)::int as cnt FROM chat_messages WHERE conversation_id = $1 AND role = $2',
            [conversationId, 'user']
          );
          if (countResult.rows[0].cnt <= 1) {
            const title = content.length > 60 ? content.substring(0, 57) + '...' : content;
            await chatPool.query(
              'UPDATE chat_conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [title, conversationId]
            );
          } else {
            await chatPool.query(
              'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
              [conversationId]
            );
          }
        } else {
          await chatPool.query(
            'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [conversationId]
          );
        }

        sendJson(res, { ok: true, messageId: result.rows[0].id });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String(e.message)));
    return true;
  }

  // ── Delete conversation ────────────────────────────────────────
  const deleteConvoMatch = url?.match(/^\/api\/chat\/conversations\/([a-f0-9-]+)$/);
  if (deleteConvoMatch && req.method === 'DELETE') {
    const conversationId = deleteConvoMatch[1];
    (async () => {
      try {
        await ensureChatSchema();
        await chatPool.query('DELETE FROM chat_conversations WHERE id = $1', [conversationId]);
        sendJson(res, { ok: true });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    })();
    return true;
  }

  // ── Update conversation title ──────────────────────────────────
  const updateConvoMatch = url?.match(/^\/api\/chat\/conversations\/([a-f0-9-]+)$/);
  if (updateConvoMatch && req.method === 'PATCH') {
    const conversationId = updateConvoMatch[1];
    parseBody(req).then(async (body) => {
      try {
        await ensureChatSchema();
        const { title } = body;
        if (!title) {
          sendError(res, 'title is required', 400);
          return;
        }
        await chatPool.query(
          'UPDATE chat_conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [title, conversationId]
        );
        sendJson(res, { ok: true });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String(e.message)));
    return true;
  }

  return false;
}
