import type { IncomingMessage, ServerResponse } from 'http';
import os from 'os';
import nodePath from 'path';
import fs from 'fs';
import dgram from 'dgram';
import { exec, execSync as cpExecSync } from 'child_process';
import bcrypt from 'bcrypt';
import * as authService from '../services/auth.service.js';
import { pool } from '../db/connection.js';

/**
 * Read and JSON-parse the request body.
 * Uses synchronous pull (req.read()) first so it works even if the body
 * data events fired before the route handler had a chance to attach listeners.
 */
function parseBody(req: IncomingMessage): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    // Try synchronous pull first — reads any data already buffered in the stream
    try {
      let chunk: Buffer | null;
      while ((chunk = req.read() as Buffer | null) !== null) {
        chunks.push(chunk);
      }
    } catch { /* stream may not support read() */ }

    if (chunks.length > 0) {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { resolve({}); }
      return;
    }

    // No buffered data yet — fall back to event-based reading
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { resolve({}); }
    });
    // If stream already ended before we attached listeners, resolve immediately
    if ((req as any).readableEnded) resolve({});
  });
}

/** Resolve the storage base directory for the current request's user.
 *  Falls back to the global path for unauthenticated or owner requests. */
async function resolveUserBaseDir(req: IncomingMessage): Promise<string> {
  let storagePath = (req as any).user?.storagePath as string | undefined;
  if (!storagePath || storagePath === 'pending') {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const user = await authService.validateSession(authHeader.substring(7));
        if (user?.storagePath) {
          (req as any).user = user;
          storagePath = user.storagePath;
        }
      }
    } catch { /* fall through */ }
  }
  if (storagePath && storagePath !== 'pending') {
    if (storagePath.startsWith('~/') || storagePath === '~') {
      return nodePath.join(os.homedir(), storagePath.slice(storagePath === '~' ? 1 : 2));
    }
    return storagePath;
  }
  // Global fallback
  const { getBaseDir } = await import('../files.js');
  return getBaseDir();
}

/** Calculate total bytes used in a directory tree (recursive) */
function calcDirSize(dir: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += calcDirSize(full);
      } else if (entry.isFile()) {
        try { total += fs.statSync(full).size; } catch {}
      }
    }
  } catch {}
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ── SSDP: discover UPnP/DLNA devices on the LAN ──
function ssdpDiscover(): Promise<Array<{ location: string; server?: string }>> {
  return new Promise((resolve) => {
    const devices: Array<{ location: string; server?: string }> = [];
    const seen = new Set<string>();
    const socket = dgram.createSocket('udp4');
    const SSDP_ADDR = '239.255.255.250';
    const SSDP_PORT = 1900;
    const msg = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      'HOST: 239.255.255.250:1900\r\n' +
      'MAN: "ssdp:discover"\r\n' +
      'MX: 3\r\n' +
      'ST: ssdp:all\r\n\r\n'
    );
    const timeout = setTimeout(() => {
      try { socket.close(); } catch {}
      resolve(devices);
    }, 6000);
    socket.on('message', (data) => {
      const text = data.toString();
      const locationMatch = text.match(/LOCATION:\s*(\S+)/i);
      const serverMatch = text.match(/SERVER:\s*(.+)/i);
      if (locationMatch) {
        const loc = locationMatch[1].trim();
        if (!seen.has(loc)) {
          seen.add(loc);
          devices.push({ location: loc, server: serverMatch?.[1]?.trim() });
        }
      }
    });
    socket.on('error', () => {
      try { socket.close(); } catch {}
      clearTimeout(timeout);
      resolve(devices);
    });
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(msg, 0, msg.length, SSDP_PORT, SSDP_ADDR);
    });
  });
}

// ── Fetch UPnP device XML to get friendly name and control URL ──
async function fetchUpnpInfo(location: string): Promise<{ friendlyName?: string; manufacturer?: string; controlUrl?: string }> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(location, { signal: controller.signal });
    clearTimeout(id);
    const xml = await resp.text();
    const friendlyName = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/)?.[1];
    const manufacturer = xml.match(/<manufacturer>([^<]+)<\/manufacturer>/)?.[1];
    const avCtrl = xml.match(/<serviceType>urn:schemas-upnp-org:service:AVTransport[^<]*<\/serviceType>[\s\S]*?<controlURL>([^<]+)<\/controlURL>/)?.[1];
    const base = new URL(location).origin;
    return {
      friendlyName,
      manufacturer,
      controlUrl: avCtrl ? (avCtrl.startsWith('/') ? base + avCtrl : avCtrl) : undefined,
    };
  } catch {
    return {};
  }
}

