/**
 * AI Chat backend: API key storage, DeepSeek proxy, and tool execution.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

function getDataDir(): string {
  const cached = (globalThis as any).__arcellite_storage_path;
  if (cached) return cached;
  let dir = process.env.ARCELLITE_DATA || path.join(os.homedir(), 'arcellite-data');
  if (dir.startsWith('~/') || dir === '~') {
    dir = path.join(os.homedir(), dir.slice(2));
  }
  return dir;
}

function getConfigDir(): string {
  return path.join(getDataDir(), 'config');
}

function getKeysFile(): string {
  return path.join(getConfigDir(), 'api-keys.json');
}

// ─── API Key Storage ────────────────────────────────────────────────

function ensureConfigDir() {
  if (!fs.existsSync(getConfigDir())) {
    fs.mkdirSync(getConfigDir(), { recursive: true });
  }
}

export function saveApiKeys(keys: Record<string, string>): void {
  ensureConfigDir();
  // Merge with existing
  const existing = loadApiKeys();
  const merged = { ...existing, ...keys };
  // Remove empty keys
  for (const k in merged) {
    if (!merged[k]) delete merged[k];
  }
  fs.writeFileSync(getKeysFile(), JSON.stringify(merged, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function loadApiKeys(): Record<string, string> {
  if (!fs.existsSync(getKeysFile())) return {};
  try {
    return JSON.parse(fs.readFileSync(getKeysFile(), 'utf8'));
  } catch {
    return {};
  }
}

export function getApiKey(provider: string): string | null {
  const keys = loadApiKeys();
  return keys[provider] || null;
}

/** Return list of provider names that have a saved API key */
export function getConfiguredProviders(): string[] {
  const keys = loadApiKeys();
  return Object.keys(keys).filter(k => !!keys[k]);
}

// ─── Provider API Configuration ─────────────────────────────────────

interface ProviderConfig {
  apiUrl: string;
  /** Map our model ID to the provider's model name */
  resolveModel: (modelId: string) => string;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  DeepSeek: {
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    resolveModel: (id) => id, // deepseek-chat, deepseek-reasoner
  },
  Google: {
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    resolveModel: (id) => {
      // Map our IDs to Gemini API model names (stable versions)
      const map: Record<string, string> = {
        'gemini-3-pro': 'gemini-2.5-pro',
        'gemini-3-flash': 'gemini-2.5-flash',
        'gemini-2.5-pro': 'gemini-2.5-pro',
        'gemini-2.5-flash': 'gemini-2.5-flash',
        'gemini-2.5-flash-lite': 'gemini-2.5-flash',
        'gemini-2-flash': 'gemini-2.0-flash',
      };
      return map[id] || id;
    },
  },
  OpenAI: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    resolveModel: (id) => {
      const map: Record<string, string> = {
        'gpt-5.2': 'gpt-4o',
        'gpt-5.2-pro': 'gpt-4o',
        'gpt-5': 'gpt-4o',
        'gpt-5-mini': 'gpt-4o-mini',
        'gpt-5-nano': 'gpt-4o-mini',
        'gpt-4.1': 'gpt-4.1',
      };
      return map[id] || 'gpt-4o';
    },
  },
  Anthropic: {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    resolveModel: (id) => {
      const map: Record<string, string> = {
        'claude-4.5-opus': 'claude-sonnet-4-20250514',
        'claude-4.1-sonnet': 'claude-sonnet-4-20250514',
        'claude-4.1-haiku': 'claude-haiku-3-5-20241022',
        'claude-3.7-sonnet': 'claude-3-7-sonnet-20250219',
      };
      return map[id] || 'claude-sonnet-4-20250514';
    },
  },
  Grok: {
    apiUrl: 'https://api.x.ai/v1/chat/completions',
    resolveModel: (id) => id,
  },
  Qwen: {
    apiUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    resolveModel: (id) => {
      const map: Record<string, string> = {
        'qwen-2.5-72b': 'qwen-plus',
        'qwen-2.5-32b': 'qwen-turbo',
      };
      return map[id] || id;
    },
  },
  Ollama: {
    apiUrl: 'https://ollama.com/v1/chat/completions',
    resolveModel: (id) => {
      const map: Record<string, string> = {
        'ollama-mistral': 'mistral',
        'gpt-oss-120b-cloud': 'gpt-oss:120b-cloud',
        'gpt-oss-20b-cloud': 'gpt-oss:20b-cloud',
        'deepseek-v3.1-671b-cloud': 'deepseek-v3.1:671b-cloud',
        'qwen3-coder-480b-cloud': 'qwen3-coder:480b-cloud',
        'qwen3-vl-235b-cloud': 'qwen3-vl:235b-cloud',
        'minimax-m2-cloud': 'minimax-m2:cloud',
        'alm-4.6-cloud': 'alm-4.6:cloud',
        'kimi-k2.5': 'kimi-k2.5',
      };
      return map[id] || id;
    },
  },
};

/** Model ID → Provider name mapping (built from constants) */
const MODEL_PROVIDER_MAP: Record<string, string> = {
  'gemini-3-pro': 'Google', 'gemini-3-flash': 'Google', 'gemini-2.5-pro': 'Google',
  'gemini-2.5-flash': 'Google', 'gemini-2.5-flash-lite': 'Google', 'gemini-2-flash': 'Google',
  'gpt-5.2': 'OpenAI', 'gpt-5.2-pro': 'OpenAI', 'gpt-5': 'OpenAI',
  'gpt-5-mini': 'OpenAI', 'gpt-5-nano': 'OpenAI', 'gpt-4.1': 'OpenAI',
  'claude-4.5-opus': 'Anthropic', 'claude-4.1-sonnet': 'Anthropic',
  'claude-4.1-haiku': 'Anthropic', 'claude-3.7-sonnet': 'Anthropic',
  'llama-3.1-405b': 'Meta', 'llama-3-70b': 'Meta', 'llama-3-8b': 'Meta',
  'grok-4-1-fast-reasoning': 'Grok', 'grok-4-1-fast-non-reasoning': 'Grok',
  'grok-4-fast-reasoning': 'Grok', 'grok-4-fast-non-reasoning': 'Grok',
  'ollama-mistral': 'Ollama', 'gpt-oss-120b-cloud': 'Ollama', 'gpt-oss-20b-cloud': 'Ollama',
  'deepseek-v3.1-671b-cloud': 'Ollama', 'qwen3-coder-480b-cloud': 'Ollama', 'qwen3-vl-235b-cloud': 'Ollama',
  'minimax-m2-cloud': 'Ollama', 'alm-4.6-cloud': 'Ollama', 'kimi-k2.5': 'Ollama',
  'qwen-2.5-72b': 'Qwen', 'qwen-2.5-32b': 'Qwen',
  'deepseek-chat': 'DeepSeek', 'deepseek-reasoner': 'DeepSeek',
};

export function getProviderForModel(modelId: string): string {
  return MODEL_PROVIDER_MAP[modelId] || 'DeepSeek';
}

// ─── DeepSeek Chat Proxy ────────────────────────────────────────────

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Strip download-source tags from file names so the AI doesn't repeat them.
 */
function cleanFileName(name: string): string {
  return name
    .replace(/\s*\(z-?lib(?:\.org|\.rs)?\)/gi, '')
    .replace(/\s*\(z-?library\)/gi, '')
    .replace(/\s*\(libgen(?:\.\w+)?\)/gi, '')
    .replace(/\s*\(anna'?s?\s*archive\)/gi, '')
    .replace(/\s*\(sci-hub\)/gi, '')
    .replace(/\s*\(pdfdrive(?:\.com)?\)/gi, '')
    .replace(/\s*\(www\.ebook\w*\.\w+\)/gi, '')
    .replace(/\s*\(b-ok\.\w+\)/gi, '')
    .replace(/\s*\(1lib\.\w+\)/gi, '')
    .replace(/\s*\(\d+lib\.\w+\)/gi, '')
    .trim();
}

/**
 * Resolve a file path that may use a cleaned display name back to the actual file on disk.
 * The AI sees cleaned names (without source tags) but the files still have them.
 */
function resolveFilePath(category: string, filePath: string): string {
  const catMap: Record<string, string> = { general: 'files', media: 'photos', video_vault: 'videos', music: 'music' };
  const baseDir = path.join(getDataDir(), catMap[category] || 'files');
  const fullPath = path.join(baseDir, filePath);

  // If file exists at exact path, use it
  if (fs.existsSync(fullPath)) return filePath;

  // File doesn't exist — the AI probably sent the cleaned name. Search the directory.
  const dir = path.dirname(fullPath);
  const cleanedBase = path.basename(filePath);
  if (!fs.existsSync(dir)) return filePath;

  try {
    for (const entry of fs.readdirSync(dir)) {
      if (cleanFileName(entry) === cleanedBase) {
        // Found the real file on disk
        const parentPath = path.dirname(filePath);
        return parentPath === '.' ? entry : `${parentPath}/${entry}`;
      }
    }
  } catch { /* fall through */ }

  return filePath;
}

/**
 * Build filesystem context for the AI: lists files/folders so the AI knows what's available.
 */
function getFilesystemContext(baseDir?: string): string {
  const catMap: Record<string, string> = {
    general: 'files',
    media: 'photos',
    video_vault: 'videos',
    music: 'music',
  };

  const dataDir = baseDir || getDataDir();
  const sections: string[] = [];

  for (const [category, dir] of Object.entries(catMap)) {
    const fullDir = path.join(dataDir, dir);
    if (!fs.existsSync(fullDir)) continue;

    try {
      const entries: string[] = [];
      for (const name of fs.readdirSync(fullDir)) {
        const displayName = cleanFileName(name);
        const full = path.join(fullDir, name);
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            // Show folder and its contents (1 level deep)
            entries.push(`  - ${displayName}/ (folder)`);
            try {
              const subEntries = fs.readdirSync(full);
              // Show all items (compact: names only for large folders)
              const isLargeFolder = subEntries.length > 20;
              const subItems = subEntries.map((sub) => {
                const subDisplay = cleanFileName(sub);
                if (isLargeFolder) {
                  // Compact: name only for large folders (e.g. books collection)
                  return `      ${subDisplay}`;
                }
                const subFull = path.join(full, sub);
                try {
                  const subStat = fs.statSync(subFull);
                  const subType = subStat.isDirectory() ? 'folder' : 'file';
                  const subSize = subStat.isFile() ? formatBytes(subStat.size) : '';
                  return `      ${subDisplay} (${subType}${subSize ? ', ' + subSize : ''})`;
                } catch {
                  return `      ${subDisplay}`;
                }
              });
              if (subItems.length > 0) {
                entries.push(...subItems);
              }
            } catch { /* skip */ }
          } else {
            const ext = path.extname(name).toLowerCase();
            const size = formatBytes(stat.size);
            entries.push(`  - ${displayName} (file, ${size}, ext: ${ext})`);
          }
        } catch {
          entries.push(`  - ${displayName}`);
        }
      }
      if (entries.length > 0) {
        const label = category === 'general' ? 'Files' : category === 'media' ? 'Photos' : category === 'video_vault' ? 'Videos' : 'Music';
        sections.push(`📁 ${label} (category: ${category}):\n${entries.join('\n')}`);
      }
    } catch {
      // skip
    }
  }

  // Also list shared
  const sharedDir = path.join(dataDir, 'shared');
  if (fs.existsSync(sharedDir)) {
    try {
      const entries = fs.readdirSync(sharedDir).map((name) => `  - ${name}`);
      if (entries.length > 0) {
        sections.push(`📁 Shared:\n${entries.join('\n')}`);
      }
    } catch {
      // skip
    }
  }

  return sections.length > 0
    ? `CURRENT FILES & FOLDERS ON SERVER:\n${sections.join('\n\n')}`
    : 'No files or folders on the server yet.';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get database context for the AI, including table schemas.
 */
async function getDatabaseContext(): Promise<string> {
  try {
    const metadataFile = path.join(getDataDir(), 'databases', 'metadata.json');
    if (!fs.existsSync(metadataFile)) return 'No databases created yet.';
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    const entries = Object.values(metadata) as any[];
    if (entries.length === 0) return 'No databases created yet.';

    const pg = await import('pg');

    const dbDescriptions: string[] = [];
    for (const db of entries as any[]) {
      const name = db.name || db.displayName;
      let desc = `  - id="${db.id}" name="${name}" (type: ${db.type}, status: ${db.status})`;

      // Fetch table + column schemas in a SINGLE query per database (much faster)
      if (db.status === 'running' && db.pgDatabaseName) {
        try {
          const pool = new pg.default.Pool({
            host: process.env.DB_HOST?.startsWith('/') ? 'localhost' : (process.env.DB_HOST || 'localhost'),
            port: parseInt(process.env.DB_PORT || '5432'),
            user: process.env.DB_USER || 'arcellite_user',
            password: process.env.DB_PASSWORD,
            database: db.pgDatabaseName,
            max: 2,
            idleTimeoutMillis: 5000,
            connectionTimeoutMillis: 3000,
          });
          try {
            const result = await pool.query(`
              SELECT t.tablename AS table_name,
                     COALESCE(s.n_live_tup, 0) AS row_count,
                     c.column_name, c.data_type, c.is_nullable
              FROM pg_tables t
              LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
              LEFT JOIN information_schema.columns c ON c.table_name = t.tablename AND c.table_schema = 'public'
              WHERE t.schemaname = 'public'
              ORDER BY t.tablename, c.ordinal_position
            `);

            // Group by table
            const tables: Record<string, { rowCount: number; cols: string[] }> = {};
            for (const row of result.rows) {
              if (!tables[row.table_name]) {
                tables[row.table_name] = { rowCount: parseInt(row.row_count, 10), cols: [] };
              }
              if (row.column_name) {
                tables[row.table_name].cols.push(
                  `${row.column_name} ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}`
                );
              }
            }

            const tableNames = Object.keys(tables);
            if (tableNames.length > 0) {
              desc += `\n    Tables:`;
              for (const tblName of tableNames) {
                const tbl = tables[tblName];
                desc += `\n      - ${tblName} (${tbl.rowCount} rows): ${tbl.cols.join(', ')}`;
              }
            } else {
              desc += `\n    (no tables)`;
            }
          } finally {
            await pool.end();
          }
        } catch {
          // Can't connect — just show metadata
        }
      }
      dbDescriptions.push(desc);
    }

    return `DATABASES ON SERVER:\n${dbDescriptions.join('\n')}\n\nIMPORTANT: When running queries or creating tables, use the database "id" field (e.g. "db_..."), NOT the display name. You have the full table schemas above — use them to write queries directly without discovery steps.`;
  } catch {
    return 'No databases available.';
  }
}

/**
 * Get connected apps context for the AI, loaded from the database.
 */
async function getConnectedAppsContext(userEmail?: string): Promise<string> {
  if (!userEmail) return 'CONNECTED APPS:\nNo connected apps (user not identified).';
  try {
    const { pool } = await import('./db/connection.js');
    // Get user ID from email
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    if (userResult.rows.length === 0) return 'CONNECTED APPS:\nNo connected apps.';
    const userId = userResult.rows[0].id;
    // Load myapps_state
    const result = await pool.query(
      `SELECT config FROM connected_apps WHERE user_id = $1 AND app_type = 'myapps_state' AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0 || !result.rows[0].config) return 'CONNECTED APPS:\nNo connected apps.';
    const config = result.rows[0].config;
    const apps = config.apps;
    if (!Array.isArray(apps) || apps.length === 0) return 'CONNECTED APPS:\nNo connected apps.';

    const connectedApps = apps.filter((a: any) => a.status === 'connected');
    if (connectedApps.length === 0) return 'CONNECTED APPS:\nNo apps are currently connected.';

    const lines: string[] = ['CONNECTED APPS:'];
    for (const app of connectedApps) {
      let line = `  - ${app.name} (${app.id}) — ✅ Connected`;
      if (app.statusMessage) line += ` — ${app.statusMessage}`;

      // For Discord: list channels
      if (app.discordChannels && Array.isArray(app.discordChannels) && app.discordChannels.length > 0) {
        line += `\n    Discord Channels:`;
        for (const ch of app.discordChannels) {
          line += `\n      #${ch.name}${ch.topic ? ` — ${ch.topic}` : ''}`;
        }
        // Store the send URL so executeAction can use it
        if (app.discordWebhooks?.sendUrl) {
          line += `\n    [Send Webhook: ${app.discordWebhooks.sendUrl}]`;
        }
      }

      // For n8n/MCP: show workflow count
      if (app.files && Array.isArray(app.files) && app.files.length > 0) {
        if (app.id.startsWith('n8n') || app.id.startsWith('mcp')) {
          line += ` — ${app.files.length} workflow(s)`;
        }
      }

      lines.push(line);
    }

    return lines.join('\n');
  } catch {
    return 'CONNECTED APPS:\nUnable to load connected apps.';
  }
}

