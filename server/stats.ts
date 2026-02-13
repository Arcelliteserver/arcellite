/**
 * System statistics (CPU, RAM, uptime, network).
 * Used by server API to provide real-time system information.
 */

import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';

export interface SystemStats {
  cpu: {
    loadPercent: number;
    cores: number;
    model: string;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
    totalHuman: string;
    usedHuman: string;
  };
  network: {
    bytesPerSec: number;
    bytesPerSecHuman: string;
    status: 'low' | 'medium' | 'high';
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
  security: {
    status: 'active' | 'inactive';
    firewallEnabled: boolean;
  };
  hostname: string;
  platform: string;
  logs: LogEntry[];
}

export interface LogEntry {
  time: string;
  event: string;
  status: 'success' | 'warning' | 'error' | 'neutral';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + 'GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + 'MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

function formatBytesPerSec(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + 'gb/s';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(0) + 'mb/s';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + 'kb/s';
  return bytes + 'b/s';
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(' ');
}

function getCpuUsage(): number {
  try {
    // Get 1-minute load average and divide by number of CPUs
    const loadAvg = os.loadavg()[0]; // 1-minute average
    const cpuCount = os.cpus().length;
    const cpuPercent = Math.round((loadAvg / cpuCount) * 100);
    return Math.min(100, Math.max(0, cpuPercent));
  } catch (e) {
    console.error('getCpuUsage error', (e as Error).message);
    return 0;
  }
}

function getMemoryInfo() {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedPercent = Math.round((usedMem / totalMem) * 100);

    return {
      totalBytes: totalMem,
      usedBytes: usedMem,
      freeBytes: freeMem,
      usedPercent,
      totalHuman: formatBytes(totalMem),
      usedHuman: formatBytes(usedMem),
    };
  } catch (e) {
    console.error('getMemoryInfo error', (e as Error).message);
    return {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      usedPercent: 0,
      totalHuman: '0B',
      usedHuman: '0B',
    };
  }
}

let lastNetworkStats: { time: number; bytes: number } | null = null;

function getNetworkStats() {
  try {
    // Read /proc/net/dev to get network statistics
    const netDev = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = netDev.split('\n');

    let totalBytes = 0;
    for (const line of lines) {
      // Skip header lines and loopback
      if (line.includes(':') && !line.includes('lo:')) {
        const parts = line.split(':')[1].trim().split(/\s+/);
        const rxBytes = parseInt(parts[0], 10) || 0;
        const txBytes = parseInt(parts[8], 10) || 0;
        totalBytes += rxBytes + txBytes;
      }
    }

    const now = Date.now();
    let bytesPerSec = 0;

    if (lastNetworkStats) {
      const timeDiff = (now - lastNetworkStats.time) / 1000; // seconds
      const bytesDiff = totalBytes - lastNetworkStats.bytes;
      bytesPerSec = Math.round(bytesDiff / timeDiff);
    }

    lastNetworkStats = { time: now, bytes: totalBytes };

    const status: 'low' | 'medium' | 'high' =
      bytesPerSec > 10 * 1024 * 1024 ? 'high' : // > 10 MB/s
      bytesPerSec > 1 * 1024 * 1024 ? 'medium' : // > 1 MB/s
      'low';

    return {
      bytesPerSec,
      bytesPerSecHuman: formatBytesPerSec(bytesPerSec),
      status,
    };
  } catch (e) {
    console.error('getNetworkStats error', (e as Error).message);
    return {
      bytesPerSec: 0,
      bytesPerSecHuman: '0b/s',
      status: 'low' as const,
    };
  }
}

function getSecurityStatus() {
  try {
    // Check if firewall is active (ufw on Ubuntu/Debian systems)
    let firewallEnabled = false;
    try {
      const ufwStatus = execSync('ufw status 2>/dev/null || true', {
        encoding: 'utf8',
        timeout: 3000
      });
      firewallEnabled = ufwStatus.toLowerCase().includes('active');
    } catch {
      // If ufw fails, try firewalld (RHEL/CentOS/Fedora)
      try {
        const firewalldStatus = execSync('firewall-cmd --state 2>/dev/null || true', {
          encoding: 'utf8',
          timeout: 3000
        });
        firewallEnabled = firewalldStatus.toLowerCase().includes('running');
      } catch {
        // Default to true if we can't determine (assume secure)
        firewallEnabled = true;
      }
    }

    return {
      status: firewallEnabled ? 'active' as const : 'inactive' as const,
      firewallEnabled,
    };
  } catch (e) {
    console.error('getSecurityStatus error', (e as Error).message);
    return {
      status: 'active' as const,
      firewallEnabled: true,
    };
  }
}

function parseLogLine(line: string): LogEntry | null {
  try {
    // Parse journalctl output: "2024-01-15T14:20:05+0000 hostname service[pid]: message"
    const timeMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    if (!timeMatch) return null;

    const timestamp = new Date(timeMatch[1]);
    const time = timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Extract service name and message
    const afterTime = line.substring(timeMatch[0].length).trim();
    const parts = afterTime.split(':');

    let service = 'system';
    let message = afterTime;

    if (parts.length >= 2) {
      // Extract service name (hostname service[pid])
      const serviceMatch = afterTime.match(/^\S+\s+(\S+?)(?:\[\d+\])?:/);
      if (serviceMatch) {
        service = serviceMatch[1];
        message = afterTime.substring(afterTime.indexOf(':') + 1).trim();
      }
    }

    // Clean up and format the message
    message = message.replace(/^\s+|\s+$/g, '').substring(0, 200);

    // Determine status based on keywords
    let status: 'success' | 'warning' | 'error' | 'neutral' = 'neutral';
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('error') || lowerMsg.includes('fail') || lowerMsg.includes('critical')) {
      status = 'error';
    } else if (lowerMsg.includes('warn') || lowerMsg.includes('alert')) {
      status = 'warning';
    } else if (
      lowerMsg.includes('start') ||
      lowerMsg.includes('success') ||
      lowerMsg.includes('complete') ||
      lowerMsg.includes('loaded') ||
      lowerMsg.includes('active') ||
      lowerMsg.includes('running')
    ) {
      status = 'success';
    }

    // Create a more readable event description
    const event = `[${service}] ${message}`;

    return { time, event, status };
  } catch (e) {
    return null;
  }
}

