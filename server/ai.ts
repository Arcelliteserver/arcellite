/**
 * AI Chat backend: API key storage, DeepSeek proxy, and tool execution.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

let DATA_DIR = process.env.ARCELLITE_DATA || path.join(os.homedir(), 'arcellite-data');
if (DATA_DIR.startsWith('~/') || DATA_DIR === '~') {
  DATA_DIR = path.join(os.homedir(), DATA_DIR.slice(2));
}
const CONFIG_DIR = path.join(DATA_DIR, 'config');
const KEYS_FILE = path.join(CONFIG_DIR, 'api-keys.json');

// ─── API Key Storage ────────────────────────────────────────────────

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
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
  fs.writeFileSync(KEYS_FILE, JSON.stringify(merged, null, 2), 'utf8');
}

export function loadApiKeys(): Record<string, string> {
  if (!fs.existsSync(KEYS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
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
      // Map our IDs to Gemini API model names
      const map: Record<string, string> = {
        'gemini-3-pro': 'gemini-2.5-pro-preview-06-05',
        'gemini-3-flash': 'gemini-2.5-flash-preview-05-20',
        'gemini-2.5-pro': 'gemini-2.5-pro-preview-06-05',
        'gemini-2.5-flash': 'gemini-2.5-flash-preview-05-20',
        'gemini-2.5-flash-lite': 'gemini-2.5-flash-preview-05-20',
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
  'ollama-llama3': 'Ollama', 'ollama-mistral': 'Ollama', 'gpt-oss': 'Ollama', 'kimi-k2.5': 'Ollama',
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
  const baseDir = path.join(DATA_DIR, catMap[category] || 'files');
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
function getFilesystemContext(): string {
  const catMap: Record<string, string> = {
    general: 'files',
    media: 'photos',
    video_vault: 'videos',
    music: 'music',
  };

  const sections: string[] = [];

  for (const [category, dir] of Object.entries(catMap)) {
    const fullDir = path.join(DATA_DIR, dir);
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
  const sharedDir = path.join(DATA_DIR, 'shared');
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
    const metadataFile = path.join(DATA_DIR, 'databases', 'metadata.json');
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
            password: process.env.DB_PASSWORD || 'changeme',
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
 * Resolve a database reference (id or display name) to the actual metadata id.
 */
