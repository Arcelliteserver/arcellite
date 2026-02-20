import type { IncomingMessage, ServerResponse } from 'http';

export function handleAppsRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  const path = url.split('?')[0];

  // ── n8n/MCP workflows API endpoint (bypasses CORS) ──
  if (url?.startsWith('/api/apps/n8n/workflows') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { apiUrl, apiKey, apiType } = JSON.parse(body);

        if (!apiUrl || !apiKey) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing apiUrl or apiKey' }));
          return;
        }

        // MCP uses a streaming protocol (SSE) — accept connection without HTTP verification
        if (apiType === 'mcp') {
          try {
            if (!apiUrl || !apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'MCP URL and Bearer token are required' }));
              return;
            }

            try {
              new URL(apiUrl);
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Invalid MCP URL format. Please use full URL like "https://your-domain.com/mcp-server/http"` }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ data: [], statusMessage: 'MCP server connection configured' }));
          } catch (e) {
            console.error('[MCP] Error:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String((e as Error).message) }));
          }
          return;
        }

        // For n8n servers, fetch workflows
        import('https').then((https) => {
          import('http').then((http) => {
            try {
              const baseUrl = new URL(apiUrl);
              const protocol = baseUrl.protocol === 'https:' ? https : http;

              let apiPath = '/api/v1/workflows';
              if (baseUrl.pathname && baseUrl.pathname !== '/') {
                const basePath = baseUrl.pathname.replace(/\/$/, '');
                apiPath = `${basePath}/api/v1/workflows`;
              }

              const port = baseUrl.port || (baseUrl.protocol === 'https:' ? 443 : 80);

              const options = {
                hostname: baseUrl.hostname,
                port: port,
                path: apiPath,
                method: 'GET',
                headers: {
                  'X-N8N-API-KEY': apiKey,
                  'Content-Type': 'application/json',
                },
                timeout: 10000,
              };

              const request = protocol.request(options, (n8nRes) => {
                let data = '';
                n8nRes.on('data', chunk => {
                  data += chunk;
                });
                n8nRes.on('end', () => {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = n8nRes.statusCode || 200;

                  if (n8nRes.statusCode === 401) {
                    console.error(`[n8n] 401 Unauthorized - Invalid API key or endpoint`);
                    res.end(JSON.stringify({ error: 'Unauthorized (401): Invalid API key or endpoint', statusCode: 401 }));
                  } else if (n8nRes.statusCode && n8nRes.statusCode >= 400) {
                    console.error(`[n8n] Error ${n8nRes.statusCode}: ${data}`);
                    res.end(data || JSON.stringify({ error: `HTTP ${n8nRes.statusCode}` }));
                  } else {
                    res.end(data);
                  }
                });
              });

              request.on('error', (err) => {
                console.error('[n8n] Request error:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `Connection error: ${(err as Error).message}` }));
              });

              request.on('timeout', () => {
                request.destroy();
                console.error('[n8n] Request timeout');
                res.statusCode = 504;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Request timeout - API server not responding' }));
              });

              request.end();
            } catch (parseErr) {
              console.error('[n8n] URL parse error:', parseErr);
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Invalid API URL format: ${(parseErr as Error).message}` }));
            }
          });
        }).catch((err) => {
          console.error('[n8n] Import error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String((err as Error).message) }));
        });
      } catch (e) {
        console.error('[n8n] Parse error:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // ── PostgreSQL/MySQL Database API — connect and list databases ──
  if ((path.startsWith('/api/apps/database/connect') || path.startsWith('/api/apps/database/databases')) && req.method === 'POST') {
    const chunks: Buffer[] = [];
    let bodySize = 0;
    const MAX_BODY = 1 * 1024 * 1024; // 1 MB
    req.on('data', (c: Buffer) => {
      bodySize += c.length;
      if (bodySize > MAX_BODY) { req.destroy(); res.statusCode = 413; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Request body too large' })); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const { type, host, port, username, password, database } = body;

        if (!type || !host || !port || !username) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing required credentials: type, host, port, username' }));
          return;
        }

        if (type === 'postgresql') {
          // Use postgres driver
          import('pg').then(({ Client }) => {
            const client = new Client({
              host,
              port: parseInt(port),
              user: username,
              password: password || undefined,
              database: database || 'postgres',
              connectionTimeoutMillis: 5000,
              statement_timeout: 5000,
            });

            client.connect()
              .then(() => {
                // Fetch list of databases
                if (url?.includes('/databases')) {
                  client.query('SELECT datname FROM pg_database WHERE datistemplate = false AND datname != \'postgres\' ORDER BY datname', (err, result) => {
                    client.end();
                    if (err) {
                      console.error('[Database] Query error:', err.message);
                      res.statusCode = 500;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ error: `Query failed: ${err.message}` }));
                    } else {
                      const databases = result.rows.map((r: any) => r.datname);
                      res.statusCode = 200;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ success: true, databases, type: 'postgresql' }));
                    }
                  });
                } else {
                  client.end();
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, message: 'Connected to PostgreSQL' }));
                }
              })
              .catch((err: Error) => {
                client.end().catch(() => {});
                console.error('[Database] Connection error:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `Connection failed: ${err.message}` }));
              });
          }).catch((err) => {
            console.error('[Database] pg driver not available:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'PostgreSQL driver not available. Install with: npm install pg' }));
          });
        } else if (type === 'mysql') {
          // Use mysql2 driver
          import('mysql2/promise').then(async (mysql) => {
            try {
              const connection = await mysql.createConnection({
                host,
                port: parseInt(port),
                user: username,
                password: password || undefined,
                database: database || undefined,
                connectTimeout: 5000,
              });

              if (url?.includes('/databases')) {
                const [rows] = await connection.execute('SHOW DATABASES');
                await connection.end();

                const databases = (rows as any[])
                  .map((r: any) => r.Database)
                  .filter((db: string) => !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db));

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, databases, type: 'mysql' }));
              } else {
                await connection.ping();
                await connection.end();

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, message: 'Connected to MySQL' }));
              }
            } catch (err: any) {
              console.error('[Database] MySQL error:', err.message);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Connection failed: ${err.message}` }));
            }
          }).catch((err) => {
            console.error('[Database] MySQL driver not available:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'MySQL driver not available. Install with: npm install mysql2' }));
          });
        } else {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unsupported database type' }));
        }
      } catch (e) {
        console.error('[Database] Parse error:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // ── Connected Apps: GET (load from DB) ──
  if (path === '/api/apps/connections' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    const sessionToken = authHeader.substring(7);
    import('../services/auth.service.js').then(async (authService) => {
      const user = await authService.validateSession(sessionToken);
      if (!user) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Invalid session' })); return; }
      const { pool } = await import('../db/connection.js');
      const result = await pool.query(
        `SELECT config FROM connected_apps WHERE user_id = $1 AND app_type = 'myapps_state' AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
        [user.id]
      );
      if (result.rows.length > 0 && result.rows[0].config) {
        res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result.rows[0].config));
      } else {
        res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ apps: null, connectedAppIds: null }));
      }
    }).catch(e => { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: String(e) })); });
    return true;
  }

  // ── Connected Apps: PUT (save to DB) ──
  if (path === '/api/apps/connections' && req.method === 'PUT') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Unauthorized' })); return true;
    }
    const sessionToken = authHeader.substring(7);
    const chunks: Buffer[] = [];
    let putBodySize = 0;
    const MAX_PUT_BODY = 1 * 1024 * 1024; // 1 MB
    req.on('data', (c: Buffer) => {
      putBodySize += c.length;
      if (putBodySize > MAX_PUT_BODY) { req.destroy(); res.statusCode = 413; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Request body too large' })); return; }
      chunks.push(c);
    });
    req.on('end', async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const authService = await import('../services/auth.service.js');
        const user = await authService.validateSession(sessionToken);
        if (!user) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Invalid session' })); return; }
        const { pool } = await import('../db/connection.js');
        // Atomic upsert — one row per user for the full myapps state
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_apps_user_myapps ON connected_apps (user_id, app_type) WHERE app_type = 'myapps_state'`).catch(() => {});
        await pool.query(
          `INSERT INTO connected_apps (user_id, app_type, app_name, config)
           VALUES ($1, 'myapps_state', 'My Apps State', $2)
           ON CONFLICT (user_id, app_type) WHERE app_type = 'myapps_state'
           DO UPDATE SET config = $2, updated_at = NOW()`,
          [user.id, JSON.stringify(body)]
        );
        res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true }));
      } catch (e) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: String(e) })); }
    });
    return true;
  }

  // ── Webhook Proxy: POST (connects to external webhooks server-side for CORS) ──
  if (path === '/api/apps/webhook-proxy' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        const { webhookUrl } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!webhookUrl) { res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Missing webhookUrl' })); return; }
        const parsedUrl = new URL(webhookUrl);

        // SSRF protection: block internal/private network addresses
        const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', 'metadata.google.internal', '169.254.169.254'];
        const hostname = parsedUrl.hostname.toLowerCase();
        if (blockedHostnames.includes(hostname) || hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
          res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Webhook URL targeting internal networks is not allowed' }));
          return;
        }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Only http and https protocols are allowed' }));
          return;
        }

        const https = await import('https');
        const http = await import('http');
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        };
        const MAX_PROXY_RESPONSE = 512 * 1024; // 512 KB
        const proxyReq = protocol.request(options, (proxyRes) => {
          let data = '';
          proxyRes.on('data', (chunk: string) => {
            if (data.length + chunk.length > MAX_PROXY_RESPONSE) {
              proxyRes.destroy();
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Webhook response too large' }));
              return;
            }
            data += chunk;
          });
          proxyRes.on('end', () => {
            res.statusCode = proxyRes.statusCode || 200;
            res.setHeader('Content-Type', 'application/json');
            if (!data || !data.trim()) {
              res.end(JSON.stringify({ success: true, files: [], message: 'Webhook reachable (empty response)' }));
            } else {
              try {
                JSON.parse(data);
                res.end(data);
              } catch {
                // Non-JSON response — wrap it
                res.end(JSON.stringify({ success: true, files: [], rawResponse: data.substring(0, 500) }));
              }
            }
          });
        });
        proxyReq.on('error', (err: Error) => { res.statusCode = 502; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `Webhook unreachable: ${err.message}` })); });
        proxyReq.on('timeout', () => { proxyReq.destroy(); res.statusCode = 504; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Webhook timeout' })); });
        proxyReq.end();
      } catch (e) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: String(e) })); }
    });
    return true;
  }

  return false;
}