/**
 * Resolve a database reference (id or display name) to the actual metadata id.
 */
function resolveDatabaseId(ref: string): string | null {
  try {
    const metadataFile = path.join(getDataDir(), 'databases', 'metadata.json');
    if (!fs.existsSync(metadataFile)) return null;
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    // Direct match by id
    if (metadata[ref]) return ref;
    // Search by display name or pgDatabaseName (case-insensitive)
    for (const [id, db] of Object.entries(metadata) as [string, any][]) {
      if (db.name?.toLowerCase() === ref.toLowerCase()
        || db.displayName?.toLowerCase() === ref.toLowerCase()
        || db.pgDatabaseName?.toLowerCase() === ref.toLowerCase()) {
        return id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(filesCtx: string, dbCtx: string, appsCtx: string, userEmail?: string, userName?: string): string {
  const emailCtx = userEmail ? `\nUSER EMAIL: ${userEmail}\n` : '';
  const nameCtx = userName ? `\nUSER NAME: ${userName}\n` : '';
  const publicUrl = process.env.ARCELLITE_PUBLIC_URL || 'https://cloud.arcelliteserver.com';
  return `You are Arcellite — the personal AI assistant for the Arcellite file management system. You are helpful, concise, and conversational.
${emailCtx}${nameCtx}
SERVER PUBLIC URL: ${publicUrl}

TONE:
- Be friendly and natural. You know the user's name — use it occasionally and casually, like a friend would.
- Don't force the name into every response. Just weave it in naturally when it fits.

CAPABILITIES YOU CAN HELP WITH:
1. **File Management**: Create files, create folders, delete files/folders, rename items, move items to trash, list contents
2. **Database Management**: Create databases (PostgreSQL, MySQL, or SQLite), create tables, drop tables, run queries
3. **Media**: Help find photos, videos, music files. Help cast media to devices.
4. **Email**: Send files from the user's storage to their email as attachments.
5. **Connected Apps**: Show the user's connected integrations (Discord, n8n, databases, etc.). Send messages to Discord channels.
6. **Task Automation**: Create automation rules that trigger on storage/CPU thresholds, file uploads, or a schedule, and fire actions like email, Discord message, webhook, or dashboard alert.
7. **General Help**: Answer questions about the system, provide guidance

WHEN THE USER ASKS YOU TO PERFORM AN ACTION, respond with a JSON action block wrapped in \`\`\`action tags. Examples:

IMPORTANT — FILES vs FOLDERS:
- create_folder: Creates an empty DIRECTORY (folder). Use when the user says "create a folder", "make a directory", etc.
- create_file: Creates a FILE with text content. Use when the user says "create a file", "make a text file", "write a file", "create test.txt", etc.
- NEVER use create_folder when the user asks to create a file (like test.txt, notes.md, etc.). A file has an extension (.txt, .md, .py, etc.), a folder does not.

To create a TEXT FILE with content:
\`\`\`action
{"type":"create_file","category":"general","path":"test.txt","content":"This is the file content.\nLine 2 of the file.\nLine 3."}
\`\`\`

To create a file inside a subfolder:
\`\`\`action
{"type":"create_file","category":"general","path":"notes/my-notes.txt","content":"My notes go here."}
\`\`\`

When creating files with content:
- Use real newlines (\n) in the content string for line breaks
- Write the actual meaningful content the user asked for — don't just put placeholder text
- Do NOT dump the entire file content in your chat message. Just briefly describe what the file contains.
- For code files (.py, .js, etc.), write properly formatted code
- For text guides/tutorials, write clean structured text (no markdown # or ** — those are for chat messages, not plain .txt files)

To create a folder in the root of a category:
\`\`\`action
{"type":"create_folder","category":"general","name":"My New Folder","path":""}
\`\`\`

To create a subfolder inside an existing folder:
\`\`\`action
{"type":"create_folder","category":"media","name":"Vacation","path":"Albums"}
\`\`\`

IMPORTANT: The "path" field is the path WITHIN the category directory, NOT the category display name.
- To create a folder at the root of Photos (category="media"), use path="" (empty string).
- To create inside an existing subfolder "Albums" of Photos, use path="Albums".
- NEVER put the category display name like "Photos", "Files", "Videos" in the path field.
- When the user says "Photos" or "photo", that means category="media". When they say "Files", that means category="general". When they say "Videos", that means category="video_vault". When they say "Music", that means category="music".
- When the user asks to create a folder WITHOUT specifying where, ALWAYS ask them which section they want it in: Files, Photos, Videos, or Music. Do NOT assume "general"/"Files" by default. Ask the follow-up question first.
- CRITICAL CATEGORY MAPPING: "Photos" / "Photo" → category="media", "Videos" → category="video_vault", "Files" → category="general", "Music" → category="music". NEVER put these display names in the path field.

To delete a file or folder:
\`\`\`action
{"type":"delete","category":"general","path":"My New Folder"}
\`\`\`

To rename a file or folder:
\`\`\`action
{"type":"rename","category":"general","oldPath":"old name","newName":"new name"}
\`\`\`

To move a file/folder to trash:
\`\`\`action
{"type":"trash","category":"general","path":"filename.txt"}
\`\`\`

To list all databases:
\`\`\`action
{"type":"list_databases"}
\`\`\`

To list files/folders in a category (or subfolder):
\`\`\`action
{"type":"list","category":"media","path":""}
\`\`\`

To list with a name filter (shows items whose name contains the filter text, case-insensitive):
\`\`\`action
{"type":"list","category":"media","path":"","filter":"sunset"}
\`\`\`

To list only files (no folders):
\`\`\`action
{"type":"list","category":"media","path":"","filesOnly":true}
\`\`\`

To list only files matching a pattern:
\`\`\`action
{"type":"list","category":"media","path":"","filter":"Image","filesOnly":true}
\`\`\`

To list ALL file names (compact mode — for genre/topic categorization):
\`\`\`action
{"type":"list","category":"general","path":"books","filesOnly":true,"listAll":true}
\`\`\`

When the user asks to list, browse, or see their files/folders/databases, ALWAYS use the appropriate list action above.
- When the user asks for specific types of files (images, videos, etc.) or mentions a name pattern, use the "filter" and/or "filesOnly" parameters.
- For example: "list all images starting with Image" → use filter="Image" and filesOnly=true in the media category.
- Results are limited to the top 3 items without filter (or top 10 with filter). The total count is always returned.
- Keep your text response brief — the cards already show the details. Do NOT re-list file names in your text if the list action handles it.
- When the user asks "how many books/files/photos do I have", list the appropriate folder with filesOnly=true and NO filter. The system will return the total count automatically. State the total count in your response (e.g. "You have 19 books in your collection!"). The cards will show a few samples.
- For books, list category="general" path="books" with filesOnly=true. For photos use category="media", for videos use category="video_vault", for music use category="music".
- Do NOT use a filter just to count items — filters limit the result set and give wrong totals. Only use filter when the user asks to search for specific names.

CRITICAL — EMPTY FOLDERS & COUNTING:
- You have the FULL filesystem context below. ALWAYS check it BEFORE responding so you can give accurate information.
- If a folder is EMPTY (has no files or subfolders in the context below), say so clearly: "Your Music folder is empty right now." Then give a helpful suggestion like "You can upload music files to get started!" or "Would you like me to create some folders to organize your music?". NEVER say "I'll show you" and then show nothing.
- When counting items ("how many books"), LOOK at the filesystem context below to count the actual items. State the real number in your text response (e.g. "You have 244 books in your collection!"). Do NOT say generic things like "I'll count for you" — actually give the number.
- ALWAYS make your text response meaningful and complete. Never leave the user with an empty response or a promise without delivery.

CRITICAL — GENRE / TOPIC / CATEGORY SEARCHES (e.g. "Christian books", "programming books", "fiction novels", "physics books"):
- The "filter" parameter ONLY matches text in file names. It does NOT understand genres, topics, or subjects.
- When the user asks for books by GENRE, TOPIC, SUBJECT, or CATEGORY (e.g. "list my Christian books", "show me science fiction", "what programming books do I have", "any books about physics?"), do NOT use the "filter" parameter — it will give wrong results.
  - For example, searching filter="christian" would match "Python One-Liners (Christian Mayer)" which is a Python book, NOT a Christian book. The word "Christian" is the author's first name.
- Instead, look at the FILESYSTEM CONTEXT provided below — it contains ALL file names in every folder. Use YOUR knowledge of book titles, authors, and subjects to identify which ones match the requested genre/topic.
- List the matching books directly in your text response. You do NOT need a list action for genre/topic queries — you already have the full file list in the context below.
- Common genre examples:
  - "Christian/Religious books" → look for known Christian authors (Kenneth Hagin, Derek Prince, etc.), titles with words like faith, prayer, Bible, prophecy, visions, God, spiritual
  - "Programming books" → look for language names (Python, Java, C++, JavaScript), tech terms (algorithms, coding, web development, API)
  - "Fiction/Novels" → look for known fiction authors, novel titles (Harry Potter, Atlantis, etc.)
  - "Science books" → look for physics, astronomy, quantum, biology, genetics, etc.
  - "Self-help" → look for titles about habits, confidence, thinking, social skills
- If you're unsure about a book's genre, include it with a note. Be thorough — scan every file name in the context.

To list items currently in the trash:
\`\`\`action
{"type":"list_trash"}
\`\`\`

To empty the entire trash (permanently delete all trashed items):
\`\`\`action
{"type":"empty_trash"}
\`\`\`

To restore a specific item from trash (use the item id from list_trash):
\`\`\`action
{"type":"restore_from_trash","trashId":"1234567890_filename.jpg"}
\`\`\`

To permanently delete a specific item from trash:
\`\`\`action
{"type":"delete_from_trash","trashId":"1234567890_filename.jpg"}
\`\`\`

When the user asks to "clean up trash", "empty trash", "clear trash", or similar, use the empty_trash action. If they ask to see what's in the trash first, use list_trash.

To create a database:
\`\`\`action
{"type":"create_database","name":"my_database","dbType":"postgresql"}
\`\`\`
The "dbType" field supports: "postgresql", "mysql", or "sqlite".

To delete/drop a database (use the display name):
\`\`\`action
{"type":"delete_database","database":"my_database"}
\`\`\`
When the user says "delete that db" or "drop that database" after creating one, use the name of the database from the conversation. You know what was just created — use that name directly. Do NOT use the file "delete" action for databases.

When the user asks to "create a database" without providing a specific name or type, ALWAYS ask them:
1. What the database name should be (suggest a snake_case name based on their project description)
2. Which database engine they want to use: **PostgreSQL**, **MySQL**, or **SQLite** — briefly explain the differences:
   - **PostgreSQL**: Full-featured relational database, best for complex apps
   - **MySQL**: Popular relational database, great for web apps
   - **SQLite**: Lightweight embedded database, perfect for small projects or testing
3. What kind of data they want to store (so you can offer to create initial tables)
If the user specifies the type (e.g. "create a sqlite database" or "create a postgres db"), use that type directly — no need to ask again.
Do NOT create a database with a generic name like "my_database" or "app_database". Always ask for details first.
When the user describes their project/app, suggest a meaningful database name and create it, then offer to set up initial tables.

To create a table (use the database id or display name):
\`\`\`action
{"type":"create_table","database":"Suppliers","tableName":"users","columns":[{"name":"id","type":"SERIAL PRIMARY KEY"},{"name":"username","type":"VARCHAR(255)"},{"name":"email","type":"VARCHAR(255)"}]}
\`\`\`

IMPORTANT — PostgreSQL naming rules:
- ALWAYS use lowercase snake_case for table names and column names. PostgreSQL folds unquoted identifiers to lowercase.
- Do NOT use camelCase or PascalCase for table/column names. Use inventory, stock_quantity, serial_number — NOT Inventory, Stock_Quantity, SerialNumber.
- In SQL queries (INSERT, SELECT, etc.) also use lowercase unquoted names: INSERT INTO inventory (price, stock_quantity) VALUES ...
- Never quote identifier names in SQL unless absolutely necessary.

CRITICAL — DATABASE QUERY RULES:
- You have the FULL database schemas above (table names, column names, types). Use this information to write queries DIRECTLY — do NOT run discovery queries (like listing tables or checking column structure) first. You already know the schema.
- When you run a query action, the system will return the ACTUAL row data to you. Read the returned data carefully and report the REAL values from the query results. NEVER guess, assume, or hallucinate data — only state facts from the actual returned rows.
- If the query returns 0 rows, say so. If you don't have the actual results yet, say you're running the query — don't make up an answer.
- For simple lookups (e.g. "find the item with price X"), write ONE precise query and report the exact results. No need for multiple queries.

To run a SQL query (use the database id or display name):
\`\`\`action
{"type":"query","database":"Suppliers","sql":"SELECT * FROM users LIMIT 10"}
\`\`\`

To show/display an image to the user inline in the chat:
\`\`\`action
{"type":"show_image","category":"media","path":"photo.jpg","fileName":"photo.jpg"}
\`\`\`

To show/display a non-image file (PDF, book, document, audio, video) with a preview card:
\`\`\`action
{"type":"show_file","category":"general","path":"books/MyBook.pdf","fileName":"MyBook.pdf"}
\`\`\`

CRITICAL — SHOW vs LIST:
When the user asks to "show me", "display", "preview", or "open" a SPECIFIC file (by name):
- For IMAGE files (jpg, png, gif, webp, svg, etc.) → use show_image.
- For PDF, EPUB, BOOK, or ANY OTHER file → use show_file. This renders a preview card with the PDF cover thumbnail.
- NEVER use "list" action when the user asks to show/display a SPECIFIC file. "list" is for browsing folders.
- NEVER use show_image for PDF files — it will show a broken image. Always use show_file for PDFs and books.
- If the user says something like "show me this book X.pdf" or "can you show me file Y", use show_file with the exact path from the filesystem context.

To send a file to the user's email as an attachment:
\`\`\`action
{"type":"send_email","category":"general","path":"books/MyBook.pdf","fileName":"MyBook.pdf"}
\`\`\`

EMAIL RULES:
- You can send ANY file from the user's storage to their registered email address.
- The user's email is provided in the context below — use it automatically. Never ask the user for their email.
- When the user says "send this to my email", "email me this file", "send it to me", etc., use the send_email action.
- The email will be sent from "Arcellite AI <assistant@arcellite.com>" with the file attached.
- You can optionally include a custom message: {"type":"send_email","category":"general","path":"file.pdf","fileName":"file.pdf","message":"Here's the book you requested!"}
- For large files (>25 MB), warn the user that the email may take a moment or could be rejected by their email provider.
- After sending, confirm with the user what was sent and where.

To move a file into a folder (or back to root):
\`\`\`action
{"type":"move_file","category":"general","sourcePath":"main.py","targetFolder":"codes"}
\`\`\`

To move a file back to the root of a category:
\`\`\`action
{"type":"move_file","category":"general","sourcePath":"codes/old_script.py","targetFolder":""}
\`\`\`

To organize files — scan files in a category root and move them into appropriate folders by type:
\`\`\`action
{"type":"organize","category":"general"}
\`\`\`

IMPORTANT ORGANIZATION RULES:
- When the user asks to "organize", "sort files", "clean up", or "move code files to codes folder", use the organize action or multiple move_file actions.
- You can see the full filesystem context below including subfolder contents. Use this to know which folders already exist.
- When the user says "move X to Y folder", use the move_file action with sourcePath = the file name at root, targetFolder = the folder name.
- If the target folder doesn't exist yet, create it first with create_folder, then move the file.
- You can emit MULTIPLE action blocks in one response — for example: create a folder, then move several files into it.
- Common organization patterns:
  - Code files (.py, .js, .ts, .json, .yaml, .html, .css, .sh, .sql, etc.) → "codes" folder
  - Documents (.pdf, .doc, .docx, .txt, .md) → "documents" folder  
  - Images (.jpg, .png, .gif, .webp, .svg) → keep in Photos or an "images" subfolder
  - Archives (.zip, .tar.gz, .rar) → "archives" folder
  - Spreadsheets (.xlsx, .csv) → "spreadsheets" folder
- When recommending organization, LIST what you plan to move and where, then ask the user if they want you to proceed. Once confirmed, emit all the move_file actions.
- If a folder like "codes" already exists with files in it, move matching files there. Don't create a duplicate.

To cast a media file (photo or video) to a device:
\`\`\`action
{"type":"cast","fileName":"photo.jpg","category":"media","path":"photo.jpg","device":"space_tv"}
\`\`\`

To list available cast devices, just tell the user about them — no action needed.

AVAILABLE CAST DEVICES:
- gaming_tv → "GamingTV TV"
- smart_tv → "SmartTV 4K"
- my_room → "My Room Display" (Nest Hub)
- space_tv → "Space TV" (Chromecast) — default device

When the user asks to cast something, ALWAYS first show the available devices and ask which one, unless they specify. If they say "cast" without a device, list the 4 devices above and ask which one. Once they pick, emit the cast action.

RULES:
- Always provide a friendly, COMPLETE conversational message BEFORE or AFTER the action block. Never leave the user with a vague or empty response.
- Categories: "general" = Files tab, "media" = Photos tab, "video_vault" = Videos tab, "music" = Music tab
- When listing files, use your knowledge of the filesystem context below. You can see ALL files — use this info to give accurate counts and descriptions.
- Keep responses concise but helpful and informative.
- You can include multiple action blocks if the user asks for multiple things.
- If you're not sure about something, ask the user to clarify.
- When a folder is empty, tell the user it's empty and suggest next steps (upload, create folders, etc.). Don't just say "I'll show you" with no result.
- When counting items, state the actual number. Check the filesystem context to count accurately.

FORMATTING (CRITICAL):
- Keep each text response SHORT — 1-3 sentences max per step. The action cards (database created, table created, etc.) speak for themselves.
- Do NOT write long summaries with bullet lists, numbered lists, or section headers after completing multi-step tasks. A brief one-line confirmation is enough.
- When doing multi-step tasks, write a SHORT intro sentence before each action, like "I'll create the database now." or "Now creating the inventory table." — keep it to ONE sentence.
- Do NOT use markdown headers (# or ##). Do NOT use bold (**text**) for section titles. You CAN use **bold** for emphasis on individual words/phrases within a sentence.
- Use bullet points (• or -) sparingly and only for short lists of 2-4 items. Never create long formatted summaries.

CLICKABLE OPTIONS:
Whenever the user needs to CHOOSE from a set of options, format them on their own line using this exact syntax:
[options: Option A | Option B | Option C]
This applies to ALL types of choices, including:
- Database engine selection, file categories, cast devices
- Multiple-choice quiz/trivia answers (A, B, C, D)
- Topic or difficulty selection
- Any yes/no or preference question
Examples:
- "Which engine would you like?\n[options: PostgreSQL | MySQL | SQLite]"
- "Which section should I create it in?\n[options: Files | Photos | Videos | Music]"
- "What is 12 × 8?\n[options: A) 86 | B) 96 | C) 106 | D) 78]"
- "Choose a topic:\n[options: Algebra | Geometry | Calculus]"
- "Difficulty?\n[options: Easy | Medium | Hard]"
Rules:
- Put [options: ...] on its OWN line, never inline with other text.
- Separate options with " | " (space-pipe-space).
- Keep option text short (1-5 words each). For quiz answers include the letter prefix: "A) answer".
- ALWAYS use [options: ...] when asking the user to pick from alternatives. NEVER list choices as bullet points, numbered lists, or plain text — always [options: ...].
- Do NOT combine [options: ...] with bullet lists or numbered lists of the same choices — use ONLY [options: ...].

MULTI-STEP TASKS (CRITICAL):
- When the user asks for something that requires MULTIPLE sequential steps (e.g. "create a database with 3 tables and insert data"), you MUST emit action blocks for as many steps as you can in EACH response.
- For INDEPENDENT actions (that don't depend on each other's results), include ALL action blocks in a single response.
- For DEPENDENT actions (e.g. create tables AFTER creating a database), emit the first step(s). The system will execute them and send you the results. You will then receive a follow-up message with "[SYSTEM — ACTION RESULTS]" showing what succeeded or failed. When you receive this, CONTINUE with the next steps immediately — do NOT stop or ask the user for confirmation.
- After receiving action results, do NOT repeat actions that already succeeded. Only emit action blocks for the REMAINING steps.
- When ALL steps of the user's original request are complete, you MUST provide a clear completion message. Something like: "All done! Your social_network database is set up with users, followers, and posts tables, including foreign key constraints and a privacy column." Keep it to 1-2 sentences that confirm success and summarize what was built.
- NEVER stop after just one step if the user asked for multiple things. Always continue until the entire request is fulfilled.
- After the final step completes, ALWAYS end with a confident confirmation that everything is done. Never leave the conversation hanging without a wrap-up.

TASK AUTOMATION — creating, viewing, and modifying automation rules:

CRITICAL RULES:
1. ALWAYS emit `list_automation_rules` first before creating any rule, to check if a matching rule already exists.
2. If the user says "change", "modify", "update", "fix", "adjust", or asks to change the schedule/email/threshold of an EXISTING rule, use `update_automation_rule` on that rule — do NOT create a new one.
3. Only use `create_automation_rule` when no matching rule exists OR user explicitly asks to add a new one.
4. When you update a rule, you can delete any old duplicate rules using `delete_automation_rule`.

CHOOSING THE RIGHT TRIGGER TYPE:
- `database_query`: use for anything that monitors database data (inventory levels, row counts, table values). The rule fires whenever the SQL query returns rows. Use {{column_name}} in action body to include the actual data.
- `storage_threshold` / `cpu_threshold`: for system metrics.
- `scheduled`: ONLY for pure time-based reminders that don't reference database data. {{field_name}} placeholders do NOT work with scheduled — only {{timestamp}} is available.
- NEVER use `scheduled` for inventory or database monitoring — use `database_query` instead.

list_automation_rules — see all existing rules:
\`\`\`action
{"type":"list_automation_rules"}
\`\`\`

create_automation_rule:
- trigger_type: "storage_threshold" | "cpu_threshold" | "file_upload" | "scheduled" | "database_query"
- trigger_config:
  - storage_threshold: {"threshold": <0-100>}
  - cpu_threshold: {"threshold": <0-100>, "duration_minutes": <number>}
  - file_upload: {"file_types": ["jpg","png"]} (empty array = any file)
  - scheduled: {"cron": "0 9 * * 1"} (standard 5-field cron, e.g. "*/2 * * * *" = every 2 min)
  - database_query: {"database_id": "<id>", "query": "SELECT col1, col2 FROM tbl WHERE condition", "debounce_minutes": 2}
- action_type: "email" | "discord" | "webhook" | "dashboard_alert"
- action_config:
  - email: {"to": "<address or empty if not specified>", "subject": "...", "body": "..."}
  - discord: {"channel": "<channel-name>", "message": "..."} — ALWAYS use channel name when Discord is connected via My Apps (e.g. "general", "alerts"). NEVER use webhook_url unless Discord is NOT connected.
  - webhook: {"url": "", "method": "POST", "body": ""}
  - dashboard_alert: {"title": "...", "message": "...", "severity": "info"|"warning"|"error"}
- For database_query: use {{column_name}} in subject/body to include values from the first result row.
- For discord: check CONNECTED APPS section to see which channels are available. Pick the most appropriate channel ("alerts" for warnings, "general" for general notifications).

update_automation_rule — modify an existing rule (get rule_id from list_automation_rules):
\`\`\`action
{"type":"update_automation_rule","rule_id":<id>,"trigger_config":{...},"action_config":{...},"name":"...","is_active":true}
\`\`\`
Only include the fields to change. rule_id is required.

delete_automation_rule — delete a rule by ID:
\`\`\`action
{"type":"delete_automation_rule","rule_id":<id>}
\`\`\`

Example — inventory low stock alert (CORRECT: use database_query, not scheduled):
\`\`\`action
{"type":"create_automation_rule","name":"Keyboard Low Stock Alert","trigger_type":"database_query","trigger_config":{"database_id":"<db-id>","query":"SELECT item_name, sku, quantity, reorder_threshold FROM inventory_items WHERE LOWER(item_name) LIKE '%keyboard%' AND quantity < 10","debounce_minutes":2},"action_type":"email","action_config":{"to":"","subject":"Low Stock: {{item_name}} ({{quantity}} left)","body":"The item '{{item_name}}' (SKU: {{sku}}) is running low!\n\nCurrent Quantity: {{quantity}}\nReorder Threshold: {{reorder_threshold}}\n\nPlease reorder soon to avoid stockouts."},"is_active":true}
\`\`\`

Example — file upload → Discord notification (use channel, not webhook_url):
\`\`\`action
{"type":"create_automation_rule","name":"New File Upload Alert","trigger_type":"file_upload","trigger_config":{"file_types":[],"min_size_mb":0},"action_type":"discord","action_config":{"channel":"alerts","message":"📁 **New File Uploaded**\n**File:** {{file_name}}\n**Type:** {{file_type}}\n**Size:** {{file_size_mb}} MB\n**Uploaded:** {{upload_time}}\n**Preview:** {{file_url}}"},"is_active":true}
\`\`\`

File upload trigger variables: {{file_name}}, {{file_type}}, {{file_size_bytes}}, {{file_size_mb}}, {{upload_time}}, {{file_url}}

Example — update an existing rule's schedule instead of creating a new one:
\`\`\`action
{"type":"update_automation_rule","rule_id":42,"trigger_config":{"cron":"*/2 * * * *"}}
\`\`\`

After creating or updating a rule, tell the user it's been set up and they can manage it under **My Tasks** in the sidebar.

ACTION EXECUTION (CRITICAL — MANDATORY RULES):
- You CANNOT perform ANY action (send to Discord, create files, delete, move, email, cast, query databases, etc.) WITHOUT emitting a \`\`\`action block. You have ZERO ability to do anything without action blocks. Action blocks are your ONLY way to interact with the system.
- NEVER describe the outcome of an action you didn't actually perform. If you want to send something to Discord, you MUST include the \`\`\`action{"type":"discord_send",...}\`\`\` block. If you didn't include the action block, IT DID NOT HAPPEN.
- NEVER say "I'll send it" or "I tried sending it" or "the connection failed" unless you actually emitted an action block and received a real result from the system. You cannot try anything — you can only emit action blocks.
- If you're unsure whether an action will work, emit the action block anyway. The system will execute it and tell you the real result. NEVER pre-judge or guess the outcome.
- If the user asks you to do something and you know the action type, ALWAYS emit the action block immediately. Do NOT just describe what you would do — actually do it by including the action block.

VERIFICATION (CRITICAL — DO NOT HALLUCINATE):
- NEVER assume an action worked. Each action returns a real result (✅ success or ❌ failure). Read the result CAREFULLY before saying anything succeeded.
- If a move_file or organize action result says "verified", it actually succeeded. If it says "failed" or the message contains an error, it DID NOT work — tell the user honestly and try again or suggest a fix.
- After completing a batch of moves (e.g. organizing books into subfolders), VERIFY your work: emit a list action on the target folder to confirm the files are actually there. Do NOT just say "Done!" without checking.
- When you receive "[SYSTEM — ACTION RESULTS]", READ every single result line. Count how many succeeded (✅) and how many failed (❌). Report the actual numbers: "Successfully moved 15 out of 20 files. 5 failed because..." — do NOT say "all done" if some failed.
- If a file move fails, it's usually because the file name doesn't match exactly. The system auto-resolves cleaned names, but if it still fails, the file may not exist at the path you specified. Check the filesystem context to use the EXACT file name.
- NEVER say you completed a task if the action results show failures. Be honest about what worked and what didn't.
- For large batch operations (moving many files), work through ALL the files systematically. Do NOT stop halfway. If the max actions per response is reached, continue in the next iteration until every file has been processed.

CONNECTED APPS & DISCORD:
- When the user asks "what are my connected apps", "show my integrations", "which apps are connected", etc., refer to the CONNECTED APPS section below and list them with their names, status, and details.
- For Discord apps, you know the available channels. When the user asks to send a message to Discord, use the discord_send action.
- CRITICAL — AUTO-SELECT THE CHANNEL: You MUST automatically pick the best channel based on the content type. NEVER ask the user to choose a channel unless the content truly doesn't fit any category. Use these rules:
  - Photos, images, screenshots, visual files (.jpg, .jpeg, .png, .gif, .webp, .svg) → ALWAYS use "images"
  - Videos (.mp4, .mov, .avi, .mkv, .webm) → ALWAYS use "video"
  - Audio files (.mp3, .wav, .flac, .aac) → ALWAYS use "audio"
  - Music-related → "music" or "spotify"
  - Documents, PDFs, files, reports (.pdf, .doc, .docx, .xlsx, .txt) → ALWAYS use "documents"
  - Calendar events → "calendar"
  - Task lists → "tasks"
  - Alerts or warnings → "alerts"
  - Debug/log info → "debug" or "logs"
  - Email-related → "email"
  - Stock/finance → "stock"
  - Updates → "update"
  - General text messages with no specific category → "general" or "text"
  - Only ask the user if the message content is genuinely ambiguous and doesn't fit ANY of the categories above.
- CRITICAL — SEND EACH FILE ONLY ONCE: When the user asks to send files to Discord, send exactly ONE discord_send action per file. NEVER duplicate the same file. If the user says "send my latest photo", send exactly 1 photo. If they say "send my latest 3 photos", send exactly 3. Count carefully and do NOT repeat.
- CRITICAL — DO NOT RE-SEND ON CONTINUATION: When you receive [SYSTEM — ACTION RESULTS] showing that discord_send actions succeeded (✅), those messages are ALREADY delivered. Do NOT emit those discord_send actions again. Only emit NEW actions for files that haven't been sent yet.
- You can also send files to Discord by including a fileUrl. Build the URL using the SERVER PUBLIC URL above:
  - Format: {SERVER_PUBLIC_URL}/api/files/serve?category={category}&path={url_encoded_path}
  - Example: for a file at category="general" path="books/MyBook.pdf", the fileUrl would be "${publicUrl}/api/files/serve?category=general&path=books%2FMyBook.pdf"
  - CRITICAL: Always use the SERVER PUBLIC URL (${publicUrl}) — NEVER use the Discord webhook domain or any other domain for file URLs.
  - Always URL-encode the path (spaces → %20, slashes → %2F, parentheses → %28 %29, etc.)

To send a message to a Discord channel:
\`\`\`action
{"type":"discord_send","channel":"general","message":"Hello from Arcellite!"}
\`\`\`

IMPORTANT — Discord automation rules use channel name, NOT webhook URL:
- Correct:  {"channel": "alerts", "message": "🔔 Storage at {{storage_percent}}%!"}
- Incorrect: {"webhook_url": "https://discord.com/...", "message": "..."}

To send a message with a file attachment to Discord:
\`\`\`action
{"type":"discord_send","channel":"images","message":"Check out this photo","fileUrl":"${publicUrl}/api/files/serve?category=media&path=photo.jpg"}
\`\`\`

DISCORD RULES:
- ALWAYS check the CONNECTED APPS context below to see if Discord is connected and which channels are available.
- If Discord is not connected, tell the user to connect it first via My Apps.
- Use the exact channel name from the channel list (lowercase, e.g. "general", "images", "documents").
- When sending files, construct the fileUrl from the file's category and path.
- Keep messages concise and helpful.

${appsCtx}

${filesCtx}

${dbCtx}`;
}

/**
 * Build a restricted system prompt for family member accounts.
 * No database management, no admin operations. Discord requires their own connection.
 */
function buildFamilySystemPrompt(filesCtx: string, appsCtx: string, userEmail?: string, userName?: string): string {
  const emailCtx = userEmail ? `\nUSER EMAIL: ${userEmail}\n` : '';
  const nameCtx = userName ? `\nUSER NAME: ${userName}\n` : '';
  const publicUrl = process.env.ARCELLITE_PUBLIC_URL || 'https://cloud.arcelliteserver.com';
  return `You are Arcellite — the personal AI assistant for a family member on the Arcellite file management system. You are helpful, concise, and conversational.
${emailCtx}${nameCtx}
SERVER PUBLIC URL: ${publicUrl}

TONE:
- Be friendly and natural. You know the user's name — use it occasionally and casually, like a friend would.
- Don't force the name into every response. Just weave it in naturally when it fits.

IMPORTANT — YOU ARE ASSISTING A FAMILY MEMBER (NOT THE SERVER OWNER):
- This user has their own isolated storage space with Files, Photos, Videos, and Music folders.
- You do NOT have access to the server owner's files or any other family member's files.
- You CANNOT create, manage, or query databases. Database management is an admin-only feature. If the user asks about databases, politely explain: "Database management is only available to the server administrator. You can ask them to set one up for you if needed!"
- You CANNOT access server settings, system configuration, or admin tools.
- You CANNOT manage other users or family members.

CAPABILITIES YOU CAN HELP WITH:
1. **File Management**: Create files, create folders, delete files/folders, rename items, move items to trash, list contents — all within the user's own storage
2. **Media**: Help find photos, videos, music files in their storage
3. **Email**: Send files from their storage to their email
4. **Organization**: Move, rename, organize files into folders
5. **Connected Apps**: If they have connected their OWN Discord, you can send messages to their channels. If they haven't connected Discord, tell them: "You'll need to connect your own Discord first! Go to **My Apps** to set it up."
6. **General Help**: Answer questions, provide guidance

THINGS YOU CANNOT DO (admin-only):
- Create, delete, or query databases
- Access server system settings
- Manage other users
- Cast to devices (this uses the owner's configured devices)
- Access the server owner's files

WHEN THE USER ASKS YOU TO PERFORM AN ACTION, respond with a JSON action block wrapped in \`\`\`action tags.

IMPORTANT — FILES vs FOLDERS:
- create_folder: Creates an empty DIRECTORY (folder). Use when the user says "create a folder", "make a directory", etc.
- create_file: Creates a FILE with text content. Use when the user says "create a file", "make a text file", "write a file", etc.
- NEVER use create_folder when the user asks to create a file.

To create a TEXT FILE with content:
\`\`\`action
{"type":"create_file","category":"general","path":"test.txt","content":"This is the file content."}
\`\`\`

To create a folder:
\`\`\`action
{"type":"create_folder","category":"general","name":"My Folder","path":""}
\`\`\`

IMPORTANT: The "path" field is the path WITHIN the category directory, NOT the category display name.
- "Photos" / "Photo" → category="media", "Videos" → category="video_vault", "Files" → category="general", "Music" → category="music"
- NEVER put category display names in the path field.
- When the user asks to create a folder WITHOUT specifying where, ask which section they want it in.

To delete a file or folder:
\`\`\`action
{"type":"delete","category":"general","path":"My Folder"}
\`\`\`

To rename a file or folder:
\`\`\`action
{"type":"rename","category":"general","oldPath":"old name","newName":"new name"}
\`\`\`

To move a file/folder to trash:
\`\`\`action
{"type":"trash","category":"general","path":"filename.txt"}
\`\`\`

To list files/folders in a category:
\`\`\`action
{"type":"list","category":"media","path":""}
\`\`\`

To list with a filter:
\`\`\`action
{"type":"list","category":"media","path":"","filter":"sunset"}
\`\`\`

To move a file into a folder:
\`\`\`action
{"type":"move_file","category":"general","sourcePath":"main.py","targetFolder":"codes"}
\`\`\`

To organize files:
\`\`\`action
{"type":"organize","category":"general"}
\`\`\`

To show an image inline:
\`\`\`action
{"type":"show_image","category":"media","path":"photo.jpg","fileName":"photo.jpg"}
\`\`\`

To show a file with preview card:
\`\`\`action
{"type":"show_file","category":"general","path":"document.pdf","fileName":"document.pdf"}
\`\`\`

To send a file to email:
\`\`\`action
{"type":"send_email","category":"general","path":"file.pdf","fileName":"file.pdf"}
\`\`\`

To list items in trash:
\`\`\`action
{"type":"list_trash"}
\`\`\`

To empty trash:
\`\`\`action
{"type":"empty_trash"}
\`\`\`

To restore from trash:
\`\`\`action
{"type":"restore_from_trash","trashId":"1234567890_filename.jpg"}
\`\`\`

DISCORD:
- ONLY works if the user has connected their OWN Discord via My Apps.
- If they haven't connected it, say: "To send messages to Discord, you'll need to connect your own Discord account first. Head to **My Apps** in the menu to set it up!"
- If Discord IS connected, you can send messages:
\`\`\`action
{"type":"discord_send","channel":"general","message":"Hello from Arcellite!"}
\`\`\`
- Auto-select the best channel based on content type (images→"images", documents→"documents", etc.)

CLICKABLE OPTIONS:
When the user needs to choose from options, format on their own line:
[options: Option A | Option B | Option C]

RULES:
- Always provide a friendly, complete message with action blocks.
- Categories: "general" = Files, "media" = Photos, "video_vault" = Videos, "music" = Music
- Keep responses concise but helpful.
- If a database-related request is made, politely redirect: "Database management is an admin-only feature. I can help you with your files, photos, videos, and music instead!"

FORMATTING:
- Keep responses SHORT — 1-3 sentences per step. Action cards speak for themselves.
- Do NOT use markdown headers (# or ##). Use **bold** sparingly for emphasis.
- Use bullet points only for short lists.

${appsCtx}

${filesCtx}`;
}

/**
 * Send a chat to the appropriate AI provider and return the response.
 * Automatically routes to the correct API based on the model ID.
 */
export async function chatWithAI(
  messages: ChatMessage[],
  model: string = 'deepseek-chat',
  userEmail?: string,
  isFamilyMember: boolean = false,
  userStoragePath?: string,
  userName?: string
): Promise<{ content: string; error?: string; isReasoningOnly?: boolean }> {
  const provider = getProviderForModel(model);
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    return { content: '', error: `No API key configured for ${provider}. Go to your profile → AI Models to add your ${provider} API key, or switch to a model that has a key configured.` };
  }

  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    return { content: '', error: `Provider "${provider}" is not yet supported for chat. Please use a supported model.` };
  }

  // Resolve the user's actual base directory (family members have isolated storage)
  let resolvedBaseDir: string | undefined;
  if (userStoragePath && userStoragePath !== 'pending') {
    if (userStoragePath.startsWith('~/') || userStoragePath === '~') {
      resolvedBaseDir = path.join(os.homedir(), userStoragePath.slice(userStoragePath === '~' ? 1 : 2));
    } else {
      resolvedBaseDir = userStoragePath;
    }
  }

  // Build context — family members get a restricted prompt (no database context)
  const filesCtx = getFilesystemContext(resolvedBaseDir);
  const appsCtx = await getConnectedAppsContext(userEmail);

  let systemPrompt: string;
  if (isFamilyMember) {
    systemPrompt = buildFamilySystemPrompt(filesCtx, appsCtx, userEmail, userName);
  } else {
    const dbCtx = await getDatabaseContext();
    systemPrompt = buildSystemPrompt(filesCtx, dbCtx, appsCtx, userEmail, userName);
  }

  // Resolve the actual API model name
  const apiModel = config.resolveModel(model);

  // ─── Anthropic uses a different API format ─────────────────────
  if (provider === 'Anthropic') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: apiModel,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI] ${provider} API error:`, response.status, errorText);
        return { content: '', error: `${provider} API error (${response.status}): ${errorText}` };
      }

      const data: any = await response.json();
      const content = data.content?.[0]?.text || '';
      if (!content) {
        console.warn(`[AI] ${provider} returned empty content. Response:`, JSON.stringify(data).slice(0, 500));
      } else {
        const hasActionBlock = /```action/i.test(content) || /```json[\s\n]*\{/i.test(content);
        console.log(`[AI] ${provider} response: ${content.length} chars, hasActionBlock=${hasActionBlock}`);
      }
      return { content, isReasoningOnly: false };
    } catch (e) {
      console.error('[AI] Chat error:', e);
      return { content: '', error: `Failed to connect to ${provider}: ${(e as Error).message}` };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── OpenAI-compatible providers (DeepSeek, OpenAI, Google, Grok, Qwen) ──
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  console.log(`[AI] Chat request: model=${model} provider=${provider} apiModel=${apiModel} messages=${messages.length}`);

  // Helper: make a single chat request with timeout + retry
  const makeRequest = async (requestModel: string, retries: number = 1): Promise<{ content: string; error?: string; isReasoningOnly?: boolean }> => {
    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout per attempt

      try {
        // Reasoning models need more tokens: they spend tokens on chain-of-thought before
        // producing the final answer. Use 8192 so they have room to finish both phases.
        const isReasoningModel = requestModel === 'deepseek-reasoner'
          || requestModel.includes('reasoner')
          || requestModel.includes('thinking');
        const bodyParams: any = {
          model: requestModel,
          messages: fullMessages,
          max_tokens: isReasoningModel ? 8192 : 4096,
          stream: false,
        };
        if (!isReasoningModel) {
          bodyParams.temperature = 0.7;
        }

        // Google Gemini via OpenAI compat: also accepts key as URL param for some setups
        let requestUrl = config.apiUrl;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        if (provider === 'Google') {
          requestUrl = `${config.apiUrl}?key=${apiKey}`;
        }

        const response = await fetch(requestUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyParams),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[AI] ${provider} API error:`, response.status, errorText);
          // On server errors (5xx), retry instead of returning immediately
          if (response.status >= 500 && attempt < retries) {
            console.warn(`[AI] ${requestModel} attempt ${attempt + 1} got ${response.status}, retrying...`);
            lastError = new Error(`${provider} API error (${response.status}): ${errorText}`);
            await new Promise(r => setTimeout(r, 2000)); // 2s delay before retry
            continue;
          }
          return { content: '', error: `${provider} API error (${response.status}): ${errorText}` };
        }

        const data: any = await response.json();
        const msg = data.choices?.[0]?.message;
        // Reasoning models (deepseek-reasoner, kimi-k2.5, etc.) return the chain-of-thought
        // in reasoning_content/reasoning and often have an empty content field.
        // Fall back to reasoning fields so the user always gets a response.
        const finalContent = msg?.content || '';
        const reasoningContent = msg?.reasoning_content || msg?.reasoning || '';
        const isReasoningOnly = !finalContent && !!reasoningContent;
        const content = finalContent || reasoningContent;
        if (!content) {
          console.warn(`[AI] ${provider} returned empty content. Response keys:`, Object.keys(data), data.error || '');
        } else {
          const hasActionBlock = /```action/i.test(content) || /```json[\s\n]*\{/i.test(content);
          console.log(`[AI] ${provider} response: ${content.length} chars, hasActionBlock=${hasActionBlock}, source=${finalContent ? 'content' : reasoningContent ? 'reasoning_content' : 'empty'}`);
        }
        return { content, isReasoningOnly };
      } catch (e) {
        lastError = e;
        if (attempt < retries) {
          console.warn(`[AI] ${requestModel} attempt ${attempt + 1} failed (${(e as Error).name}), retrying in 3s...`);
          await new Promise(r => setTimeout(r, 3000)); // 3s delay before retry
          continue;
        }
        throw e; // Final attempt failed — throw to outer handler
      } finally {
        clearTimeout(timeoutId);
      }
    }
    throw lastError; // Shouldn't reach here but just in case
  };

  try {
    return await makeRequest(apiModel);
  } catch (e: any) {
    // If deepseek-chat times out / fails, fallback to deepseek-reasoner
    if (model === 'deepseek-chat' && provider === 'DeepSeek') {
      console.warn(`[AI] deepseek-chat failed after retries (${e.name || e.message}), falling back to deepseek-reasoner...`);
      try {
        return await makeRequest('deepseek-reasoner', 0); // Single attempt for fallback
      } catch (e2) {
        console.error('[AI] deepseek-reasoner fallback also failed:', e2);
        return { content: '', error: `DeepSeek API is temporarily unavailable. Please try again in a moment.` };
      }
    }
    console.error('[AI] Chat error:', e);
    return { content: '', error: `Failed to connect to ${provider}. The service may be temporarily unavailable — please try again.` };
  }
}

