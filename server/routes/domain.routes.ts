/**
 * Domain Routes
 * Handles Cloudflare Tunnel setup and custom domain configuration
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { exec, execSync } from 'child_process';
import * as authService from '../services/auth.service.js';

/** Parse JSON body from request */
async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

/** Send JSON response */
function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/** Authenticate request and return user */
async function authenticateRequest(req: IncomingMessage, res: ServerResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  const sessionToken = authHeader.substring(7);
  const user = await authService.validateSession(sessionToken);
  if (!user) {
    sendJson(res, 401, { error: 'Invalid or expired session' });
    return null;
  }
  return user;
}

/** Check if cloudflared is installed */
function isCloudflaredInstalled(): { installed: boolean; version: string | null } {
  try {
    const output = execSync('cloudflared --version 2>&1', { encoding: 'utf8', timeout: 5000 });
    const versionMatch = output.match(/cloudflared version ([\d.]+)/);
    return { installed: true, version: versionMatch ? versionMatch[1] : output.trim().split('\n')[0] };
  } catch {
    return { installed: false, version: null };
  }
}

/** Check if cloudflared service is running */
function isTunnelServiceRunning(): boolean {
  try {
    const output = execSync('systemctl is-active cloudflared 2>/dev/null || service cloudflared status 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000,
    });
    return output.trim().includes('active') || output.trim().includes('running');
  } catch {
    // Also check for running process
    try {
      execSync('pgrep -x cloudflared', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * GET /api/domain/status
 * Get cloudflared installation status and domain config
 */
export async function handleDomainStatus(req: IncomingMessage, res: ServerResponse) {
  try {
    const user = await authenticateRequest(req, res);
    if (!user) return;

    const { installed, version } = isCloudflaredInstalled();
    const tunnelRunning = installed ? isTunnelServiceRunning() : false;

    // Get saved domain config from user settings
    const settings = await authService.getUserSettings(user.id);
    const domainConfig = settings?.domainConfig || {};

    let serviceInstalled = false;
    if (installed) {
      try {
        execSync('systemctl list-unit-files cloudflared.service 2>/dev/null | grep cloudflared', {
          encoding: 'utf8',
          timeout: 3000,
        });
        serviceInstalled = true;
      } catch {
        // service not installed as systemd unit
      }
    }

    sendJson(res, 200, {
      cloudflaredInstalled: installed,
      cloudflaredVersion: version,
      tunnelRunning,
      serviceInstalled,
      tunnelName: domainConfig.tunnelName || null,
      customDomain: domainConfig.customDomain || null,
      tunnelToken: domainConfig.tunnelToken ? '••••••••' : null, // Never expose full token
    });
  } catch (error: any) {
    console.error('[Domain] Status error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to get domain status' });
  }
}

/**
 * POST /api/domain/install-cloudflared
 * Auto-install cloudflared on the system
 */
export async function handleInstallCloudflared(req: IncomingMessage, res: ServerResponse) {
  try {
    const user = await authenticateRequest(req, res);
    if (!user) return;

    // Check if already installed
    const { installed } = isCloudflaredInstalled();
    if (installed) {
      sendJson(res, 200, { success: true, log: 'cloudflared is already installed.' });
      return;
    }

    // Detect system and install
    // Try apt first, then yum/dnf, then direct deb download
    const detectAndInstall = () => {
      // Check which package manager is available
      try {
        execSync('which apt-get', { timeout: 3000 });
        return 'apt';
      } catch {}
      try {
        execSync('which dnf', { timeout: 3000 });
        return 'dnf';
      } catch {}
      try {
        execSync('which yum', { timeout: 3000 });
        return 'yum';
      } catch {}
      return 'deb'; // fallback to direct .deb download
    };

    const pkgManager = detectAndInstall();

    let installCommand: string;
    if (pkgManager === 'apt') {
      installCommand = `
        set -e
        sudo mkdir -p --mode=0755 /usr/share/keyrings
        curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null
        echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
        sudo apt-get update -qq && sudo apt-get install -y cloudflared
        echo "INSTALL_SUCCESS"
      `;
    } else if (pkgManager === 'dnf' || pkgManager === 'yum') {
      installCommand = `
        set -e
        curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | sudo tee /etc/yum.repos.d/cloudflared.repo >/dev/null
        sudo ${pkgManager} install -y cloudflared
        echo "INSTALL_SUCCESS"
      `;
    } else {
      installCommand = `
        set -e
        curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i /tmp/cloudflared.deb
        rm /tmp/cloudflared.deb
        echo "INSTALL_SUCCESS"
      `;
    }

    exec(`bash -c ${JSON.stringify(installCommand)}`, {
      timeout: 120000, // 2 minute timeout
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error && !stdout.includes('INSTALL_SUCCESS')) {
        // Try alternate install method (direct binary download)
        exec(`
          curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && \
          sudo dpkg -i /tmp/cloudflared.deb && \
          rm /tmp/cloudflared.deb && \
          echo "INSTALL_SUCCESS"
        `, { timeout: 60000 }, (error2, stdout2, stderr2) => {
          if (error2 && !stdout2.includes('INSTALL_SUCCESS')) {
            sendJson(res, 500, {
              success: false,
              error: 'Auto-installation failed. Please install manually using the commands shown below.',
              log: (stdout || '') + '\n' + (stderr || '') + '\n' + (stdout2 || '') + '\n' + (stderr2 || ''),
            });
          } else {
            sendJson(res, 200, {
              success: true,
              log: 'cloudflared installed via direct download.\n' + (stdout2 || ''),
            });
          }
        });
      } else {
        sendJson(res, 200, {
          success: true,
          log: 'cloudflared installed via apt.\n' + (stdout || ''),
        });
      }
    });
  } catch (error: any) {
    console.error('[Domain] Install error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to install cloudflared' });
  }
}