function getSystemLogs(): LogEntry[] {
  try {
    const logs: LogEntry[] = [];

    try {
      // Get recent important system logs
      const journalOut = execSync(
        'journalctl -n 15 --no-pager -o short-iso --priority=0..6 2>/dev/null || true',
        { encoding: 'utf8', timeout: 5000 }
      );

      const lines = journalOut.trim().split('\n').filter(l => l.trim());
      for (const line of lines) {
        const entry = parseLogLine(line);
        if (entry) logs.push(entry);
      }
    } catch (journalError) {
      console.error('journalctl error:', journalError);
    }

    // If no logs found, add a system status entry
    if (logs.length === 0) {
      const now = new Date();
      logs.push({
        time: now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        event: '[system] Arcellite monitoring service active',
        status: 'success',
      });
    }

    return logs.slice(0, 10); // Return max 10 entries
  } catch (e) {
    console.error('getSystemLogs error', (e as Error).message);
    return [{
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      event: '[system] Monitoring active',
      status: 'success',
    }];
  }
}

export function getDetailedLogs(limit: number = 50): LogEntry[] {
  try {
    const logs: LogEntry[] = [];

    try {
      // Get more detailed logs for the full log view
      const journalOut = execSync(
        `journalctl -n ${Math.min(limit, 200)} --no-pager -o short-iso --priority=0..6 2>/dev/null || true`,
        { encoding: 'utf8', timeout: 10000 }
      );

      const lines = journalOut.trim().split('\n').filter(l => l.trim());
      for (const line of lines) {
        const entry = parseLogLine(line);
        if (entry) logs.push(entry);
      }
    } catch (journalError) {
      console.error('journalctl detailed error:', journalError);
    }

    // If no logs, return a status message
    if (logs.length === 0) {
      const now = new Date();
      logs.push({
        time: now.toLocaleTimeString('en-US', { hour12: false }),
        event: '[system] No recent system logs available',
        status: 'neutral',
      });
    }

    return logs;
  } catch (e) {
    console.error('getDetailedLogs error', (e as Error).message);
    return [{
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      event: '[system] Unable to fetch logs',
      status: 'error',
    }];
  }
}

export function getSystemStats(): SystemStats {
  try {
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Unknown CPU';

    return {
      cpu: {
        loadPercent: getCpuUsage(),
        cores: cpus.length,
        model: cpuModel,
      },
      memory: getMemoryInfo(),
      network: getNetworkStats(),
      uptime: {
        seconds: os.uptime(),
        formatted: formatUptime(os.uptime()),
      },
      security: getSecurityStatus(),
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      logs: getSystemLogs(),
    };
  } catch (e) {
    console.error('getSystemStats error', (e as Error).message);
    // Return fallback data
    return {
      cpu: { loadPercent: 0, cores: 1, model: 'Unknown' },
      memory: { totalBytes: 0, usedBytes: 0, freeBytes: 0, usedPercent: 0, totalHuman: '0B', usedHuman: '0B' },
      network: { bytesPerSec: 0, bytesPerSecHuman: '0b/s', status: 'low' },
      uptime: { seconds: 0, formatted: '0m' },
      security: { status: 'active', firewallEnabled: true },
      hostname: 'Unknown',
      platform: 'Unknown',
      logs: [],
    };
  }
}