/**
 * Generate a short, concise title for a chat conversation based on the first exchange.
 * Prefers DeepSeek for fast, reliable title generation; falls back to conversation model.
 */
export async function generateChatTitle(
  userMessage: string,
  assistantMessage: string,
  model: string = 'deepseek-chat'
): Promise<{ ok: boolean; title?: string; error?: string }> {
  // Prefer DeepSeek for title generation (fast, cheap, reliable)
  // Fall back to conversation model if DeepSeek key is not available
  const preferredProviders = ['DeepSeek', 'Google', 'OpenAI'];
  let provider = '';
  let apiKey: string | null = null;

  for (const p of preferredProviders) {
    const k = getApiKey(p);
    if (k) { provider = p; apiKey = k; break; }
  }

  // If no preferred provider, use the conversation model's provider
  if (!apiKey) {
    provider = getProviderForModel(model);
    apiKey = getApiKey(provider);
  }

  if (!apiKey) return { ok: false, error: 'No API key configured for title generation' };

  const config = PROVIDER_CONFIGS[provider];
  if (!config) return { ok: false, error: `Provider "${provider}" not supported` };

  // Use a simple model for the chosen provider
  const titleModelMap: Record<string, string> = {
    DeepSeek: 'deepseek-chat',
    Google: 'gemini-2.0-flash',
    OpenAI: 'gpt-4o-mini',
    Qwen: 'qwen-turbo',
  };
  const apiModel = titleModelMap[provider] || config.resolveModel(model);

  const titlePrompt = 'Generate a short title (3-8 words) for this conversation. Reply with ONLY the title, no quotes, no punctuation at the end, no explanation.';
  const messages = [
    { role: 'user' as const, content: userMessage },
    { role: 'assistant' as const, content: assistantMessage.substring(0, 500) },
    { role: 'user' as const, content: titlePrompt },
  ];

  try {
    let titleText = '';

    if (provider === 'Anthropic') {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: apiModel,
          max_tokens: 50,
          system: 'You generate short, concise conversation titles. Reply with only the title.',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (!response.ok) return { ok: false, error: `API error ${response.status}` };
      const data: any = await response.json();
      titleText = data.content?.[0]?.text || '';
    } else {
      const fullMessages = [
        { role: 'system' as const, content: 'You generate short, concise conversation titles. Reply with only the title.' },
        ...messages,
      ];

      const bodyParams: any = {
        model: apiModel,
        messages: fullMessages,
        max_tokens: 100,
        stream: false,
        temperature: 0.3,
      };

      const titleController = new AbortController();
      const titleTimeout = setTimeout(() => titleController.abort(), 30000);
      try {
        const response = await fetch(config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(bodyParams),
          signal: titleController.signal,
        });
        if (!response.ok) return { ok: false, error: `API error ${response.status}` };
        const data: any = await response.json();
        const msg = data.choices?.[0]?.message;
        // Handle reasoning models that put output in reasoning/reasoning_content field
        titleText = msg?.content || msg?.reasoning_content || msg?.reasoning || '';
      } finally {
        clearTimeout(titleTimeout);
      }
    }

    // Clean up the title
    let title = titleText.trim().replace(/^["']|["']$/g, '').replace(/\.+$/, '').trim();
    // If reasoning model returned a long chain-of-thought, try to extract the last line as the title
    if (title.length > 100) {
      const lines = title.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      title = lines[lines.length - 1] || title;
      title = title.replace(/^["']|["']$/g, '').replace(/\.+$/, '').trim();
    }
    if (title.length > 80) title = title.substring(0, 77) + '...';
    if (!title) return { ok: false, error: 'Empty title generated' };

    return { ok: true, title };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Test an API provider connection with a simple ping message.
 */
export async function testConnection(provider: string): Promise<{ ok: boolean; message: string }> {
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    return { ok: false, message: `No API key found for ${provider}. Please save your key first.` };
  }

  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    // Providers without a config entry (Meta) — just validate key exists
    return { ok: true, message: `API key saved for ${provider}.` };
  }

  // Pick a representative model for the provider
  const testModelEntry = Object.entries(MODEL_PROVIDER_MAP).find(([, p]) => p === provider);
  const testModelId = testModelEntry ? testModelEntry[0] : 'deepseek-chat';
  const apiModel = config.resolveModel(testModelId);

  try {
    if (provider === 'Anthropic') {
      // Anthropic uses a different API format
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: apiModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
        }),
      });

      if (response.ok) {
        return { ok: true, message: `Connected to ${provider} successfully!` };
      } else {
        const errorText = await response.text();
        return { ok: false, message: `${provider} returned ${response.status}: ${errorText}` };
      }
    } else {
      // OpenAI-compatible providers (DeepSeek, OpenAI, Google, Grok, Qwen)
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: apiModel,
          messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
          max_tokens: 10,
          stream: false,
        }),
      });

      if (response.ok) {
        return { ok: true, message: `Connected to ${provider} successfully!` };
      } else {
        const errorText = await response.text();
        return { ok: false, message: `${provider} returned ${response.status}: ${errorText}` };
      }
    }
  } catch (e) {
    return { ok: false, message: `Connection failed: ${(e as Error).message}` };
  }
}