// ── Combine SSDP + avahi-browse into a unified device list ──
async function discoverCastDevices(): Promise<Array<{ id: string; name: string; type: string; controlUrl?: string }>> {
  const results: Array<{ id: string; name: string; type: string; controlUrl?: string }> = [];
  const seen = new Set<string>();

  // SSDP scan
  const ssdpDevices = await ssdpDiscover();
  const upnpInfos = await Promise.allSettled(ssdpDevices.map(d => fetchUpnpInfo(d.location)));
  for (let i = 0; i < ssdpDevices.length; i++) {
    const info = upnpInfos[i].status === 'fulfilled' ? (upnpInfos[i] as PromiseFulfilledResult<{ friendlyName?: string; manufacturer?: string; controlUrl?: string }>).value : {};
    const name = info.friendlyName || ssdpDevices[i].server?.split('/')[0] || `Device ${i + 1}`;
    const mfr = (info.manufacturer || '').toLowerCase();
    const type = mfr.includes('google') ? 'Chromecast' :
                 mfr.includes('samsung') ? 'Samsung TV' :
                 mfr.includes('lg') ? 'LG TV' :
                 mfr.includes('sony') ? 'Sony TV' : 'DLNA Device';
    const key = info.controlUrl || name;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ id: `ssdp-${i}`, name, type, controlUrl: info.controlUrl });
    }
  }

  // avahi-browse for Chromecast / mDNS devices
  try {
    const avahiOut = cpExecSync('avahi-browse -t -r _googlecast._tcp 2>/dev/null || true', { timeout: 5000, encoding: 'utf8' });
    for (const line of avahiOut.split('\n')) {
      const m = line.match(/[+=]\s+\S+\s+IPv\d\s+(.+?)\s+_googlecast/);
      if (m) {
        const name = m[1].trim();
        if (!seen.has(name)) {
          seen.add(name);
          results.push({ id: `cast-${results.length}`, name, type: 'Chromecast' });
        }
      }
    }
  } catch { /* avahi not installed — skip */ }

  // ARP table scan: probe port 8009 on every known LAN host (Chromecast API port)
  try {
    const arpContent = fs.readFileSync('/proc/net/arp', 'utf8');
    const lanHosts = arpContent.split('\n').slice(1)
      .map(line => line.split(/\s+/)[0])
      .filter(ip => ip && ip !== '0.0.0.0' && !/^0\./.test(ip));
    const chromecastProbes = lanHosts.map(async (ip) => {
      try {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), 1200);
        const resp = await fetch(`http://${ip}:8009/setup/eureka_info?options=detail`, { signal: ctrl.signal });
        clearTimeout(id);
        if (!resp.ok) return;
        const data = await resp.json() as { name?: string; device_info?: { product_name?: string; manufacturer?: string } };
        const name = data.name || `Chromecast (${ip})`;
        const type = data.device_info?.product_name || 'Chromecast';
        if (!seen.has(name)) {
          seen.add(name);
          results.push({ id: `cc-${ip}`, name, type, controlUrl: undefined });
        }
      } catch { /* host doesn't have port 8009 — not a Chromecast */ }
    });
    await Promise.allSettled(chromecastProbes);
  } catch { /* /proc/net/arp not available */ }

  return results;
}

