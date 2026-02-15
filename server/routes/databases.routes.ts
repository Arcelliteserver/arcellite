import type { IncomingMessage, ServerResponse } from 'http';
import pg from 'pg';

const { Pool: PgPool } = pg;

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

export function handleDatabaseRoutes(req: IncomingMessage, res: ServerResponse, url: string) {
  // List databases (includes system AI chat DB)
  if (url === '/api/databases/list' && req.method === 'GET') {
    import('../databases.js').then(async ({ listDatabases, refreshDatabaseSizes }) => {
      try {
        const databases = await refreshDatabaseSizes();

        // Inject the system AI Chat History database
        try {
          const rawHost = process.env.DB_HOST || 'localhost';
          const chatPool = new PgPool({
            host: rawHost.startsWith('/') ? 'localhost' : rawHost,
            port: parseInt(process.env.DB_PORT || '5432'),
            database: 'cloudnest_chat_history',
            user: process.env.DB_USER || 'arcellite_user',
            password: process.env.DB_PASSWORD || 'changeme',
            max: 2,
            connectionTimeoutMillis: 3000,
          });
          try {
            const sizeResult = await chatPool.query('SELECT pg_database_size(current_database()) as size');
            const sizeBytes = parseInt(sizeResult.rows[0]?.size || '0', 10);
            const formatBytes = (bytes: number) => {
              if (bytes === 0) return '0 B';
              const k = 1024;
              const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
            };
            databases.unshift({
              id: '__system_chat_history',
              name: 'Arcellite',
              displayName: 'Arcellite',
              type: 'postgresql',
              status: 'running',
              size: formatBytes(sizeBytes),
              sizeBytes,
              created: new Date().toISOString(),
              createdTimestamp: Date.now(),
              pgDatabaseName: 'cloudnest_chat_history',
              isSystem: true,
              config: {
                host: rawHost.startsWith('/') ? 'localhost' : rawHost,
                port: parseInt(process.env.DB_PORT || '5432'),
                username: process.env.DB_USER || 'arcellite_user',
                password: process.env.DB_PASSWORD || 'changeme',
                database: 'cloudnest_chat_history',
              },
            });
          } catch { /* chat DB might not exist yet */ } finally {
            await chatPool.end();
          }
        } catch { /* non-fatal */ }

        sendJson(res, { ok: true, databases });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Get single database details
  if (url.startsWith('/api/databases/get?') && req.method === 'GET') {
    const params = new URL(url, 'http://localhost').searchParams;
    const id = params.get('id');
    if (!id) { sendError(res, 'Missing id', 400); return true; }

    import('../databases.js').then(async ({ getDatabase }) => {
      try {
        const db = await getDatabase(id);
        if (!db) { sendError(res, 'Database not found', 404); return; }
        sendJson(res, { ok: true, database: db });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Create database
  if (url === '/api/databases/create' && req.method === 'POST') {
    parseBody(req).then((body) => {
      import('../databases.js').then(async ({ createDatabase }) => {
        try {
          const { name, type } = body;
          if (!name || !type) { sendError(res, 'Missing name or type', 400); return; }
          const database = await createDatabase(name, type);
          sendJson(res, { ok: true, database });
        } catch (e) {
          sendError(res, String((e as Error).message));
        }
      }).catch((e) => sendError(res, String((e as Error).message)));
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Delete database
  if (url === '/api/databases/delete' && req.method === 'POST') {
    parseBody(req).then((body) => {
      import('../databases.js').then(async ({ deleteDatabase }) => {
        try {
          if (!body.id) { sendError(res, 'Missing id', 400); return; }
          await deleteDatabase(body.id);
          sendJson(res, { ok: true });
        } catch (e) {
          sendError(res, String((e as Error).message));
        }
      }).catch((e) => sendError(res, String((e as Error).message)));
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Start database
  if (url === '/api/databases/start' && req.method === 'POST') {
    parseBody(req).then((body) => {
      import('../databases.js').then(({ startDatabase }) => {
        try {
          if (!body.id) { sendError(res, 'Missing id', 400); return; }
          const database = startDatabase(body.id);
          sendJson(res, { ok: true, database });
        } catch (e) {
          sendError(res, String((e as Error).message));
        }
      }).catch((e) => sendError(res, String((e as Error).message)));
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Stop database
  if (url === '/api/databases/stop' && req.method === 'POST') {
    parseBody(req).then((body) => {
      import('../databases.js').then(({ stopDatabase }) => {
        try {
          if (!body.id) { sendError(res, 'Missing id', 400); return; }
          const database = stopDatabase(body.id);
          sendJson(res, { ok: true, database });
        } catch (e) {
          sendError(res, String((e as Error).message));
        }
      }).catch((e) => sendError(res, String((e as Error).message)));
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // List tables
  if (url.startsWith('/api/databases/tables?') && req.method === 'GET') {
    const params = new URL(url, 'http://localhost').searchParams;
    const id = params.get('id');
    if (!id) { sendError(res, 'Missing id', 400); return true; }

    import('../databases.js').then(async ({ listTables }) => {
      try {
        const tables = await listTables(id);
        sendJson(res, { ok: true, tables });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Get table columns
  if (url.startsWith('/api/databases/columns?') && req.method === 'GET') {
    const params = new URL(url, 'http://localhost').searchParams;
    const id = params.get('id');
    const table = params.get('table');
    if (!id || !table) { sendError(res, 'Missing id or table', 400); return true; }

    import('../databases.js').then(async ({ getTableColumns }) => {
      try {
        const columns = await getTableColumns(id, table);
        sendJson(res, { ok: true, columns });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Get table data
  if (url.startsWith('/api/databases/data?') && req.method === 'GET') {
    const params = new URL(url, 'http://localhost').searchParams;
    const id = params.get('id');
    const table = params.get('table');
    const limit = parseInt(params.get('limit') || '100', 10);
    const offset = parseInt(params.get('offset') || '0', 10);
    if (!id || !table) { sendError(res, 'Missing id or table', 400); return true; }

    import('../databases.js').then(async ({ getTableData }) => {
      try {
        const data = await getTableData(id, table, limit, offset);
        sendJson(res, { ok: true, ...data });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Create table
  if (url === '/api/databases/create-table' && req.method === 'POST') {
    parseBody(req).then((body) => {
      import('../databases.js').then(async ({ createTable }) => {
        try {
          const { id, tableName, columns } = body;
          if (!id || !tableName || !columns) { sendError(res, 'Missing id, tableName, or columns', 400); return; }
          await createTable(id, tableName, columns);
          sendJson(res, { ok: true });
        } catch (e) {
          sendError(res, String((e as Error).message));
        }
      }).catch((e) => sendError(res, String((e as Error).message)));
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Drop table
  if (url === '/api/databases/drop-table' && req.method === 'POST') {
    parseBody(req).then((body) => {
      import('../databases.js').then(async ({ dropTable }) => {
        try {
          const { id, tableName } = body;
          if (!id || !tableName) { sendError(res, 'Missing id or tableName', 400); return; }
          await dropTable(id, tableName);
          sendJson(res, { ok: true });
        } catch (e) {
          sendError(res, String((e as Error).message));
        }
      }).catch((e) => sendError(res, String((e as Error).message)));
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Execute SQL query
  if (url === '/api/databases/query' && req.method === 'POST') {
    parseBody(req).then((body) => {
      import('../databases.js').then(async ({ executeQuery }) => {
        try {
          const { id, sql } = body;
          if (!id || !sql) { sendError(res, 'Missing id or sql', 400); return; }
          const result = await executeQuery(id, sql);
          sendJson(res, { ok: true, ...result });
        } catch (e) {
          sendError(res, String((e as Error).message));
        }
      }).catch((e) => sendError(res, String((e as Error).message)));
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  // Purge all databases (Danger Zone)
  if (url === '/api/databases/purge-all' && req.method === 'POST') {
    import('../databases.js').then(async ({ purgeAllDatabases }) => {
      try {
        const result = await purgeAllDatabases();
        sendJson(res, { ok: true, ...result });
      } catch (e) {
        sendError(res, String((e as Error).message));
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  return false;
}