function resolveDatabaseId(ref: string): string | null {
  try {
    const metadataFile = path.join(DATA_DIR, 'databases', 'metadata.json');
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

function buildSystemPrompt(filesCtx: string, dbCtx: string, userEmail?: string): string {
  const emailCtx = userEmail ? `\nUSER EMAIL: ${userEmail}\n` : '';
  return `You are Arcellite — the personal AI assistant for the Arcellite file management system. You are helpful, concise, and conversational.
${emailCtx}
CAPABILITIES YOU CAN HELP WITH:
1. **File Management**: Create files, create folders, delete files/folders, rename items, move items to trash, list contents
2. **Database Management**: Create PostgreSQL databases, create tables, drop tables, run queries
3. **Media**: Help find photos, videos, music files. Help cast media to devices.
4. **Email**: Send files from the user's storage to their email as attachments.
5. **General Help**: Answer questions about the system, provide guidance

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

To delete/drop a database (use the display name):
\`\`\`action
{"type":"delete_database","database":"my_database"}
\`\`\`
When the user says "delete that db" or "drop that database" after creating one, use the name of the database from the conversation. You know what was just created — use that name directly. Do NOT use the file "delete" action for databases.

When the user asks to "create a database" without providing a specific name, ALWAYS ask them:
1. What the database name should be (suggest a snake_case name based on their project description)
2. What kind of data they want to store (so you can offer to create initial tables)
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

MULTI-STEP TASKS (CRITICAL):
- When the user asks for something that requires MULTIPLE sequential steps (e.g. "create a database with 3 tables and insert data"), you MUST emit action blocks for as many steps as you can in EACH response.
- For INDEPENDENT actions (that don't depend on each other's results), include ALL action blocks in a single response.
- For DEPENDENT actions (e.g. create tables AFTER creating a database), emit the first step(s). The system will execute them and send you the results. You will then receive a follow-up message with "[SYSTEM — ACTION RESULTS]" showing what succeeded or failed. When you receive this, CONTINUE with the next steps immediately — do NOT stop or ask the user for confirmation.
- After receiving action results, do NOT repeat actions that already succeeded. Only emit action blocks for the REMAINING steps.
- When ALL steps of the user's original request are complete, you MUST provide a clear completion message. Something like: "All done! Your social_network database is set up with users, followers, and posts tables, including foreign key constraints and a privacy column." Keep it to 1-2 sentences that confirm success and summarize what was built.
- NEVER stop after just one step if the user asked for multiple things. Always continue until the entire request is fulfilled.
- After the final step completes, ALWAYS end with a confident confirmation that everything is done. Never leave the conversation hanging without a wrap-up.

VERIFICATION (CRITICAL — DO NOT HALLUCINATE):
- NEVER assume an action worked. Each action returns a real result (✅ success or ❌ failure). Read the result CAREFULLY before saying anything succeeded.
- If a move_file or organize action result says "verified", it actually succeeded. If it says "failed" or the message contains an error, it DID NOT work — tell the user honestly and try again or suggest a fix.
- After completing a batch of moves (e.g. organizing books into subfolders), VERIFY your work: emit a list action on the target folder to confirm the files are actually there. Do NOT just say "Done!" without checking.
- When you receive "[SYSTEM — ACTION RESULTS]", READ every single result line. Count how many succeeded (✅) and how many failed (❌). Report the actual numbers: "Successfully moved 15 out of 20 files. 5 failed because..." — do NOT say "all done" if some failed.
- If a file move fails, it's usually because the file name doesn't match exactly. The system auto-resolves cleaned names, but if it still fails, the file may not exist at the path you specified. Check the filesystem context to use the EXACT file name.
- NEVER say you completed a task if the action results show failures. Be honest about what worked and what didn't.
- For large batch operations (moving many files), work through ALL the files systematically. Do NOT stop halfway. If the max actions per response is reached, continue in the next iteration until every file has been processed.

${filesCtx}

${dbCtx}`;
}

/**
 * Send a chat to the appropriate AI provider and return the response.
 * Automatically routes to the correct API based on the model ID.
 */
export async function chatWithAI(
  messages: ChatMessage[],
  model: string = 'deepseek-chat',
  userEmail?: string
): Promise<{ content: string; error?: string }> {
  const provider = getProviderForModel(model);
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    return { content: '', error: `No ${provider} API key configured. Go to Settings → API Keys to add your key.` };
  }

  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    return { content: '', error: `Provider "${provider}" is not yet supported for chat. Please use a supported model.` };
  }

  // Build context
  const filesCtx = getFilesystemContext();
  const dbCtx = await getDatabaseContext();
  const systemPrompt = buildSystemPrompt(filesCtx, dbCtx, userEmail);

  // Resolve the actual API model name
  const apiModel = config.resolveModel(model);

  // ─── Anthropic uses a different API format ─────────────────────
  if (provider === 'Anthropic') {
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI] ${provider} API error:`, response.status, errorText);
        return { content: '', error: `${provider} API error (${response.status}): ${errorText}` };
      }

      const data: any = await response.json();
      const content = data.content?.[0]?.text || '';
      return { content };
    } catch (e) {
      console.error('[AI] Chat error:', e);
      return { content: '', error: `Failed to connect to ${provider}: ${(e as Error).message}` };
    }
  }

  // ─── OpenAI-compatible providers (DeepSeek, OpenAI, Google, Grok, Qwen) ──
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: apiModel,
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] ${provider} API error:`, response.status, errorText);
      return { content: '', error: `${provider} API error (${response.status}): ${errorText}` };
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { content };
  } catch (e) {
    console.error('[AI] Chat error:', e);
    return { content: '', error: `Failed to connect to ${provider}: ${(e as Error).message}` };
  }
}

/**
 * Test the DeepSeek API connection with a simple ping.
 */
export async function testConnection(provider: string): Promise<{ ok: boolean; message: string }> {
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    return { ok: false, message: `No API key found for ${provider}. Please save your key first.` };
  }

  if (provider === 'DeepSeek') {
    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
          max_tokens: 10,
          stream: false,
        }),
      });

      if (response.ok) {
        return { ok: true, message: `Connected to DeepSeek successfully!` };
      } else {
        const errorText = await response.text();
        return { ok: false, message: `DeepSeek returned ${response.status}: ${errorText}` };
      }
    } catch (e) {
      return { ok: false, message: `Connection failed: ${(e as Error).message}` };
    }
  }

  // For other providers, just validate key format
  return { ok: true, message: `API key saved for ${provider}. Connection test not yet implemented for this provider.` };
}

// ─── Action Execution ───────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function executeAction(action: any, userEmail?: string): Promise<ActionResult> {
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
        const metadataFile = path.join(DATA_DIR, 'databases', 'metadata.json');
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
        const baseDir = path.join(DATA_DIR, catMap[category] || 'files');
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
        const baseDirOrg = path.join(DATA_DIR, catMapOrg[category] || 'files');
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
        const absolutePath = path.join(DATA_DIR, categoryDir, emailFilePath);

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

      default:
        return { success: false, message: `Unknown action type: ${action.type}` };
    }
  } catch (e) {
    return { success: false, message: `Action failed: ${(e as Error).message}` };
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
  const absolutePath = imagePath.startsWith('/') ? imagePath : path.join(DATA_DIR, imagePath);
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