/**
 * POST /api/domain/run-tunnel
 * Save token and install cloudflared as a service
 */
export async function handleRunTunnel(req: IncomingMessage, res: ServerResponse) {
  try {
    const user = await authenticateRequest(req, res);
    if (!user) return;

    const { token } = await parseBody(req);
    if (!token || typeof token !== 'string') {
      sendJson(res, 400, { error: 'Tunnel token is required' });
      return;
    }

    // Check cloudflared is installed
    const { installed } = isCloudflaredInstalled();
    if (!installed) {
      sendJson(res, 400, { error: 'cloudflared is not installed. Please install it first.' });
      return;
    }

    // Save token to user settings
    const settings = await authService.getUserSettings(user.id);
    const domainConfig = settings?.domainConfig || {};
    domainConfig.tunnelToken = token;
    await authService.updateDomainConfig(user.id, domainConfig);

    // Install as a service
    exec(`sudo cloudflared service install ${token}`, {
      timeout: 30000,
    }, (error, stdout, stderr) => {
      if (error) {
        // If service already exists, try uninstalling first then reinstalling
        if (stderr?.includes('already exists') || stderr?.includes('already installed')) {
          exec(`sudo cloudflared service uninstall && sudo cloudflared service install ${token}`, {
            timeout: 30000,
          }, (error2, stdout2, stderr2) => {
            if (error2) {
              sendJson(res, 500, {
                success: false,
                error: `Failed to start tunnel service: ${stderr2 || error2.message}`,
              });
            } else {
              sendJson(res, 200, { success: true });
            }
          });
        } else {
          sendJson(res, 500, {
            success: false,
            error: `Failed to install service: ${stderr || error.message}. Try running manually: sudo cloudflared service install <token>`,
          });
        }
      } else {
        sendJson(res, 200, { success: true });
      }
    });
  } catch (error: any) {
    console.error('[Domain] Run tunnel error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to run tunnel' });
  }
}

/**
 * POST /api/domain/stop-tunnel
 * Stop cloudflared service
 */
export async function handleStopTunnel(req: IncomingMessage, res: ServerResponse) {
  try {
    const user = await authenticateRequest(req, res);
    if (!user) return;

    exec('sudo cloudflared service uninstall 2>/dev/null; sudo systemctl stop cloudflared 2>/dev/null; pkill cloudflared 2>/dev/null; echo "DONE"', {
      timeout: 15000,
    }, (error, stdout) => {
      sendJson(res, 200, { success: true });
    });
  } catch (error: any) {
    console.error('[Domain] Stop tunnel error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to stop tunnel' });
  }
}

/**
 * PUT /api/domain/save-domain
 * Save custom domain to user settings
 */
export async function handleSaveDomain(req: IncomingMessage, res: ServerResponse) {
  try {
    const user = await authenticateRequest(req, res);
    if (!user) return;

    const { domain } = await parseBody(req);
    if (!domain || typeof domain !== 'string') {
      sendJson(res, 400, { error: 'Domain is required' });
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      sendJson(res, 400, { error: 'Invalid domain format' });
      return;
    }

    const settings = await authService.getUserSettings(user.id);
    const domainConfig = settings?.domainConfig || {};
    domainConfig.customDomain = domain;
    await authService.updateDomainConfig(user.id, domainConfig);

    sendJson(res, 200, { success: true, domain });
  } catch (error: any) {
    console.error('[Domain] Save domain error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to save domain' });
  }
}