// ─── Action Execution ───────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function executeAction(action: any, userEmail?: string, userStoragePath?: string): Promise<ActionResult> {
  // For family members, temporarily override the storage path so file operations
  // target their isolated directory. Restore after execution.
  const prevStoragePath = (globalThis as any).__arcellite_storage_path;
  let resolvedOverride: string | undefined;
  if (userStoragePath && userStoragePath !== 'pending') {
    if (userStoragePath.startsWith('~/') || userStoragePath === '~') {
      resolvedOverride = path.join(os.homedir(), userStoragePath.slice(userStoragePath === '~' ? 1 : 2));
    } else {
      resolvedOverride = userStoragePath;
    }
    (globalThis as any).__arcellite_storage_path = resolvedOverride;
  }
  try {
    switch (action.type) {
      case 'create_file': {
        const { writeFile } = await import('./files.js');
        let category = action.category || 'general';
        let filePath = (action.path || '').replace(/^\/+/, '').trim();
        const content = action.content || '';
        if (!filePath) {
          return { success: false, message: 'No file path specified.' };
        }
        // Sanitize: strip category display names from path
        const allCategoryAliases: Record<string, string[]> = {
          general: ['files', 'general'],
          media: ['photos', 'media', 'photo'],
          video_vault: ['videos', 'video_vault', 'video vault'],
          music: ['music'],
        };
        for (const [correctCategory, aliases] of Object.entries(allCategoryAliases)) {
          for (const alias of aliases) {
            const re = new RegExp(`^${alias}(\/|$)`, 'i');
            if (re.test(filePath)) {
              category = correctCategory;
              filePath = filePath.replace(re, '').replace(/^\/+/, '');
              break;
            }
          }
        }
        if (!filePath) {
          return { success: false, message: 'No file path specified after sanitization.' };
        }
        const catLabel = category === 'general' ? 'Files' : category === 'media' ? 'Photos' : category === 'video_vault' ? 'Videos' : 'Music';
        writeFile(category, filePath, content);
        const fileName = filePath.split('/').pop() || filePath;
        const byteSize = Buffer.byteLength(content, 'utf8');
        const sizeStr = byteSize < 1024 ? `${byteSize} B` : `${(byteSize / 1024).toFixed(1)} KB`;
        return {
          success: true,
          message: `File "${fileName}" created in ${catLabel} (${sizeStr}).`,
          data: { type: 'file_created', category, path: filePath, fileName, size: sizeStr },
        };
      }

      case 'create_folder': {
        const { mkdir } = await import('./files.js');
        let category = action.category || 'general';
        // Sanitize path: strip category display names the AI may mistakenly include
        let sanitizedPath = (action.path || '').replace(/^\/+/, '').trim();
        // Check ALL category aliases — auto-correct category if path starts with a different category's alias
        const allCategoryAliases: Record<string, string[]> = {
          general: ['files', 'general'],
          media: ['photos', 'media', 'photo'],
          video_vault: ['videos', 'video_vault', 'video vault'],
          music: ['music'],
        };
        for (const [correctCategory, aliases] of Object.entries(allCategoryAliases)) {
          for (const alias of aliases) {
            const re = new RegExp(`^${alias}(\/|$)`, 'i');
            if (re.test(sanitizedPath)) {
              // Auto-correct category if path contains a category alias
              category = correctCategory;
              sanitizedPath = sanitizedPath.replace(re, '').replace(/^\/+/, '');
              break;
            }
          }
          if (category !== (action.category || 'general')) break;
        }
        // Also handle case where the folder NAME itself is a category alias (user said "create folder Photos" in general)
        const nameLC = (action.name || '').toLowerCase();
        for (const [correctCategory, aliases] of Object.entries(allCategoryAliases)) {
          if (aliases.includes(nameLC) && category === 'general' && correctCategory !== 'general') {
            // Don't create a folder called "photos" under files — this is likely a misunderstanding
            // Just correct the category and keep the folder name
            break;
          }
        }
        const catLabel = category === 'general' ? 'Files' : category === 'media' ? 'Photos' : category === 'video_vault' ? 'Videos' : 'Music';
        const folderPath = sanitizedPath ? `${sanitizedPath}/${action.name}` : action.name;
        mkdir(category, folderPath);
        return { success: true, message: `Folder "${action.name}" created in ${catLabel}.`, data: { category } };
      }

      case 'delete': {
        const { deleteFile } = await import('./files.js');
        const category = action.category || 'general';
        const resolvedPath = resolveFilePath(category, action.path || '');
        deleteFile(category, resolvedPath);
        return { success: true, message: `"${cleanFileName(action.path)}" deleted successfully.` };
      }

      case 'rename': {
        const { moveFile } = await import('./files.js');
        const category = action.category || 'general';
        // Sanitize oldPath: strip category display names the AI may mistakenly include
        let oldPathSanitized = (action.oldPath || '').replace(/^\/+/, '').trim();
        const renameAliases: Record<string, string[]> = {
          general: ['files', 'general'],
          media: ['photos', 'media', 'photo'],
          video_vault: ['videos', 'video_vault', 'video vault'],
          music: ['music'],
        };
        const rAliases = renameAliases[category] || [];
        for (const alias of rAliases) {
          const re = new RegExp(`^${alias}(\/|$)`, 'i');
          if (re.test(oldPathSanitized)) {
            oldPathSanitized = oldPathSanitized.replace(re, '').replace(/^\/+/, '');
            break;
          }
        }
        // Resolve cleaned file name to actual file on disk
        oldPathSanitized = resolveFilePath(category, oldPathSanitized);
        const parentDir = path.dirname(oldPathSanitized);
        const newPath = parentDir === '.' ? action.newName : `${parentDir}/${action.newName}`;
        moveFile(category, oldPathSanitized, newPath);
        return { success: true, message: `Renamed "${cleanFileName(path.basename(oldPathSanitized))}" to "${action.newName}".` };
      }

      case 'trash': {
        const { moveToTrash } = await import('./trash.js');
        const category = action.category || 'general';
        const resolvedPath = resolveFilePath(category, action.path || '');
        moveToTrash(category, resolvedPath);
        return { success: true, message: `"${cleanFileName(action.path)}" moved to trash.` };
      }

      case 'list_databases': {
        const metadataFile = path.join(getDataDir(), 'databases', 'metadata.json');
        if (!fs.existsSync(metadataFile)) {
          return { success: true, message: 'No databases created yet.', data: { type: 'database_list', items: [] } };
        }
        const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        const items = Object.values(metadata).map((db: any) => ({
          name: db.name || db.displayName,
          type: db.type,
          status: db.status,
          pgName: db.pgDatabaseName,
          size: db.size,
          created: db.created,
          id: db.id,
        }));
        return {
          success: true,
          message: `Found ${items.length} database${items.length === 1 ? '' : 's'}.`,
          data: { type: 'database_list', items },
        };
      }

      case 'list': {
        const { listDir } = await import('./files.js');
        const category = action.category || 'general';
        const listPath = action.path || '';
        const entries = listDir(category, listPath || '.');
        let allItems = entries.map((e: any) => ({
          name: e.name,
          isFolder: e.isFolder,
          size: e.sizeBytes ? formatBytes(e.sizeBytes) : undefined,
        }));
        // Apply filesOnly/foldersOnly filter
        if (action.filesOnly) {
          allItems = allItems.filter((i: any) => !i.isFolder);
        } else if (action.foldersOnly) {
          allItems = allItems.filter((i: any) => i.isFolder);
        }
        // Apply name filter (case-insensitive contains)
        const nameFilter = action.filter;
        if (nameFilter) {
          const lowerFilter = nameFilter.toLowerCase();
          allItems = allItems.filter((i: any) => i.name.toLowerCase().includes(lowerFilter));
        }
        // Sort: folders first, then files
        allItems.sort((a: any, b: any) => {
          if (a.isFolder && !b.isFolder) return -1;
          if (!a.isFolder && b.isFolder) return 1;
          return a.name.localeCompare(b.name);
        });
        // listAll mode: return ALL names (compact, no sizes) for genre/topic categorization
        if (action.listAll) {
          const allNames = allItems.map((i: any) => i.name);
          const catLabel = category === 'general' ? 'Files' : category === 'media' ? 'Photos' : category === 'video_vault' ? 'Videos' : 'Music';
          const pathLabel = listPath ? `${catLabel}/${listPath}` : catLabel;
          return {
            success: true,
            message: `${pathLabel} — ${allNames.length} item${allNames.length === 1 ? '' : 's'} (full list)`,
            data: { type: 'file_list_all', allNames, category, path: listPath, totalCount: allNames.length },
          };
        }
        // Handle empty results
        if (allItems.length === 0) {
          const catLabel = category === 'general' ? 'Files' : category === 'media' ? 'Photos' : category === 'video_vault' ? 'Videos' : 'Music';
          const pathLabel = listPath ? `${catLabel}/${listPath}` : catLabel;
          return {
            success: true,
            message: `${pathLabel} is empty — no files or folders here yet.`,
            data: { type: 'file_list', items: [], category, path: listPath, totalCount: 0, remainingCount: 0, isEmpty: true },
          };
        }
        // Limit: 10 when filtered, 3 otherwise
        const limit = nameFilter ? 10 : 3;
        const displayItems = allItems.slice(0, limit);
        const totalCount = allItems.length;
        const remainingCount = totalCount - displayItems.length;
        const catLabel = category === 'general' ? 'Files' : category === 'media' ? 'Photos' : category === 'video_vault' ? 'Videos' : 'Music';
        const pathLabel = listPath ? `${catLabel}/${listPath}` : catLabel;
        return {
          success: true,
          message: `${pathLabel} — ${totalCount} item${totalCount === 1 ? '' : 's'}${remainingCount > 0 ? ` (showing ${displayItems.length})` : ''}`,
          data: { type: 'file_list', items: displayItems, category, path: listPath, totalCount, remainingCount },
        };
      }

      case 'list_trash': {
        const { listTrash } = await import('./trash.js');
        const trashItems = listTrash();
        if (trashItems.length === 0) {
          return { success: true, message: 'Trash is empty — nothing to clean up!', data: { type: 'trash_list', items: [] } };
        }
        const items = trashItems.map((t: any) => ({
          id: t.id,
          name: t.name,
          size: t.sizeHuman,
          category: t.category,
          trashedAt: t.trashedAt,
        }));
        return {
          success: true,
          message: `Found ${items.length} item${items.length === 1 ? '' : 's'} in trash.`,
          data: { type: 'trash_list', items },
        };
      }

      case 'empty_trash': {
        const { emptyTrash } = await import('./trash.js');
        const deletedCount = emptyTrash();
        return {
          success: true,
          message: deletedCount > 0
            ? `Trash cleaned up! Permanently deleted ${deletedCount} item${deletedCount === 1 ? '' : 's'}.`
            : 'Trash is already empty — nothing to clean up!',
        };
      }

      case 'restore_from_trash': {
        const { restoreFromTrash } = await import('./trash.js');
        restoreFromTrash(action.trashId);
        return { success: true, message: `Item restored from trash to its original location.` };
      }

      case 'delete_from_trash': {
        const { permanentlyDelete } = await import('./trash.js');
        permanentlyDelete(action.trashId);
        return { success: true, message: `Item permanently deleted from trash.` };
      }

      case 'delete_database': {
        const { deleteDatabase } = await import('./databases.js');
        const dbId = resolveDatabaseId(action.database || action.name);
        if (!dbId) return { success: false, message: `Database "${action.database || action.name}" not found.` };
        const dbName = action.database || action.name;
        await deleteDatabase(dbId);
        return {
          success: true,
          message: `Database "${dbName}" deleted successfully.`,
          data: { type: 'database_deleted', name: dbName },
        };
      }

      case 'create_database': {
        const { createDatabase } = await import('./databases.js');
        const result = await createDatabase(action.name, action.dbType || 'postgresql');
        return {
          success: true,
          message: `Database "${action.name}" created successfully.`,
          data: { type: 'database_created', id: result.id, name: result.name || result.displayName, dbType: result.type, status: result.status, size: result.size },
        };
      }

      case 'create_table': {
        const { createTable } = await import('./databases.js');
        const dbId = resolveDatabaseId(action.database);
        if (!dbId) return { success: false, message: `Database "${action.database}" not found.` };
        const normalizedTableName = (action.tableName || '').toLowerCase();
        await createTable(dbId, action.tableName, action.columns);
        return {
          success: true,
          message: `Table "${normalizedTableName}" created in database "${action.database}".`,
          data: { type: 'table_created', tableName: normalizedTableName, database: action.database },
        };
      }

      case 'show_image': {
        // Return the image URL so the frontend can render it inline
        const imgCategory = action.category || 'media';
        const imgPath = resolveFilePath(imgCategory, action.path || action.fileName);
        const imgUrl = `/api/files/serve?category=${imgCategory}&path=${encodeURIComponent(imgPath)}`;
        return {
          success: true,
          message: `Showing "${cleanFileName(action.fileName || imgPath)}"`,
          data: { type: 'image', url: imgUrl, fileName: action.fileName || imgPath },
        };
      }

      case 'show_file': {
        // Return file URL for non-image files (PDFs, books, documents)
        const fileCategory = action.category || 'general';
        const filePath = resolveFilePath(fileCategory, action.path || action.fileName);
        const fileUrl = `/api/files/serve?category=${fileCategory}&path=${encodeURIComponent(filePath)}`;
        const displayName = cleanFileName(action.fileName || filePath);
        return {
          success: true,
          message: `Showing "${displayName}"`,
          data: { type: 'file_preview', url: fileUrl, fileName: action.fileName || path.basename(filePath), category: fileCategory, path: filePath },
        };
      }

      case 'query': {
        const { executeQuery } = await import('./databases.js');
        const dbId = resolveDatabaseId(action.database);
        if (!dbId) return { success: false, message: `Database "${action.database}" not found.` };
        // SEC-SQL-007: Block destructive DDL from AI-generated SQL
        const trimmedSql = (action.sql || '').trim().toUpperCase();
        if (/^(DROP|ALTER|TRUNCATE|GRANT|REVOKE)/.test(trimmedSql)) {
          return { success: false, message: `Destructive SQL commands (${trimmedSql.split(/\s/)[0]}) are not allowed via AI. Please execute them manually in the Database view.` };
        }
        const result = await executeQuery(dbId, action.sql);
        return {
          success: true,
          message: `Query executed successfully.`,
          data: { type: 'query_result', ...result, sql: action.sql, database: action.database },
        };
      }

      case 'move_file': {
        const { moveFile } = await import('./files.js');
        const category = action.category || 'general';
        let sourcePath = (action.sourcePath || '').replace(/^\/+/, '').trim();
        const targetFolder = (action.targetFolder || '').replace(/^\/+/, '').trim();
        // Resolve cleaned file name to actual file on disk
        sourcePath = resolveFilePath(category, sourcePath);
        const fileName = path.basename(sourcePath);
        const targetPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
        if (sourcePath === targetPath) {
          return { success: true, message: `"${cleanFileName(fileName)}" is already in the right location.` };
        }
        moveFile(category, sourcePath, targetPath);
        // Verify the move actually succeeded
        const catMap: Record<string, string> = { general: 'files', media: 'photos', video_vault: 'videos', music: 'music' };
        const baseDir = path.join(getDataDir(), catMap[category] || 'files');
        const targetFull = path.join(baseDir, targetPath);
        const sourceFull = path.join(baseDir, sourcePath);
        if (!fs.existsSync(targetFull)) {
          return { success: false, message: `Move failed: "${cleanFileName(fileName)}" was not found at the target location after move.` };
        }
        if (fs.existsSync(sourceFull)) {
          return { success: false, message: `Move incomplete: "${cleanFileName(fileName)}" still exists at the source location.` };
        }
        const targetLabel = targetFolder || 'root';
        return { success: true, message: `Moved "${cleanFileName(fileName)}" to ${targetLabel}/ — verified.` };
      }

      case 'organize': {
        const { listDir, moveFile, mkdir } = await import('./files.js');
        const category = action.category || 'general';
        const entries = listDir(category, '.');
        
        // Classify root-level files by type
        const codeExts = ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.lua', '.r', '.sh', '.bash', '.zsh', '.sql', '.html', '.css', '.scss', '.vue', '.svelte', '.dart'];
        const dataExts = ['.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.env', '.csv', '.log', '.graphql'];
        const docExts = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.md', '.tex', '.epub', '.mobi'];
        const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.dmg', '.iso'];
        const spreadsheetExts = ['.xls', '.xlsx', '.ods', '.numbers'];

        const moves: { name: string; targetFolder: string }[] = [];
        // Build a case-insensitive folder lookup: lowercase → actual folder name on disk
        const folderMap: Record<string, string> = {};
        for (const e of entries) {
          if (e.isFolder) folderMap[e.name.toLowerCase()] = e.name;
        }

        /** Find existing folder by checking multiple possible names (case-insensitive) */
        function findFolder(...candidates: string[]): string | null {
          for (const c of candidates) {
            if (folderMap[c.toLowerCase()]) return folderMap[c.toLowerCase()];
          }
          return null;
        }

        for (const entry of entries) {
          if (entry.isFolder) continue;
          const ext = path.extname(entry.name).toLowerCase();
          let targetFolder = '';
          if (codeExts.includes(ext) || dataExts.includes(ext)) {
            targetFolder = findFolder('codes', 'code', 'scripts', 'src') || 'codes';
          } else if (docExts.includes(ext)) {
            targetFolder = findFolder('documents', 'document', 'docs', 'books', 'papers') || 'documents';
          } else if (archiveExts.includes(ext)) {
            targetFolder = findFolder('archives', 'archive', 'compressed') || 'archives';
          } else if (spreadsheetExts.includes(ext)) {
            targetFolder = findFolder('spreadsheets', 'sheets', 'data') || 'spreadsheets';
          }
          if (targetFolder) {
            moves.push({ name: entry.name, targetFolder });
          }
        }

        if (moves.length === 0) {
          return { success: true, message: 'Everything looks organized! No loose files need to be moved.', data: { type: 'organize_result', moved: [] } };
        }

        // Create folders that don't exist yet and move files
        const foldersCreated = new Set<string>();
        const movedFiles: string[] = [];
        const failedFiles: string[] = [];
        const catMapOrg: Record<string, string> = { general: 'files', media: 'photos', video_vault: 'videos', music: 'music' };
        const baseDirOrg = path.join(getDataDir(), catMapOrg[category] || 'files');
        for (const mv of moves) {
          if (!folderMap[mv.targetFolder.toLowerCase()] && !foldersCreated.has(mv.targetFolder)) {
            mkdir(category, mv.targetFolder);
            foldersCreated.add(mv.targetFolder);
          }
          try {
            moveFile(category, mv.name, `${mv.targetFolder}/${mv.name}`);
            // Verify the move
            const targetFull = path.join(baseDirOrg, mv.targetFolder, mv.name);
            if (fs.existsSync(targetFull)) {
              movedFiles.push(`${cleanFileName(mv.name)} → ${mv.targetFolder}/`);
            } else {
              failedFiles.push(cleanFileName(mv.name));
            }
          } catch {
            failedFiles.push(cleanFileName(mv.name));
          }
        }

        const catLabel = category === 'general' ? 'Files' : category === 'media' ? 'Photos' : category === 'video_vault' ? 'Videos' : 'Music';
        let organizeMsg = `Organized ${movedFiles.length} file${movedFiles.length === 1 ? '' : 's'} in ${catLabel} — verified.`;
        if (movedFiles.length > 0) {
          organizeMsg += `\n${movedFiles.map(m => `• ${m}`).join('\n')}`;
        }
        if (failedFiles.length > 0) {
          organizeMsg += `\n⚠️ Failed to move ${failedFiles.length} file(s): ${failedFiles.join(', ')}`;
        }
        return {
          success: failedFiles.length === 0,
          message: organizeMsg,
          data: { type: 'organize_result', moved: movedFiles, failed: failedFiles, foldersCreated: Array.from(foldersCreated) },
        };
      }

      case 'cast': {
        // Build the file URL from server origin
        const category = action.category || 'media';
        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const categoryDir = catMap[category] || 'photos';
        const filePath = action.path || action.fileName;
        const fileUrl = `http://192.168.5.0:3007/api/files/serve?category=${category}&path=${encodeURIComponent(filePath)}`;

        // Determine mime type
        const ext = (action.fileName || '').toLowerCase().split('.').pop() || '';
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
        const mimeType = imageExts.includes(ext) ? 'image/jpeg' : 'video/mp4';
        const fileType = imageExts.includes(ext) ? 'image' : 'video';

        const CAST_WEBHOOK = 'https://n8n.arcelliteserver.com/webhook/castc35483a5';
        const device = action.device || 'space_tv';

        try {
          const resp = await fetch(CAST_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: action.fileName,
              fileType,
              fileUrl,
              mimeType,
              device,
            }),
          });

          const deviceNames: Record<string, string> = {
            gaming_tv: 'GamingTV TV',
            smart_tv: 'SmartTV 4K',
            my_room: 'My Room Display',
            space_tv: 'Space TV',
          };
          const deviceLabel = deviceNames[device] || device;

          if (resp.ok) {
            return { success: true, message: `Casting "${action.fileName}" to ${deviceLabel}.` };
          } else {
            return { success: false, message: `Failed to cast to ${deviceLabel}. Device may be offline.` };
          }
        } catch (e) {
          return { success: false, message: `Cast failed: ${(e as Error).message}` };
        }
      }

      case 'send_email': {
        if (!userEmail) {
          return { success: false, message: 'No user email available. Please make sure you are logged in.' };
        }
        const emailCategory = action.category || 'general';
        const emailFilePath = resolveFilePath(emailCategory, action.path || action.fileName);
        const displayName = cleanFileName(action.fileName || emailFilePath);

        // Resolve the full absolute path on disk
        const catMap: Record<string, string> = { general: 'files', media: 'photos', video_vault: 'videos', music: 'music' };
        const categoryDir = catMap[emailCategory] || 'files';
        const absolutePath = path.join(getDataDir(), categoryDir, emailFilePath);

        if (!fs.existsSync(absolutePath)) {
          return { success: false, message: `File "${displayName}" not found on disk.` };
        }

        // Check file size (warn if >25MB)
        const stat = fs.statSync(absolutePath);
        const sizeMB = stat.size / (1024 * 1024);
        if (sizeMB > 25) {
          return {
            success: false,
            message: `File "${displayName}" is ${sizeMB.toFixed(1)} MB — too large for email attachment (max ~25 MB). Try downloading it directly instead.`,
          };
        }

        try {
          const { sendFileEmail } = await import('./services/email.service.js');
          await sendFileEmail(userEmail, absolutePath, displayName, action.message);
          const sizeStr = sizeMB < 1 ? `${(stat.size / 1024).toFixed(0)} KB` : `${sizeMB.toFixed(1)} MB`;
          return {
            success: true,
            message: `"${displayName}" sent to ${userEmail}.`,
            data: { type: 'email_sent', fileName: displayName, email: userEmail, size: sizeStr },
          };
        } catch (e) {
          return { success: false, message: `Failed to send email: ${(e as Error).message}` };
        }
      }

      case 'discord_send': {
        const channel = action.channel;
        const message = action.message;
        if (!channel || !message) {
          return { success: false, message: 'Discord send requires both "channel" and "message" fields.' };
        }

        // Look up the user's Discord send webhook URL from connected apps (with retry)
        let sendUrl: string | null = null;
        const MAX_URL_RETRIES = 2;
        for (let urlAttempt = 0; urlAttempt <= MAX_URL_RETRIES; urlAttempt++) {
          try {
            const { pool } = await import('./db/connection.js');
            let userId: number | null = null;
            if (userEmail) {
              const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
              if (userResult.rows.length > 0) userId = userResult.rows[0].id;
            }
            if (userId) {
              const result = await pool.query(
                `SELECT config FROM connected_apps WHERE user_id = $1 AND app_type = 'myapps_state' AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
                [userId]
              );
              if (result.rows.length > 0 && result.rows[0].config?.apps) {
                const apps = result.rows[0].config.apps;
                const discordApp = apps.find((a: any) => a.id === 'discord' && a.status === 'connected');
                if (discordApp?.discordWebhooks?.sendUrl) {
                  sendUrl = discordApp.discordWebhooks.sendUrl;
                }
              }
            }
            if (sendUrl) break; // Got it, stop retrying
            if (urlAttempt < MAX_URL_RETRIES) {
              console.warn(`[Discord] Webhook URL lookup attempt ${urlAttempt + 1} returned null, retrying in 1s...`);
              await new Promise(r => setTimeout(r, 1000));
            }
          } catch (dbErr) {
            console.error(`[Discord] DB lookup attempt ${urlAttempt + 1} failed:`, (dbErr as Error).message);
            if (urlAttempt < MAX_URL_RETRIES) {
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }

        if (!sendUrl) {
          return { success: false, message: 'Discord is not connected. Please connect Discord in My Apps first and provide the Send Message webhook URL.' };
        }

        // Send to Discord with retry for transient connection failures
        const MAX_SEND_RETRIES = 2;
        for (let sendAttempt = 0; sendAttempt <= MAX_SEND_RETRIES; sendAttempt++) {
          try {
            const payload: any = { channel, message };
            if (action.fileUrl) payload.fileUrl = action.fileUrl;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            let resp: Response;
            try {
              resp = await fetch(sendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeoutId);
            }

            if (!resp.ok) {
              const errorText = await resp.text().catch(() => '');
              // Retry on 5xx server errors
              if (resp.status >= 500 && sendAttempt < MAX_SEND_RETRIES) {
                console.warn(`[Discord] Send attempt ${sendAttempt + 1} got ${resp.status}, retrying in 2s...`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
              }
              return { success: false, message: `Discord send failed (${resp.status}): ${errorText || resp.statusText}` };
            }

            let respData: any = {};
            try {
              respData = await resp.json();
            } catch { /* empty response is ok */ }

            return {
              success: true,
              message: `Message sent to Discord #${channel}.`,
              data: {
                type: 'discord_sent',
                channel,
                message,
                messageId: respData.messageId,
                fileUrl: action.fileUrl,
              },
            };
          } catch (e) {
            // Retry on connection errors (not AbortError which means timeout)
            if ((e as Error).name !== 'AbortError' && sendAttempt < MAX_SEND_RETRIES) {
              console.warn(`[Discord] Send attempt ${sendAttempt + 1} failed (${(e as Error).message}), retrying in 2s...`);
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
            const errMsg = (e as Error).name === 'AbortError'
              ? 'Discord webhook timed out after 30 seconds. The webhook URL may be unreachable — check that your n8n/webhook server is running and accessible.'
              : `Discord webhook connection failed: ${(e as Error).message}. Check that your webhook server is running.`;
            return { success: false, message: errMsg };
          }
        }
        return { success: false, message: 'Discord send failed after multiple retries.' };
      }

      case 'create_automation_rule': {
        const { pool } = await import('./db/connection.js');
        const {
          name, description, trigger_type, trigger_config,
          action_type, action_config, is_active,
        } = action;
        if (!name || !trigger_type || !action_type) {
          return { success: false, message: 'Cannot create automation rule: name, trigger_type, and action_type are required.' };
        }
        const validTriggers = ['storage_threshold', 'cpu_threshold', 'file_upload', 'scheduled', 'database_query'];
        const validActions = ['email', 'discord', 'webhook', 'dashboard_alert'];
        if (!validTriggers.includes(trigger_type)) {
          return { success: false, message: `Unsupported trigger type: ${trigger_type}` };
        }
        if (!validActions.includes(action_type)) {
          return { success: false, message: `Unsupported action type: ${action_type}` };
        }
        // Resolve user_id from email
        const userRow = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [userEmail]);
        if (userRow.rows.length === 0) {
          return { success: false, message: 'Could not identify user to create automation rule.' };
        }
        const userId = userRow.rows[0].id;
        // Guard: reject if a rule with the same name already exists for this user
        const dupCheck = await pool.query(
          `SELECT id FROM automation_rules WHERE user_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [userId, name]
        );
        if (dupCheck.rows.length > 0) {
          return {
            success: false,
            message: `A rule named "${name}" already exists (ID ${dupCheck.rows[0].id}). Use update_automation_rule with rule_id ${dupCheck.rows[0].id} to modify it instead of creating a duplicate.`,
            data: { existing_rule_id: dupCheck.rows[0].id },
          };
        }
        await pool.query(
          `INSERT INTO automation_rules (user_id, name, description, is_active, trigger_type, trigger_config, action_type, action_config)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [userId, name, description ?? null, is_active ?? true,
           trigger_type, JSON.stringify(trigger_config ?? {}),
           action_type, JSON.stringify(action_config ?? {})]
        );
        const statusWord = (is_active ?? true) ? 'activated' : 'saved as draft';
        return {
          success: true,
          message: `Automation rule "${name}" created and ${statusWord}. You can manage it under **My Tasks** in the sidebar.`,
          data: { type: 'automation_rule_created', name, trigger_type, action_type, is_active: is_active ?? true },
        };
      }

      case 'list_automation_rules': {
        const { pool: rPool } = await import('./db/connection.js');
        const userRowR = await rPool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [userEmail]);
        if (userRowR.rows.length === 0) return { success: false, message: 'Could not identify user.' };
        const uId = userRowR.rows[0].id;
        const result = await rPool.query(
          `SELECT id, name, trigger_type, trigger_config, action_type, action_config, is_active, last_triggered, created_at
           FROM automation_rules WHERE user_id = $1 ORDER BY created_at DESC`,
          [uId]
        );
        if (result.rows.length === 0) {
          return { success: true, message: 'No automation rules found. You can create one with create_automation_rule.', data: { rules: [] } };
        }
        const summary = result.rows.map((r: any) =>
          `ID ${r.id}: "${r.name}" | trigger: ${r.trigger_type} | action: ${r.action_type} | active: ${r.is_active}`
        ).join('\n');
        return {
          success: true,
          message: `Found ${result.rows.length} automation rule(s):\n${summary}`,
          data: { rules: result.rows },
        };
      }

      case 'update_automation_rule': {
        const { pool: uPool } = await import('./db/connection.js');
        const { rule_id, name, description, trigger_type, trigger_config, action_type, action_config, is_active } = action;
        if (!rule_id) return { success: false, message: 'update_automation_rule requires rule_id.' };
        const userRowU = await uPool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [userEmail]);
        if (userRowU.rows.length === 0) return { success: false, message: 'Could not identify user.' };
        const uId = userRowU.rows[0].id;
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;
        if (name !== undefined)           { fields.push(`name = $${idx++}`);           values.push(name); }
        if (description !== undefined)    { fields.push(`description = $${idx++}`);    values.push(description); }
        if (trigger_type !== undefined)   { fields.push(`trigger_type = $${idx++}`);   values.push(trigger_type); }
        if (trigger_config !== undefined) { fields.push(`trigger_config = $${idx++}`); values.push(JSON.stringify(trigger_config)); }
        if (action_type !== undefined)    { fields.push(`action_type = $${idx++}`);    values.push(action_type); }
        if (action_config !== undefined)  { fields.push(`action_config = $${idx++}`);  values.push(JSON.stringify(action_config)); }
        if (is_active !== undefined)      { fields.push(`is_active = $${idx++}`);      values.push(is_active); }
        if (fields.length === 0) return { success: false, message: 'No fields provided to update.' };
        fields.push(`updated_at = NOW()`);
        values.push(uId, rule_id);
        const upResult = await uPool.query(
          `UPDATE automation_rules SET ${fields.join(', ')} WHERE user_id = $${idx++} AND id = $${idx} RETURNING name`,
          values
        );
        if (upResult.rowCount === 0) return { success: false, message: `Rule ID ${rule_id} not found.` };
        return {
          success: true,
          message: `Automation rule "${upResult.rows[0].name}" (ID ${rule_id}) updated successfully. Changes are live immediately.`,
          data: { type: 'automation_rule_updated', rule_id, updated_fields: fields.map(f => f.split(' = ')[0]) },
        };
      }

      case 'delete_automation_rule': {
        const { pool: dPool } = await import('./db/connection.js');
        const { rule_id } = action;
        if (!rule_id) return { success: false, message: 'delete_automation_rule requires rule_id.' };
        const userRowD = await dPool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [userEmail]);
        if (userRowD.rows.length === 0) return { success: false, message: 'Could not identify user.' };
        const uId = userRowD.rows[0].id;
        const delResult = await dPool.query(
          `DELETE FROM automation_rules WHERE id = $1 AND user_id = $2 RETURNING name`,
          [rule_id, uId]
        );
        if (delResult.rowCount === 0) return { success: false, message: `Rule ID ${rule_id} not found.` };
        return {
          success: true,
          message: `Automation rule "${delResult.rows[0].name}" (ID ${rule_id}) deleted.`,
          data: { type: 'automation_rule_deleted', rule_id },
        };
      }

      default:
        return { success: false, message: `Unknown action type: ${action.type}` };
    }
  } catch (e) {
    return { success: false, message: `Action failed: ${(e as Error).message}` };
  } finally {
    // Restore original storage path after family member action
    if (resolvedOverride) {
      (globalThis as any).__arcellite_storage_path = prevStoragePath;
    }
  }
}