// ── Direct DLNA/UPnP cast via SOAP (SetAVTransportURI + Play) ──
async function dlnaCast(controlUrl: string, mediaUrl: string, mimeType: string, title: string): Promise<void> {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const setUriSoap = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><CurrentURI>${esc(mediaUrl)}</CurrentURI><CurrentURIMetaData>&lt;DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"&gt;&lt;item id="0" parentID="-1" restricted="1"&gt;&lt;dc:title&gt;${esc(title)}&lt;/dc:title&gt;&lt;res protocolInfo="http-get:*:${mimeType}:*"&gt;${esc(mediaUrl)}&lt;/res&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;</CurrentURIMetaData></u:SetAVTransportURI></s:Body></s:Envelope>`;
  const playSoap = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play></s:Body></s:Envelope>`;

  const ctrl1 = new AbortController();
  const id1 = setTimeout(() => ctrl1.abort(), 8000);
  await fetch(controlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"' },
    body: setUriSoap,
    signal: ctrl1.signal,
  });
  clearTimeout(id1);

  const ctrl2 = new AbortController();
  const id2 = setTimeout(() => ctrl2.abort(), 8000);
  await fetch(controlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#Play"' },
    body: playSoap,
    signal: ctrl2.signal,
  });
  clearTimeout(id2);
}

export function handleSystemRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  const path = url.split('?')[0];

  // ── File search across all categories ──
  if (path === '/api/files/search' && req.method === 'GET') {
    try {
      Promise.all([resolveUserBaseDir(req), import('fs'), import('path')]).then(([base, fsNode, pathNode]) => {
        try {
          const searchParams = new URL(url, 'http://localhost').searchParams;
          const q = (searchParams.get('q') || '').toLowerCase().trim();
          if (!q) { res.setHeader('Content-Type', 'application/json'); res.end('[]'); return; }
          const CATEGORY_MAP: Record<string, string> = { files: 'general', photos: 'media', videos: 'video_vault', music: 'music' };
          const results: any[] = [];
          const searchRecursive = (dir: string, catFolder: string, relPath: string) => {
            if (!fsNode.existsSync(dir)) return;
            for (const entry of fsNode.readdirSync(dir, { withFileTypes: true })) {
              const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
              if (entry.name.toLowerCase().includes(q)) {
                const full = pathNode.join(dir, entry.name);
                const stat = fsNode.statSync(full);
                const category = CATEGORY_MAP[catFolder] || 'general';
                results.push({
                  name: entry.name,
                  isFolder: entry.isDirectory(),
                  sizeBytes: entry.isFile() ? stat.size : undefined,
                  mtimeMs: stat.mtimeMs,
                  category,
                  path: entryRelPath,
                });
              }
              if (entry.isDirectory()) {
                searchRecursive(pathNode.join(dir, entry.name), catFolder, entryRelPath);
              }
            }
          };
          for (const catFolder of ['files', 'photos', 'videos', 'music']) {
            searchRecursive(pathNode.join(base, catFolder), catFolder, '');
          }
          // Sort: starts-with first, then folders first, then alphabetical; limit 30
          results.sort((a, b) => {
            const aS = a.name.toLowerCase().startsWith(q) ? 0 : 1;
            const bS = b.name.toLowerCase().startsWith(q) ? 0 : 1;
            if (aS !== bS) return aS - bS;
            if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(results.slice(0, 30)));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Search failed' }));
        }
      }).catch(() => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Search failed' }));
      });
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Search failed' }));
    }
    return true;
  }

  // ── Total file/folder count across all categories ──
  if (path === '/api/files/total-count' && req.method === 'GET') {
    resolveUserBaseDir(req).then((base) => {
      try {
        const categories = ['files', 'photos', 'videos', 'music'];
        let totalFiles = 0;
        let totalFolders = 0;
        const countRecursive = (dir: string) => {
          if (!fs.existsSync(dir)) return;
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              totalFolders++;
              countRecursive(nodePath.join(dir, entry.name));
            } else if (entry.isFile()) {
              totalFiles++;
            }
          }
        };
        for (const cat of categories) {
          countRecursive(nodePath.join(base, cat));
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ totalFiles, totalFolders, total: totalFiles + totalFolders }));
      } catch {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to count files' }));
      }
    }).catch(() => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to count files' }));
    });
    return true;
  }

  // ── SSE: Real-time USB device events ──
  if (path === '/api/system/usb-events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(':\n\n'); // SSE comment to keep connection alive

    let lastDevices: string[] = [];

    // Get initial snapshot
    import('../storage.js').then(({ getRemovableDevices }) => {
      try {
        const initial = getRemovableDevices();
        lastDevices = initial.map(d => d.name).sort();
        res.write(`data: ${JSON.stringify({ type: 'init', devices: initial })}\n\n`);
      } catch {}
    }).catch(() => {});

    // Poll every 3 seconds for changes
    const pollInterval = setInterval(async () => {
      try {
        const { getRemovableDevices } = await import('../storage.js');
        const current = getRemovableDevices();
        const currentNames = current.map(d => d.name).sort();
        const prevNames = lastDevices;

        const added = current.filter(d => !prevNames.includes(d.name));
        const removed = prevNames.filter(n => !currentNames.includes(n));

        if (added.length > 0 || removed.length > 0) {
          lastDevices = currentNames;
          const event = {
            type: 'change',
            added: added.map(d => ({ name: d.name, model: d.model, label: d.label, sizeHuman: d.sizeHuman, deviceType: d.deviceType })),
            removed,
            devices: current,
          };
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch {}
    }, 3000);

    // Keep-alive ping every 30s
    const keepAlive = setInterval(() => {
      try { res.write(':\n\n'); } catch {}
    }, 30000);

    req.on('close', () => {
      clearInterval(pollInterval);
      clearInterval(keepAlive);
    });

    return true;
  }

  // ── Storage: root + removable devices (family-aware) ──
  if (path === '/api/system/storage') {
    (async () => {
      try {
        const [{ getRootStorage, getRemovableDevices }] = await Promise.all([import('../storage.js')]);
        const root = getRootStorage();
        const removable = getRemovableDevices();

        // Ensure req.user is populated (session-validation fallback)
        await resolveUserBaseDir(req);
        const userId = (req as any).user?.id as number | undefined;

        if (userId) {
          // Check if this user is an active family member
          const { rows: fmRows } = await pool.query(
            `SELECT fm.id, fm.storage_quota, fm.owner_id
             FROM family_members fm
             WHERE fm.user_id = $1 AND fm.status = 'active'
             LIMIT 1`,
            [userId],
          );

          if (fmRows.length > 0) {
            // ── Family member: return quota-based storage view ──
            const fm = fmRows[0];
            const quota: number = Number(fm.storage_quota);
            const userDir = (req as any).user?.storagePath as string | undefined;
            const expandedDir = userDir && userDir !== 'pending'
              ? (userDir.startsWith('~/') || userDir === '~'
                ? nodePath.join(os.homedir(), userDir.slice(userDir === '~' ? 1 : 2))
                : userDir)
              : null;
            const used = expandedDir ? calcDirSize(expandedDir) : 0;
            const free = Math.max(0, quota - used);
            const usedPercent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

            // Persist updated usage (fire-and-forget)
            pool.query('UPDATE family_members SET storage_used = $1 WHERE id = $2', [used, fm.id]).catch(() => {});

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              rootStorage: root,
              removable,
              familyMemberStorage: {
                quota,
                used,
                free,
                usedPercent,
                quotaHuman: formatBytes(quota),
                usedHuman: formatBytes(used),
                freeHuman: formatBytes(free),
              },
            }));
            return;
          }

          // ── Owner: add total family-allocated bytes ──
          const { rows: allocRows } = await pool.query(
            `SELECT COALESCE(SUM(storage_quota), 0) AS total_allocated
             FROM family_members
             WHERE owner_id = $1 AND status = 'active'`,
            [userId],
          );
          const familyAllocated = Number(allocRows[0]?.total_allocated ?? 0);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ rootStorage: root, removable, familyAllocated }));
          return;
        }

        // Unauthenticated / fallback
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ rootStorage: root, removable }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ rootStorage: null, removable: [], error: String((e as Error).message) }));
      }
    })();
    return true;
  }

  // ── System stats: CPU, memory, network, uptime ──
  if (path === '/api/system/stats') {
    import('../stats.js').then(({ getSystemStats }) => {
      try {
        const stats = getSystemStats();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(stats));
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

  // ── Public IP lookup ──
  if (path === '/api/system/public-ip') {
    import('../stats.js').then(({ getPublicIp }) => {
      getPublicIp().then((ip) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ip }));
      }).catch((e) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      });
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── System log entries ──
  if (path === '/api/system/logs') {
    const limitParam = parseInt(new URL(url, 'http://localhost').searchParams.get('limit') || '50', 10);
    import('../stats.js').then(({ getDetailedLogs }) => {
      try {
        const logs = getDetailedLogs(limitParam);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ logs }));
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

  // ── System information ──
  if (path === '/api/system/info') {
    import('../notifications.js').then(({ getSystemInfo }) => {
      try {
        const info = getSystemInfo();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(info));
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

  // ── List files on external/removable device ──
  if (path === '/api/files/list-external') {
    const pathParam = new URL(url, 'http://localhost').searchParams.get('path') || '';
    const decodedPath = pathParam;

    console.log(`[list-external] Requested path: "${decodedPath}"`);

    Promise.all([import('fs'), import('path'), import('child_process')]).then(([fs, pathModule, cp]) => {
      try {
        const { execSync } = cp;

        const normalized = pathModule.normalize(decodedPath);
        const resolved = pathModule.resolve(normalized);
        const ALLOWED = ['/media/', '/run/media/', '/mnt/'];
        const allowed = ALLOWED.some((p: string) => resolved.startsWith(p) || resolved === p.replace(/\/$/, ''));
        if (!allowed) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Path not allowed' }));
          return;
        }

        interface DirEntry { name: string; isFolder: boolean; mtimeMs: number; sizeBytes?: number; hasSubfolders?: boolean; }
        let entries: DirEntry[] = [];

        // Try direct read first
        try {
          const names: string[] = fs.readdirSync(resolved);
          console.log(`[list-external] readdirSync returned ${names.length} entries for "${resolved}"`);
          for (const name of names) {
            const full = pathModule.join(resolved, name);
            try {
              const stat = fs.statSync(full);
              const isDir = stat.isDirectory();
              let hasSubfolders: boolean | undefined;
              if (isDir) {
                try {
                  const children = fs.readdirSync(full, { withFileTypes: true });
                  hasSubfolders = children.some((c: any) => c.isDirectory());
                } catch { hasSubfolders = undefined; }
              }
              entries.push({
                name,
                isFolder: isDir,
                mtimeMs: stat.mtimeMs,
                sizeBytes: stat.isFile() ? stat.size : undefined,
                hasSubfolders,
              });
            } catch {
              entries.push({ name, isFolder: false, mtimeMs: Date.now() });
            }
          }
        } catch (directErr: any) {
          console.error(`[list-external] Direct read failed: ${directErr.code} — ${directErr.message}`);
          if (directErr.code === 'ENOENT') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ folders: [], files: [] }));
            return;
          }
        }

        // If empty, try sudo ls fallback
        if (entries.length === 0) {
          console.log(`[list-external] Trying sudo ls fallback for "${resolved}"`);
          try {
            const out = execSync(
              `sudo -n ls -la --time-style=+%s ${JSON.stringify(resolved)}`,
              { encoding: 'utf8', timeout: 10000 }
            );
            const lines = out.trim().split('\n');
            for (const line of lines) {
              if (line.startsWith('total ') || !line.trim()) continue;
              const parts = line.split(/\s+/);
              if (parts.length < 7) continue;
              const perms = parts[0];
              const sizeStr = parts[4];
              const timestamp = parts[5];
              const name = parts.slice(6).join(' ');
              if (name === '.' || name === '..') continue;
              const isFolder = perms.startsWith('d');
              const size = parseInt(sizeStr, 10);
              const mtimeMs = parseInt(timestamp, 10) * 1000;
              entries.push({
                name,
                isFolder,
                mtimeMs: isNaN(mtimeMs) ? Date.now() : mtimeMs,
                sizeBytes: !isFolder && !isNaN(size) ? size : undefined,
              });
            }
            if (entries.length > 0) {
              console.log(`[list-external] sudo fallback found ${entries.length} entries`);
            }
          } catch (sudoErr: any) {
            console.error('[list-external] sudo fallback failed:', sudoErr.message);
          }
        }

        // If STILL empty, try plain ls as last resort
        if (entries.length === 0) {
          console.log(`[list-external] Trying plain ls fallback for "${resolved}"`);
          try {
            const out = execSync(
              `ls -la --time-style=+%s ${JSON.stringify(resolved)}`,
              { encoding: 'utf8', timeout: 10000 }
            );
            const lines = out.trim().split('\n');
            for (const line of lines) {
              if (line.startsWith('total ') || !line.trim()) continue;
              const parts = line.split(/\s+/);
              if (parts.length < 7) continue;
              const perms = parts[0];
              const sizeStr = parts[4];
              const timestamp = parts[5];
              const name = parts.slice(6).join(' ');
              if (name === '.' || name === '..') continue;
              const isFolder = perms.startsWith('d');
              const size = parseInt(sizeStr, 10);
              const mtimeMs = parseInt(timestamp, 10) * 1000;
              entries.push({
                name,
                isFolder,
                mtimeMs: isNaN(mtimeMs) ? Date.now() : mtimeMs,
                sizeBytes: !isFolder && !isNaN(size) ? size : undefined,
              });
            }
            if (entries.length > 0) {
              console.log(`[list-external] plain ls found ${entries.length} entries`);
            }
          } catch (lsErr: any) {
            console.error('[list-external] plain ls failed:', lsErr.message);
          }
        }

        const folders = entries.filter((e: DirEntry) => e.isFolder);
        const files = entries.filter((e: DirEntry) => !e.isFolder);
        console.log(`[list-external] Returning ${folders.length} folders, ${files.length} files`);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ folders, files }));
      } catch (e) {
        console.error('[list-external] Exception:', (e as Error).message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    }).catch((e) => {
      console.error('[list-external] Import error:', (e as Error).message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── Serve external files by absolute path (removable mounts) ──
  if (path.startsWith('/api/files/serve-external') && req.method === 'GET') {
    const pathParam = new URL(url, 'http://localhost').searchParams.get('path') || '';

    Promise.all([import('path'), import('fs'), import('child_process')]).then(([pathModule, fsModule, cpModule]) => {
      try {
        const requested = decodeURIComponent(pathParam);

        if (!requested || !requested.startsWith('/') || requested.includes('..')) {
          console.warn(`[serve-external] BLOCKED: Invalid path format`);
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        // SEC-PT-004: Validate path is under allowed mount prefixes (same as list-external)
        const ALLOWED_SERVE = ['/media/', '/run/media/', '/mnt/'];
        const normalizedReq = pathModule.resolve(requested);
        const isAllowed = ALLOWED_SERVE.some((p: string) => normalizedReq.startsWith(p) || normalizedReq === p.replace(/\/$/, ''));
        if (!isAllowed) {
          console.warn(`[serve-external] BLOCKED: Path "${normalizedReq}" not under allowed prefixes`);
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        let fileSize = 0;
        let isDir = false;
        let canReadDirect = false;

        try {
          const stat = fsModule.default.statSync(requested);
          fileSize = stat.size;
          isDir = stat.isDirectory();
          canReadDirect = true;
        } catch (statErr: any) {
          if (statErr.code === 'ENOENT') {
            try {
              // SEC-CI-007: Use spawnSync instead of string interpolation
              const statResult = cpModule.spawnSync('sudo', ['-n', 'stat', '--format=%s %F', requested],
                { encoding: 'utf8', timeout: 5000 });
              if (statResult.error || statResult.status !== 0) throw new Error('stat failed');
              const statOut = statResult.stdout.trim();
              const [sizeStr, typeStr] = statOut.split(' ');
              fileSize = parseInt(sizeStr, 10) || 0;
              isDir = typeStr === 'directory';
            } catch {
              console.warn(`[serve-external] FILE NOT FOUND: ${requested}`);
              res.statusCode = 404;
              res.end('File not found');
              return;
            }
          } else if (statErr.code === 'EACCES' || statErr.code === 'EPERM') {
            try {
              // SEC-CI-007: Use spawnSync instead of string interpolation
              const statResult = cpModule.spawnSync('sudo', ['-n', 'stat', '--format=%s %F', requested],
                { encoding: 'utf8', timeout: 5000 });
              if (statResult.error || statResult.status !== 0) throw new Error('stat failed');
              const statOut = statResult.stdout.trim();
              const [sizeStr, typeStr] = statOut.split(' ');
              fileSize = parseInt(sizeStr, 10) || 0;
              isDir = typeStr === 'directory';
            } catch {
              res.statusCode = 403;
              res.end('Permission denied');
              return;
            }
          } else {
            throw statErr;
          }
        }

        if (isDir) {
          console.warn(`[serve-external] ERROR: Requested path is a directory`);
          res.statusCode = 400;
          res.end('Cannot serve a directory');
          return;
        }

        const ext = pathModule.default.extname(requested).toLowerCase();
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
          '.pdf': 'application/pdf',
          '.txt': 'text/plain',
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json',
        };

        const contentType = contentTypes[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Range,Accept,Content-Type');
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        if (canReadDirect) {
          const readStream = fsModule.default.createReadStream(requested);
          readStream.on('error', (err) => {
            console.error(`[serve-external] Stream error: ${err.message}`);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.end('Error reading file');
            }
          });
          readStream.pipe(res);
        } else {
          // Use sudo cat for root-owned files
          const child = cpModule.spawn('sudo', ['-n', 'cat', requested]);
          child.stdout.pipe(res);
          child.stderr.on('data', (data: Buffer) => {
            console.error(`[serve-external] sudo cat stderr: ${data.toString()}`);
          });
          child.on('error', (err) => {
            console.error(`[serve-external] sudo cat error: ${err.message}`);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.end('Error reading file');
            }
          });
        }
      } catch (e) {
        console.error(`[serve-external] Exception: ${(e as Error).message}`);
        res.statusCode = 500;
        res.end(String((e as Error).message));
      }
    }).catch((e) => {
      res.statusCode = 500;
      res.end(String((e as Error).message));
    });
    return true;
  }

  // ── Mount removable device ──
  if (path === '/api/system/mount' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      Promise.all([import('../storage.js'), import('child_process'), import('path')]).then(async ([{ getFirstPartition }, { spawnSync, execSync }, pathModule]) => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const device = (body.device as string)?.trim();
          const sudoPassword = (body.password as string) || '';

          if (!device || !/^[a-z0-9]+$/.test(device)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing or invalid device name' }));
            return;
          }

          const partition = getFirstPartition(device);
          if (!partition) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'No partition found to mount' }));
            return;
          }

          // Check if already mounted
          try {
            const lsblkOut = execSync(`lsblk -J -o NAME,MOUNTPOINT /dev/${partition}`, { encoding: 'utf8', timeout: 5000 });
            const lsblkData = JSON.parse(lsblkOut) as { blockdevices?: Array<{ mountpoint?: string }> };
            const existingMount = lsblkData.blockdevices?.[0]?.mountpoint;
            if (existingMount) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, mountpoint: existingMount }));
              return;
            }
          } catch {}

          // Helper: run sudo command — tries passwordless (-n) first, falls back to password via stdin
          const runSudo = (args: string[]): { status: number | null; stderr: string; stdout: string } => {
            const noPassResult = spawnSync('sudo', ['-n', ...args], {
              encoding: 'utf8',
              timeout: 60000,
              maxBuffer: 10 * 1024 * 1024,
            });
            if (noPassResult.status === 0) return noPassResult;
            if (sudoPassword) {
              const passResult = spawnSync('sudo', ['-S', ...args], {
                input: sudoPassword + '\n',
                encoding: 'utf8',
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024,
              });
              return passResult;
            }
            return noPassResult;
          };

          // Get volume label for a nicer mount directory name
          let volumeLabel = '';
          try {
            const labelOut = execSync(`lsblk -n -o LABEL /dev/${partition}`, { encoding: 'utf8', timeout: 3000 }).trim();
            if (labelOut && /^[a-zA-Z0-9_\-. ]+$/.test(labelOut)) {
              volumeLabel = labelOut.replace(/\s+/g, '_');
            }
          } catch {}

          // If no label, try UUID
          if (!volumeLabel) {
            try {
              const uuidOut = execSync(`lsblk -n -o UUID /dev/${partition}`, { encoding: 'utf8', timeout: 3000 }).trim();
              if (uuidOut && /^[a-zA-Z0-9_\-]+$/.test(uuidOut)) {
                volumeLabel = uuidOut;
              }
            } catch {}
          }

          const mountName = volumeLabel || partition;
          const mountDir = `/media/arcellite/${mountName}`;

          runSudo(['chmod', '755', '/media/arcellite']);

          const mkdirResult = runSudo(['mkdir', '-p', mountDir]);
          if (mkdirResult.status !== 0) {
            const errMsg = (mkdirResult.stderr || '').trim();
            if (errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Incorrect password', requiresAuth: true }));
              return;
            }
            if (errMsg.includes('a password is required')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Password required', requiresAuth: true }));
              return;
            }
            throw new Error(errMsg || 'Failed to create mount directory');
          }

          const mountResult = runSudo(['mount', `-o`, `uid=1000,gid=1000,dmask=022,fmask=133`, `/dev/${partition}`, mountDir]);

          if (mountResult.status !== 0) {
            const errMsg = (mountResult.stderr || mountResult.stdout || '').trim();
            if (errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Incorrect password', requiresAuth: true }));
              return;
            }
            if (errMsg.includes('already mounted')) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, mountpoint: mountDir }));
              return;
            }
            // If uid/gid mount options fail (e.g. ext4), retry without them
            if (errMsg.includes('bad option') || errMsg.includes('unrecognized mount option')) {
              const retryResult = runSudo(['mount', `/dev/${partition}`, mountDir]);
              if (retryResult.status !== 0) {
                throw new Error((retryResult.stderr || '').trim() || 'Mount failed');
              }
              runSudo(['chown', '-R', 'arcellite:arcellite', mountDir]);
            } else {
              throw new Error(errMsg || 'Mount failed');
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, mountpoint: mountDir }));
        } catch (e) {
          const msg = (e as Error).message || String(e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: msg }));
        }
      }).catch((e) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      });
    });
    return true;
  }

  // ── Unmount removable device ──
  if (path === '/api/system/unmount' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      Promise.all([import('../storage.js'), import('child_process')]).then(async ([{ getFirstPartition }, { spawnSync, execSync }]) => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const device = (body.device as string)?.trim();
          const sudoPassword = (body.password as string) || '';

          if (!device || !/^[a-z0-9]+$/.test(device)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing or invalid device name' }));
            return;
          }

          const runSudo = (args: string[]): { status: number | null; stderr: string; stdout: string } => {
            const noPassResult = spawnSync('sudo', ['-n', ...args], {
              encoding: 'utf8',
              timeout: 60000,
              maxBuffer: 10 * 1024 * 1024,
            });
            if (noPassResult.status === 0) return noPassResult;
            if (sudoPassword) {
              return spawnSync('sudo', ['-S', ...args], {
                input: sudoPassword + '\n',
                encoding: 'utf8',
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024,
              });
            }
            return noPassResult;
          };

          const partition = getFirstPartition(device);
          if (!partition) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'No partition found to unmount' }));
            return;
          }

          let mountpoint = '';
          try {
            const lsblkOut = execSync(`lsblk -J -o NAME,MOUNTPOINT /dev/${partition}`, { encoding: 'utf8', timeout: 5000 });
            const lsblkData = JSON.parse(lsblkOut) as { blockdevices?: Array<{ mountpoint?: string }> };
            mountpoint = lsblkData.blockdevices?.[0]?.mountpoint || '';
          } catch {}

          if (!mountpoint) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          try { runSudo(['fuser', '-mk', mountpoint]); } catch {}
          await new Promise(r => setTimeout(r, 500));
          let umountResult = runSudo(['umount', mountpoint]);
          if (umountResult.status !== 0) {
            umountResult = runSudo(['umount', '-l', mountpoint]);
          }

          if (umountResult.status !== 0) {
            const errMsg = (umountResult.stderr || umountResult.stdout || '').trim();
            if (errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Incorrect password', requiresAuth: true }));
              return;
            }
            if (errMsg.includes('a password is required')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Password required', requiresAuth: true }));
              return;
            }
            if (errMsg.includes('not mounted') || errMsg.includes('not found')) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
              return;
            }
            throw new Error(errMsg || 'Unmount failed');
          }

          try { runSudo(['rmdir', mountpoint]); } catch {}

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          const msg = (e as Error).message || String(e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: msg }));
        }
      }).catch((e) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      });
    });
    return true;
  }

  // ── Format removable device ──
  if (path === '/api/system/format' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      Promise.all([import('../storage.js'), import('child_process')]).then(async ([{ getFirstPartition }, { spawnSync, execSync }]) => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const device = (body.device as string)?.trim();
          const fsType = (body.filesystem as string)?.trim() || 'exfat';
          const label = (body.label as string)?.trim() || '';
          const sudoPassword = (body.password as string) || '';

          if (!device || !/^[a-z0-9]+$/.test(device)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing or invalid device name' }));
            return;
          }

          const allowedFs = ['vfat', 'ext4', 'exfat', 'ntfs'];
          if (!allowedFs.includes(fsType)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Unsupported filesystem: ${fsType}. Allowed: ${allowedFs.join(', ')}` }));
            return;
          }

          const runSudo = (args: string[], timeout = 120000): { status: number | null; stderr: string; stdout: string } => {
            const noPassResult = spawnSync('sudo', ['-n', ...args], {
              encoding: 'utf8',
              timeout,
              maxBuffer: 10 * 1024 * 1024,
            });
            if (noPassResult.status === 0) return noPassResult;
            if (sudoPassword) {
              return spawnSync('sudo', ['-S', ...args], {
                input: sudoPassword + '\n',
                encoding: 'utf8',
                timeout,
                maxBuffer: 10 * 1024 * 1024,
              });
            }
            return noPassResult;
          };

          const partition = getFirstPartition(device);
          if (!partition) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'No partition found to format' }));
            return;
          }

          let mountpoint = '';
          try {
            const lsblkOut = execSync(`lsblk -J -o NAME,MOUNTPOINT /dev/${partition}`, { encoding: 'utf8', timeout: 5000 });
            const lsblkData = JSON.parse(lsblkOut) as { blockdevices?: Array<{ mountpoint?: string }> };
            mountpoint = lsblkData.blockdevices?.[0]?.mountpoint || '';
          } catch {}

          if (mountpoint) {
            try { runSudo(['fuser', '-mk', mountpoint]); } catch {}
            await new Promise(r => setTimeout(r, 500));
            let umountResult = runSudo(['umount', mountpoint]);
            if (umountResult.status !== 0) {
              umountResult = runSudo(['umount', '-l', mountpoint]);
            }
            if (umountResult.status !== 0) {
              const errMsg = (umountResult.stderr || '').trim();
              if (errMsg.includes('a password is required') || errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Password required', requiresAuth: true }));
                return;
              }
              throw new Error(errMsg || 'Failed to unmount before format');
            }
            await new Promise(r => setTimeout(r, 500));
            try { runSudo(['rmdir', mountpoint]); } catch {}
          }

          runSudo(['wipefs', '-a', `/dev/${partition}`]);

          const mkfsArgs: string[] = [];
          if (fsType === 'vfat') {
            mkfsArgs.push('mkfs.vfat', '-F', '32');
            if (label) mkfsArgs.push('-n', label.substring(0, 11).toUpperCase());
            mkfsArgs.push(`/dev/${partition}`);
          } else if (fsType === 'ext4') {
            mkfsArgs.push('mkfs.ext4', '-F');
            if (label) mkfsArgs.push('-L', label.substring(0, 16));
            mkfsArgs.push(`/dev/${partition}`);
          } else if (fsType === 'exfat') {
            mkfsArgs.push('mkfs.exfat');
            if (label) mkfsArgs.push('-L', label.substring(0, 15));
            mkfsArgs.push(`/dev/${partition}`);
          } else if (fsType === 'ntfs') {
            mkfsArgs.push('mkfs.ntfs', '-f');
            if (label) mkfsArgs.push('-L', label.substring(0, 32));
            mkfsArgs.push(`/dev/${partition}`);
          }

          const formatResult = runSudo(mkfsArgs, 300000);

          if (formatResult.status !== 0) {
            const errMsg = (formatResult.stderr || formatResult.stdout || '').trim();
            if (errMsg.includes('a password is required') || errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Password required', requiresAuth: true }));
              return;
            }
            throw new Error(errMsg || 'Format failed');
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, message: `Formatted /dev/${partition} as ${fsType}` }));
        } catch (e) {
          const msg = (e as Error).message || String(e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: msg }));
        }
      }).catch((e) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      });
    });
    return true;
  }

  // ── System restart (requires auth + password verification) ──
  if (path === '/api/system/restart' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    const sessionToken = authHeader.substring(7);
    parseBody(req).then(async (body) => {
      try {
        const user = await authService.validateSession(sessionToken);
        if (!user) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid session' }));
          return;
        }
        const password = (body.password as string) || '';
        const dbResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
        const storedHash = dbResult.rows[0]?.password_hash;
        if (!storedHash || !(await bcrypt.compare(password, storedHash))) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Incorrect password' }));
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, message: 'Restart initiated' }));
        setTimeout(() => {
          exec('sudo reboot', (error) => {
            if (error) console.error('Reboot error:', error);
          });
        }, 500);
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // ── System shutdown (requires auth + password verification) ──
  if (path === '/api/system/shutdown' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    const sessionToken = authHeader.substring(7);
    parseBody(req).then(async (body) => {
      try {
        const user = await authService.validateSession(sessionToken);
        if (!user) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid session' }));
          return;
        }
        const password = (body.password as string) || '';
        const dbResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
        const storedHash = dbResult.rows[0]?.password_hash;
        if (!storedHash || !(await bcrypt.compare(password, storedHash))) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Incorrect password' }));
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, message: 'Shutdown initiated' }));
        setTimeout(() => {
          exec('sudo shutdown -h now', (error) => {
            if (error) console.error('Shutdown error:', error);
          });
        }, 500);
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // ── System sync: flush filesystem buffers + DB checkpoint (requires auth only, no password needed) ──
  if (path === '/api/system/sync' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    const sessionToken = authHeader.substring(7);
    Promise.all([
      import('../services/auth.service.js'),
      import('child_process'),
    ]).then(async ([authMod, { execSync }]) => {
      const user = await authMod.validateSession(sessionToken);
      if (!user) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid session' }));
        return;
      }
      // Flush filesystem buffers to disk (no sudo required)
      execSync('sync', { timeout: 10000 });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, message: 'Filesystem synced successfully' }));
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── Cast device discovery ──
  if (path === '/api/cast/discover' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    const token = authHeader.substring(7);
    // handleSystemRoutes is synchronous — use async IIFE so we can await
    (async () => {
      const user = await authService.validateSession(token);
      if (!user) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid session' }));
        return;
      }
      const devices = await discoverCastDevices();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, devices }));
    })().catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── Cast media to a discovered device ──
  if (path === '/api/cast/send' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    const token = authHeader.substring(7);
    // handleSystemRoutes is synchronous — use async IIFE so we can await
    (async () => {
      const user = await authService.validateSession(token);
      if (!user) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid session' }));
        return;
      }
      const body = await parseBody(req);
      const { controlUrl, mediaUrl, mimeType = 'video/mp4', title = 'Arcellite Media' } = body;
      if (!controlUrl || !mediaUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'controlUrl and mediaUrl are required' }));
        return;
      }
      await dlnaCast(controlUrl, mediaUrl, mimeType, title);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, message: 'Casting started' }));
    })().catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── Clear system cache (requires auth) ──
  if (path === '/api/system/clear-cache' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    const sessionToken = authHeader.substring(7);
    Promise.all([
      import('../services/auth.service.js'),
      import('child_process'),
    ]).then(async ([authMod, { execSync }]) => {
      const user = await authMod.validateSession(sessionToken);
      if (!user) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid session' }));
        return;
      }
      // Step 1: flush filesystem buffers (no sudo, always works)
      execSync('sync', { timeout: 5000 });
      // Step 2: attempt OS page cache drop (needs sudo — non-fatal if unavailable)
      try {
        execSync('echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null 2>&1', { timeout: 8000 });
      } catch { /* sudo not configured — sync still ran */ }
      // Step 3: trigger Node.js GC if exposed
      if (typeof (global as any).gc === 'function') (global as any).gc();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, message: 'Cache cleared: filesystem synced, memory freed' }));
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  return false;
}
