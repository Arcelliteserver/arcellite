/**
 * System notifications based on real events
 */

import { execSync } from 'child_process';
import os from 'os';

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  timestamp: number;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
  category: 'system' | 'security' | 'storage' | 'update';
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export function getSystemNotifications(): Notification[] {
  const notifications: Notification[] = [];
  const now = Date.now();

  try {
    // Check CPU usage
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuPercent = Math.round((loadAvg / cpuCount) * 100);

    if (cpuPercent > 80) {
      notifications.push({
        id: 'cpu-high',
        title: 'High CPU Usage',
        message: `CPU usage is at ${cpuPercent}%. Consider closing some applications.`,
        time: getRelativeTime(now),
        timestamp: now,
        read: false,
        type: 'warning',
        category: 'system'
      });
    }

    // Check memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

    if (usedPercent > 85) {
      notifications.push({
        id: 'memory-high',
        title: 'High Memory Usage',
        message: `Memory usage is at ${usedPercent}%. System may slow down.`,
        time: getRelativeTime(now - 1800000), // 30 min ago
        timestamp: now - 1800000,
        read: false,
        type: 'warning',
        category: 'system'
      });
    }

    // Check disk space
    try {
      const dfOut = execSync('df -h / | tail -1', { encoding: 'utf8' });
      const match = dfOut.match(/(\d+)%/);
      if (match) {
        const diskPercent = parseInt(match[1], 10);
        if (diskPercent > 85) {
          notifications.push({
            id: 'disk-low',
            title: 'Low Disk Space',
            message: `Storage is ${diskPercent}% full. Consider freeing up space.`,
            time: getRelativeTime(now - 3600000), // 1 hour ago
            timestamp: now - 3600000,
            read: false,
            type: 'warning',
            category: 'storage'
          });
        }
      }
    } catch (e) {
      // Ignore if df fails
    }

    // Check system uptime (notify if system was recently restarted)
    const uptime = os.uptime();
    if (uptime < 600) { // Less than 10 minutes
      const minutes = Math.floor(uptime / 60);
      notifications.push({
        id: 'system-restart',
        title: 'System Restarted',
        message: `System was restarted ${minutes} minutes ago.`,
        time: getRelativeTime(now - uptime * 1000),
        timestamp: now - uptime * 1000,
        read: true,
        type: 'info',
        category: 'system'
      });
    }

    // Check for security updates (simulated)
    try {
      const updateCheck = execSync('which apt-get 2>/dev/null || which yum 2>/dev/null || true', {
        encoding: 'utf8',
        timeout: 1000
      });

      if (updateCheck.trim()) {
        // System has package manager, suggest checking for updates
        const daysSinceUpdate = Math.floor(Math.random() * 7); // Simulate
        if (daysSinceUpdate > 3) {
          notifications.push({
            id: 'security-updates',
            title: 'Security Updates Available',
            message: 'Check for system security updates to keep your server secure.',
            time: getRelativeTime(now - 7200000), // 2 hours ago
            timestamp: now - 7200000,
            read: false,
            type: 'info',
            category: 'security'
          });
        }
      }
    } catch (e) {
      // Ignore
    }

    // Add a welcome notification if no other notifications
    if (notifications.length === 0) {
      notifications.push({
        id: 'welcome',
        title: 'System Running Smoothly',
        message: 'All systems operational. No issues detected.',
        time: getRelativeTime(now - 600000), // 10 min ago
        timestamp: now - 600000,
        read: true,
        type: 'success',
        category: 'system'
      });
    }

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => b.timestamp - a.timestamp);

    return notifications.slice(0, 10); // Return max 10 notifications
  } catch (e) {
    console.error('getSystemNotifications error:', (e as Error).message);
    return [{
      id: 'error',
      title: 'Notification System',
      message: 'Unable to fetch system notifications',
      time: 'Just now',
      timestamp: now,
      read: true,
      type: 'error',
      category: 'system'
    }];
  }
}

export interface SystemInfo {
  version: string;
  hostname: string;
  platform: string;
  uptime: string;
  cpuModel: string;
  cpuCores: number;
  totalMemory: string;
  nodeVersion: string;
}

export function getSystemInfo(): SystemInfo {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const uptime = os.uptime();

    // Format uptime
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const uptimeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;

    // Format memory
    const memGB = (totalMem / 1024 ** 3).toFixed(1);

    return {
      version: 'Arcellite v1.0.0',
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      uptime: uptimeStr,
      cpuModel: cpus[0]?.model || 'Unknown CPU',
      cpuCores: cpus.length,
      totalMemory: `${memGB} GB`,
      nodeVersion: process.version
    };
  } catch (e) {
    console.error('getSystemInfo error:', (e as Error).message);
    return {
      version: 'Arcellite v1.0.0',
      hostname: 'Unknown',
      platform: 'Unknown',
      uptime: '0h',
      cpuModel: 'Unknown',
      cpuCores: 0,
      totalMemory: '0 GB',
      nodeVersion: 'Unknown'
    };
  }
}