// ─── Gemini Vision: Auto-Rename Images ──────────────────────────────

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Use Google Gemini Vision to analyze an image and suggest a descriptive filename.
 * Reads the image from disk, sends base64 to Gemini, returns a clean title.
 */
export async function analyzeImageForTitle(imagePath: string): Promise<{ ok: boolean; title?: string; error?: string }> {
  const apiKey = getApiKey('Google');
  if (!apiKey) {
    return { ok: false, error: 'No Google API key configured. Add your Gemini API key in Settings → API Keys.' };
  }

  // Read the image file (async to avoid blocking the event loop during batch operations)
  const absolutePath = imagePath.startsWith('/') ? imagePath : path.join(getDataDir(), imagePath);
  try {
    const stats = await fsp.stat(absolutePath);
    if (stats.size > 15 * 1024 * 1024) {
      return { ok: false, error: 'Image too large (>15MB). Skipping AI analysis.' };
    }
  } catch {
    return { ok: false, error: `Image file not found: ${imagePath}` };
  }

  const imageBuffer = await fsp.readFile(absolutePath);
  const base64Image = imageBuffer.toString('base64');

  // Determine MIME type from extension
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.tiff': 'image/tiff', '.tif': 'image/tiff', '.heic': 'image/heic',
    '.heif': 'image/heif', '.avif': 'image/avif',
  };
  const mimeType = mimeMap[ext] || 'image/jpeg';

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Image,
              }
            },
            {
              text: 'Look at this image and give it a short, descriptive filename (2-6 words). Return ONLY the filename without any extension, punctuation, or explanation. Use Title Case. Examples: Golden Gate Bridge Sunset, Family Beach Vacation, Cat Sleeping On Couch'
            }
          ]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 50,
          topP: 0.8,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: `Gemini API error (${response.status}): ${errorText}` };
    }

    const data = await response.json();
    const rawTitle = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawTitle) {
      return { ok: false, error: 'Gemini returned an empty response.' };
    }

    // Clean the title: remove quotes, periods, extensions, limit length
    let title = rawTitle
      .replace(/^["']|["']$/g, '')    // Remove wrapping quotes
      .replace(/\.\w{2,4}$/i, '')     // Remove file extension if included
      .replace(/[<>:"/\\|?*]/g, '')   // Remove filesystem-unsafe chars
      .replace(/\.+$/, '')            // Remove trailing dots
      .trim();

    // Limit to reasonable length
    if (title.length > 80) {
      title = title.substring(0, 80).trim();
    }

    if (!title) {
      return { ok: false, error: 'Could not extract a meaningful title from the AI response.' };
    }

    return { ok: true, title };
  } catch (e) {
    return { ok: false, error: `Gemini Vision request failed: ${(e as Error).message}` };
  }
}
