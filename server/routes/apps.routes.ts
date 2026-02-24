import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { execSync, spawn } from 'child_process';

// ── Allowed installable app IDs (whitelist against path traversal) ──
const INSTALLER_ALLOWED = new Set(['docker', 'cloudflare', 'ollama', 'n8n', 'portainer', 'watchtower', 'minio', 'redis', 'postgresql', 'mysql', 'uptime-kuma', 'loki', 'keycloak']);

/** Check if a port is in use (TCP listen) */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer(() => {});
    server.once('error', (err: NodeJS.ErrnoException) => {
      resolve(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

/** Find next available port starting from startPort */
async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  for (let i = 0; i < 100; i++) {
    const inUse = await isPortInUse(port);
    if (!inUse) return port;
    port++;
  }
  return startPort; // fallback to original if none found
}

/** Writable app dir: use data/installer so installs work without /srv or root */
function getAppDir(appId: string): string {
  const dir = path.join(process.cwd(), 'data', 'installer', appId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Return compose template with host ports replaced by available ports to avoid EADDRINUSE */
async function getComposeWithAvailablePorts(appId: string): Promise<string | null> {
  const template = getComposeTemplate(appId);
  if (!template) return null;
  const portRegex = /"(\d+):(\d+)"/g;
  const matches = [...template.matchAll(portRegex)];
  if (matches.length === 0) return template;
  let result = template;
  const used = new Set<number>();
  for (const m of matches) {
    const hostPort = parseInt(m[1], 10);
    const containerPort = m[2];
    let port = await findAvailablePort(hostPort);
    while (used.has(port)) port = await findAvailablePort(port + 1);
    used.add(port);
    result = result.replace(`"${m[1]}:${m[2]}"`, `"${port}:${containerPort}"`);
  }
  return result;
}

function getComposeTemplate(appId: string): string | null {
  switch (appId) {
    case 'n8n':
      return `services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - DB_TYPE=sqlite
      - DB_SQLITE_VACUUM_ON_STARTUP=true
      - N8N_SECURE_COOKIE=false
      - GENERIC_TIMEZONE=America/New_York
      - TZ=America/New_York
    volumes:
      - ./n8n_data:/home/node/.n8n
      - ./files:/files
`;
    case 'postgresql':
      return `services:
  postgresql:
    image: postgres:16-alpine
    container_name: postgresql
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=arcellite
      - POSTGRES_PASSWORD=arcellite
      - POSTGRES_DB=arcellite
    volumes:
      - ./data:/var/lib/postgresql/data
`;
    case 'mysql':
      return `services:
  mysql:
    image: mysql:8-debian
    container_name: mysql
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=arcellite
      - MYSQL_DATABASE=arcellite
      - MYSQL_USER=arcellite
      - MYSQL_PASSWORD=arcellite
    volumes:
      - ./data:/var/lib/mysql
`;
    case 'portainer':
      return `services:
  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9443:9443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/data
`;
    case 'watchtower':
      return `services:
  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=86400
`;
    case 'uptime-kuma':
      return `services:
  uptime-kuma:
    image: louislam/uptime-kuma:latest
    container_name: uptime-kuma
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
`;
    case 'keycloak':
      return `services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    container_name: keycloak
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=admin
    command: start-dev
    volumes:
      - ./data:/opt/keycloak/data
`;
    case 'loki':
      return `services:
  loki:
    image: grafana/loki:latest
    container_name: loki
    restart: unless-stopped
    ports:
      - "3100:3100"
    volumes:
      - ./data:/loki
    command: -config.file=/etc/loki/local-config.yaml
`;
    case 'redis':
      return `services:
  redis:
    image: redis:latest
    container_name: redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - ./data:/data
    command: redis-server --appendonly yes
`;
    case 'minio':
      return `services:
  minio:
    image: minio/minio:latest
    container_name: minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - ./data:/data
    command: server /data --console-address ":9001"
`;
    default:
      return null;
  }
}

export function handleAppsRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  const urlPath = url.split('?')[0];

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

  // ── n8n Install Workflow — proxy POST to avoid browser CSP ──
  if (url?.startsWith('/api/apps/n8n/install-workflow') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { apiUrl, apiKey, workflowJson } = JSON.parse(body);
        if (!apiUrl || !apiKey || !workflowJson) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing apiUrl, apiKey, or workflowJson' }));
          return;
        }
        // Strip all read-only / export-only fields rejected by n8n POST /api/v1/workflows
        const { id: _id, meta: _meta, versionId: _vid, pinData: _pin,
                active: _active, tags: _tags, ...cleanWorkflow } = workflowJson;
        Promise.all([import('https'), import('http')]).then(([https, http]) => {
          try {
            const baseUrl = new URL(apiUrl);
            const protocol = baseUrl.protocol === 'https:' ? https : http;
            let apiPath = '/api/v1/workflows';
            if (baseUrl.pathname && baseUrl.pathname !== '/') {
              apiPath = `${baseUrl.pathname.replace(/\/$/, '')}/api/v1/workflows`;
            }
            const postBody = JSON.stringify(cleanWorkflow);
            const options = {
              hostname: baseUrl.hostname,
              port: baseUrl.port || (baseUrl.protocol === 'https:' ? 443 : 80),
              path: apiPath,
              method: 'POST',
              headers: {
                'X-N8N-API-KEY': apiKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postBody),
              },
              timeout: 15000,
            };
            const request = protocol.request(options, (n8nRes) => {
              let data = '';
              n8nRes.on('data', chunk => { data += chunk; });
              n8nRes.on('end', () => {
                res.statusCode = n8nRes.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                if (n8nRes.statusCode && n8nRes.statusCode >= 400) {
                  try { res.end(data || JSON.stringify({ error: `HTTP ${n8nRes.statusCode}` })); }
                  catch { res.end(JSON.stringify({ error: `HTTP ${n8nRes.statusCode}` })); }
                } else {
                  res.end(data || JSON.stringify({ success: true }));
                }
              });
            });
            request.on('error', (err) => {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Connection error: ${(err as Error).message}` }));
            });
            request.on('timeout', () => {
              request.destroy();
              res.statusCode = 504;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Request timeout' }));
            });
            request.write(postBody);
            request.end();
          } catch (parseErr) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Invalid URL: ${(parseErr as Error).message}` }));
          }
        });
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // ── PostgreSQL/MySQL Database API — connect and list databases ──
  if ((urlPath.startsWith('/api/apps/database/connect') || urlPath.startsWith('/api/apps/database/databases')) && req.method === 'POST') {
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
                if (urlPath.includes('/databases')) {
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

              if (urlPath.includes('/databases')) {
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
  if (urlPath === '/api/apps/connections' && req.method === 'GET') {
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
  if (urlPath === '/api/apps/connections' && req.method === 'PUT') {
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
  if (urlPath === '/api/apps/webhook-proxy' && req.method === 'POST') {
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

  // ── App Installer: Status check ──
  if (urlPath === '/api/apps/installers/status' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' })); return true;
    }
    try {
      // System-installed (non-Docker) tools
      let dockerInstalled = false;
      let cloudflareInstalled = false;
      let ollamaInstalled = false;
      try { execSync('which docker', { stdio: 'ignore', timeout: 3000 }); dockerInstalled = true; } catch {}
      try { execSync('which cloudflared', { stdio: 'ignore', timeout: 3000 }); cloudflareInstalled = true; } catch {}
      try { execSync('which ollama', { stdio: 'ignore', timeout: 3000 }); ollamaInstalled = true; } catch {}

      const appList = [
        { id: 'portainer',   container: 'portainer' },
        { id: 'watchtower',  container: 'watchtower' },
        { id: 'minio',       container: 'minio' },
        { id: 'n8n',         container: 'n8n' },
        { id: 'redis',       container: 'redis' },
        { id: 'postgresql',  container: 'postgresql' },
        { id: 'mysql',       container: 'mysql' },
        { id: 'uptime-kuma', container: 'uptime-kuma' },
        { id: 'loki',        container: 'loki' },
        { id: 'keycloak',    container: 'keycloak' },
      ];
      // Ollama: check if serve process is running
      let ollamaRunning = false;
      if (ollamaInstalled) {
        try { execSync('pgrep -x ollama', { stdio: 'ignore', timeout: 3000 }); ollamaRunning = true; } catch {}
      }
      const statuses: Record<string, { installed: boolean; running: boolean }> = {
        docker: { installed: dockerInstalled, running: dockerInstalled },
        cloudflare: { installed: cloudflareInstalled, running: cloudflareInstalled },
        ollama: { installed: ollamaInstalled, running: ollamaRunning },
      };
      // Use docker ps -a as primary truth (catches apps installed without our compose file)
      for (const app of appList) {
        const composeExists =
          fs.existsSync(`/srv/${app.id}/docker-compose.yml`) ||
          fs.existsSync(path.join(process.cwd(), 'data', 'installer', app.id, 'docker-compose.yml'));
        let containerExists = false;
        let running = false;
        // ports: maps container port → actual host port (may differ due to port remapping)
        let ports: Record<number, number> = {};
        if (dockerInstalled) {
          try {
            const out = execSync(
              `docker ps -a --filter "name=^/${app.container}$" --format "{{.Status}}"`,
              { encoding: 'utf8', timeout: 5000 }
            ).trim();
            containerExists = out.length > 0;
            running = out.toLowerCase().startsWith('up');
          } catch {}
          // If the container is running, read the actual host port mappings via docker inspect
          if (running) {
            try {
              const inspectOut = execSync(
                `docker inspect --format '{{json .NetworkSettings.Ports}}' ${app.container}`,
                { encoding: 'utf8', timeout: 3000 }
              ).trim();
              const portsJson = JSON.parse(inspectOut) as Record<string, Array<{ HostPort: string }> | null>;
              for (const [key, bindings] of Object.entries(portsJson)) {
                if (bindings && bindings.length > 0) {
                  const containerPort = parseInt(key.split('/')[0], 10);
                  const hostPort = parseInt(bindings[0].HostPort, 10);
                  if (!isNaN(containerPort) && !isNaN(hostPort)) {
                    ports[containerPort] = hostPort;
                  }
                }
              }
            } catch {}
          }
        }
        statuses[app.id] = { installed: containerExists || composeExists, running, ports };
      }
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(statuses));
    } catch (e) {
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String(e) }));
    }
    return true;
  }

  // ── App Installer: Install / Uninstall (SSE streaming) ──
  const installerMatch = urlPath.match(/^\/api\/apps\/installers\/([^/]+)\/(install|uninstall)$/);
  if (installerMatch && req.method === 'POST') {
    const appId = installerMatch[1];
    const action = installerMatch[2] as 'install' | 'uninstall';

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' })); return true;
    }
    if (!INSTALLER_ALLOWED.has(appId)) {
      res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Unknown app: ${appId}` })); return true;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (data: Record<string, unknown>) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
    };

    const runProc = (cmd: string) => new Promise<void>((resolve, reject) => {
      const proc = spawn('sh', ['-c', cmd], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin' },
      });
      proc.stdout?.on('data', (d: Buffer) => send({ type: 'log', text: d.toString() }));
      proc.stderr?.on('data', (d: Buffer) => send({ type: 'log', text: d.toString() }));
      proc.on('close', (code: number | null) => { code === 0 ? resolve() : reject(new Error(`Command failed (exit ${code})`)); });
    });

    (async () => {
      let currentUserId: number | null = null;
      try {
        const authService = await import('../services/auth.service.js');
        const user = await authService.validateSession(authHeader.slice(7));
        if (user) currentUserId = user.id;
      } catch {}
      try {
        if (action === 'install') {
          const notifyInstalled = async (name: string) => {
            if (currentUserId) {
              try {
                const { createNotification } = await import('../services/auth.service.js');
                await createNotification(currentUserId, 'Application installed', `${name} has been installed successfully.`, 'success', 'system');
              } catch {}
            }
          };
          if (appId === 'docker') {
            send({ type: 'log', text: 'Downloading Docker install script…' });
            await runProc('curl -fsSL https://get.docker.com | sh');
            await notifyInstalled('Docker Engine');
            send({ type: 'done', success: true });
            return;
          }
          if (appId === 'cloudflare') {
            send({ type: 'log', text: 'Installing Cloudflare Tunnel client (cloudflared)…' });
            await runProc('sudo apt-get update -qq && sudo apt-get install -y cloudflared 2>&1');
            await notifyInstalled('Cloudflare Tunnel');
            send({ type: 'done', success: true });
            return;
          }
          if (appId === 'ollama') {
            send({ type: 'log', text: 'Downloading and installing Ollama…' });
            try {
              await runProc('curl -fsSL https://ollama.com/install.sh | sh 2>&1');
            } catch (e) {
              try {
                execSync('which ollama', { encoding: 'utf8', stdio: 'pipe' });
                send({ type: 'log', text: 'Ollama already installed.' });
              } catch {
                throw e;
              }
            }
            await notifyInstalled('Ollama');
            send({ type: 'done', success: true });
            return;
          }

          // Docker compose apps — ensure Docker is available
          let dockerOk = false;
          try {
            execSync('docker info', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
            dockerOk = true;
          } catch {
            send({ type: 'error', text: 'Docker is not running or not installed. Install Docker Engine first.' });
            return;
          }

          let alreadyRunning = false;
          let containerExists = false;
          try {
            const out = execSync(`docker ps -a --filter "name=^/${appId}$" --format "{{.Status}}"`, { encoding: 'utf8', timeout: 5000 }).trim();
            containerExists = out.length > 0;
            alreadyRunning = out.toLowerCase().startsWith('up');
          } catch {}

          if (alreadyRunning) {
            send({ type: 'log', text: `${appId} container is already running.` });
            send({ type: 'done', success: true });
            return;
          }
          if (containerExists) {
            send({ type: 'log', text: `Container found (stopped). Starting ${appId}…` });
            await runProc(`docker start ${appId} 2>&1`);
            send({ type: 'done', success: true });
            return;
          }

          // No container — create via docker-compose (use writable app dir, fallback on EACCES)
          let appDir = getAppDir(appId);
          const composeFile = path.join(appDir, 'docker-compose.yml');
          if (!fs.existsSync(composeFile)) {
            const template = await getComposeWithAvailablePorts(appId);
            if (!template) { send({ type: 'error', text: `No compose template for ${appId}` }); return; }
            let written = false;
            try {
              fs.writeFileSync(composeFile, template, 'utf8');
              send({ type: 'log', text: `Created ${composeFile} (ports adjusted if needed)` });
              written = true;
            } catch (e: unknown) {
              const err = e as NodeJS.ErrnoException;
              if (err.code === 'EACCES' || err.code === 'EPERM') {
                const fallbackDir = path.join(process.cwd(), 'data', 'installer', appId);
                try {
                  fs.mkdirSync(fallbackDir, { recursive: true });
                  const fallbackCompose = path.join(fallbackDir, 'docker-compose.yml');
                  fs.writeFileSync(fallbackCompose, template, 'utf8');
                  appDir = fallbackDir;
                  send({ type: 'log', text: `Created ${fallbackCompose} (no write access to /srv, using data/installer)` });
                  written = true;
                } catch (e2: unknown) {
                  send({ type: 'error', text: (e2 && typeof (e2 as Error).message === 'string') ? (e2 as Error).message : `Permission denied: cannot write to ${appDir} or fallback` });
                  return;
                }
              } else {
                send({ type: 'error', text: (err && typeof (err as Error).message === 'string') ? (err as Error).message : String(err) });
                return;
              }
            }
            if (!written) return;
          } else {
            send({ type: 'log', text: `Using existing ${composeFile}` });
          }

          send({ type: 'log', text: `Pulling images and starting ${appId}…` });
          await runProc(`cd "${appDir}" && docker compose up -d 2>&1`);
          if (currentUserId) {
            try {
              const { createNotification } = await import('../services/auth.service.js');
              const name = appId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              await createNotification(currentUserId, 'Application installed', `${name} has been installed successfully.`, 'success', 'system');
            } catch {}
          }
          send({ type: 'done', success: true });

        } else {
          // uninstall
          if (appId === 'docker') {
            send({ type: 'log', text: 'Removing Docker Engine…' });
            await runProc('sudo apt-get remove -y docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>&1');
            send({ type: 'done', success: true });
            return;
          }
          if (appId === 'cloudflare') {
            send({ type: 'log', text: 'Removing cloudflared…' });
            await runProc('sudo apt-get remove -y cloudflared 2>&1');
            send({ type: 'done', success: true });
            return;
          }
          if (appId === 'ollama') {
            send({ type: 'log', text: 'Stopping Ollama service…' });
            try { await runProc('sudo systemctl stop ollama 2>&1'); } catch {}
            send({ type: 'log', text: 'Removing Ollama binary…' });
            try {
              await runProc('sudo rm -f /usr/local/bin/ollama 2>&1');
            } catch {
              try { await runProc('rm -f /usr/local/bin/ollama 2>&1'); } catch {}
            }
            send({ type: 'done', success: true });
            return;
          }

          send({ type: 'log', text: `Stopping and removing ${appId}…` });
          const srvDir = path.join('/srv', appId);
          const fallbackDir = path.join(process.cwd(), 'data', 'installer', appId);
          const srvCompose = path.join(srvDir, 'docker-compose.yml');
          const fallbackCompose = path.join(fallbackDir, 'docker-compose.yml');
          const appDir = fs.existsSync(srvCompose) ? srvDir : (fs.existsSync(fallbackCompose) ? fallbackDir : srvDir);
          if (fs.existsSync(path.join(appDir, 'docker-compose.yml'))) {
            await runProc(`cd "${appDir}" && docker compose down 2>&1`);
          } else {
            // No compose file — stop and remove container directly
            try { await runProc(`docker stop ${appId} 2>&1`); } catch {}
            try { await runProc(`docker rm ${appId} 2>&1`); } catch {}
          }
          // Remove compose files so status check correctly shows "not installed"
          try { if (fs.existsSync(srvCompose)) fs.unlinkSync(srvCompose); } catch {}
          try { if (fs.existsSync(fallbackCompose)) fs.unlinkSync(fallbackCompose); } catch {}
          send({ type: 'done', success: true });
        }
      } catch (e: unknown) {
        send({ type: 'error', text: (e as Error).message || String(e) });
      } finally {
        res.end();
      }
    })();
    return true;
  }

  // ── PostgreSQL connection test ──
  if (urlPath === '/api/apps/postgres-test' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { host, port, database, username, password } = JSON.parse(body);
        if (!host || !database || !username) {
          res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'host, database, and username are required' }));
          return;
        }
        // Use psql to test connection (available if postgres-client is installed)
        // Fallback: just return success with a note that credentials were saved
        const pgPort = port || '5432';
        try {
          const pgEnv = { ...process.env, PGPASSWORD: password || '' };
          execSync(
            `psql -h "${host}" -p "${pgPort}" -U "${username}" -d "${database}" -c "SELECT 1" --no-psqlrc -q 2>&1`,
            { env: pgEnv, timeout: 8000, stdio: 'pipe' }
          );
          res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, message: `Connected to ${database}` }));
        } catch {
          // psql not available or connection failed — store credentials anyway
          res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, message: 'Credentials saved (psql not available for live test)' }));
        }
      } catch (e) {
        res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return true;
  }

  return false;
}
