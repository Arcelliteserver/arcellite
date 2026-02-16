/**
 * Shared storage detection (df + lsblk). Used by server and Vite dev middleware.
 * Linux; includes removable (RM=1) and SCSI/USB disks (sd*) so external portables show.
 */

import { execSync } from 'child_process';

export interface RootStorageInfo {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
  totalHuman: string;
  usedHuman: string;
  availableHuman: string;
}

export type RemovableDeviceType = 'usb' | 'portable';

export interface RemovableDeviceInfo {
  name: string;
  size: string;
  sizeBytes: number;
  sizeHuman: string;
  model: string;
  mountpoint: string;
  label?: string;
  uuid?: string;
  /** Filesystem used space (human-readable, e.g. "12.3GB") */
  fsUsedHuman?: string;
  /** Filesystem available space (human-readable) */
  fsAvailHuman?: string;
  /** Filesystem total size (human-readable) */
  fsSizeHuman?: string;
  /** Usage percentage 0-100 */
  fsUsedPercent?: number;
  deviceType: RemovableDeviceType;
}

function parseSizeHuman(str: string | undefined | null): number {
  if (!str || typeof str !== 'string') return 0;
  const s = str.trim().toUpperCase();
  const num = parseFloat(s);
  if (Number.isNaN(num)) return 0;
  if (s.endsWith('G')) return Math.round(num * 1024 * 1024 * 1024);
  if (s.endsWith('M')) return Math.round(num * 1024 * 1024);
  if (s.endsWith('K')) return Math.round(num * 1024);
  if (s.endsWith('T')) return Math.round(num * 1024 * 1024 * 1024 * 1024);
  return Math.round(num);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return (bytes / 1024 ** 4).toFixed(1) + 'TB';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + 'GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + 'MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

const PORTABLE_SIZE_THRESHOLD_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB

function deviceType(model: string, sizeBytes: number): RemovableDeviceType {
  if (model.toLowerCase().includes('portable') || sizeBytes >= PORTABLE_SIZE_THRESHOLD_BYTES) return 'portable';
  return 'usb';
}

export function getRootStorage(): RootStorageInfo | null {
  try {
    const out = execSync('df -B1 /', { encoding: 'utf8', timeout: 5000 });
    const lines = out.trim().split('\n');
    if (lines.length < 2) return null;
    const parts = lines[1].split(/\s+/);
    const total = parseInt(parts[1], 10);
    const used = parseInt(parts[2], 10);
    const available = parseInt(parts[3], 10);
    const usePct = parts[4] ? parseInt(parts[4], 10) : (total ? Math.round((used / total) * 100) : 0);
    if (Number.isNaN(total) || Number.isNaN(used) || Number.isNaN(available)) return null;
    return {
      totalBytes: total,
      usedBytes: used,
      availableBytes: available,
      usedPercent: usePct,
      totalHuman: formatBytes(total),
      usedHuman: formatBytes(used),
      availableHuman: formatBytes(available),
    };
  } catch (e) {
    console.error('getRootStorage error', (e as Error).message);
    return null;
  }
}

interface LsblkDisk {
  name?: string;
  size?: number | string;
  model?: string;
  mountpoint?: string;
  rm?: boolean | string;
  label?: string;
  uuid?: string;
  fstype?: string;
  fsused?: string | null;
  fsavail?: string | null;
  fssize?: string | null;
  children?: LsblkDisk[];
}

/** First partition name for a disk (e.g. sda -> sda1) for use with udisksctl mount. */
export function getFirstPartition(diskName: string): string | null {
  if (!diskName || !/^[a-z0-9]+$/.test(diskName)) return null;
  try {
    const out = execSync('lsblk -J -o NAME', { encoding: 'utf8', timeout: 5000 });
    const data = JSON.parse(out) as { blockdevices?: LsblkDisk[] };
    const blockdevices = data.blockdevices ?? [];
    const disk = blockdevices.find((d) => (d.name ?? '').trim() === diskName);
    if (!disk?.children?.length) return null;
    const first = disk.children.find((c) => c.name);
    return first?.name ? String(first.name).trim() : null;
  } catch (e) {
    console.error('getFirstPartition error', (e as Error).message);
    return null;
  }
}

export function getRemovableDevices(): RemovableDeviceInfo[] {
  const list: RemovableDeviceInfo[] = [];
  try {
    const out = execSync('lsblk -J -o NAME,SIZE,MODEL,MOUNTPOINT,RM,LABEL,UUID,FSTYPE,FSUSED,FSAVAIL,FSSIZE', { encoding: 'utf8', timeout: 5000 });
    const data = JSON.parse(out) as { blockdevices?: LsblkDisk[] };
    const blockdevices = data.blockdevices ?? [];
    for (const disk of blockdevices) {
      const name = (disk.name ?? '').trim();
      if (!name || name.startsWith('loop')) continue;
      const removable = disk.rm === true || disk.rm === '1';
      const isSd = name.startsWith('sd');
      if (!removable && !isSd) continue;

      // Skip disks that contain the root filesystem or system partitions
      const isSystemDisk = (d: LsblkDisk): boolean => {
        const systemMounts = ['/', '/boot', '/boot/efi', '/boot/firmware', '/efi', '/home', '/var', '/usr', '/tmp', '/snap', '[SWAP]'];
        if (d.mountpoint && systemMounts.some(m => String(d.mountpoint) === m || String(d.mountpoint).startsWith('/snap/'))) return true;
        if (d.children?.length) {
          return d.children.some(c => c.mountpoint && systemMounts.some(m => String(c.mountpoint) === m || String(c.mountpoint).startsWith('/snap/')));
        }
        return false;
      };
      // For non-removable sd* disks, skip if they contain system partitions
      if (isSd && !removable && isSystemDisk(disk)) continue;
      // Also skip even removable-flagged disks if they host / or /boot
      if (removable && isSystemDisk(disk)) {
        // Check more narrowly: only skip if it has root (/) or /boot mounts
        const criticalMounts = ['/', '/boot', '/boot/efi', '/boot/firmware'];
        const hasCritical = (d: LsblkDisk): boolean => {
          if (d.mountpoint && criticalMounts.includes(String(d.mountpoint))) return true;
          return d.children?.some(c => c.mountpoint && criticalMounts.includes(String(c.mountpoint))) ?? false;
        };
        if (hasCritical(disk)) continue;
      }

      const sizeRaw = disk.size;
      let sizeBytes = 0;
      if (typeof sizeRaw === 'number' && !Number.isNaN(sizeRaw)) sizeBytes = sizeRaw;
      else if (sizeRaw) {
        const sizeStr = String(sizeRaw).trim();
        sizeBytes = parseSizeHuman(sizeStr) || parseInt(sizeStr, 10) || 0;
      }
      const model = (disk.model && String(disk.model).trim()) || name;

      // Get volume label and UUID from disk or first partition
      let label = disk.label ? String(disk.label).trim() : '';
      let uuid = disk.uuid ? String(disk.uuid).trim() : '';
      let fstype = disk.fstype ? String(disk.fstype).trim() : '';
      let fsUsed = disk.fsused || null;
      let fsAvail = disk.fsavail || null;
      let fsSize = disk.fssize || null;

      let partitionName = null;
      if (disk.children?.length) {
        const firstChild = disk.children[0];
        partitionName = firstChild?.name ? String(firstChild.name).trim() : null;
        if (!label && firstChild?.label) {
          label = String(firstChild.label).trim();
        }
        if (!uuid && firstChild?.uuid) {
          uuid = String(firstChild.uuid).trim();
        }
        if (!fstype && firstChild?.fstype) {
          fstype = String(firstChild.fstype).trim();
        }
        // Filesystem usage comes from the partition, not the disk
        if (!fsUsed && firstChild?.fsused) fsUsed = firstChild.fsused;
        if (!fsAvail && firstChild?.fsavail) fsAvail = firstChild.fsavail;
        if (!fsSize && firstChild?.fssize) fsSize = firstChild.fssize;
      }

      // Check if disk itself has a mountpoint, or check first partition's mountpoint
      let mountpoint = (disk.mountpoint && String(disk.mountpoint)) || '';
      if (!mountpoint && disk.children?.length) {
        const firstChild = disk.children[0];
        if (firstChild?.mountpoint) {
          mountpoint = String(firstChild.mountpoint);
        }
      }

      // Auto-mount if not mounted and partition exists
      if (!mountpoint && partitionName) {
        const mountDir = `/media/arcellite/${partitionName}`;
        try {
          execSync(`mkdir -p '${mountDir}' && mount '/dev/${partitionName}' '${mountDir}'`, { stdio: 'ignore' });
          mountpoint = mountDir;
        } catch (e) {
          // Ignore mount errors
        }
      }

      // Final guard: skip system/boot mountpoints that slipped through
      if (mountpoint && ['/', '/boot', '/boot/efi', '/boot/firmware', '/efi', '/home', '/var', '/usr', '/tmp'].includes(mountpoint)) continue;
      // Skip vfat EFI partitions (even if we didn't catch them above)
      if (fstype === 'vfat' && mountpoint.includes('/boot')) continue;

      // Calculate usage percentage
      const usedBytes = parseSizeHuman(fsUsed as string);
      const sizeTotal = parseSizeHuman(fsSize as string);
      const availBytes = parseSizeHuman(fsAvail as string);
      const fsUsedPercent = sizeTotal > 0 ? Math.round((usedBytes / sizeTotal) * 100) : 0;

      list.push({
        name,
        size: String(sizeRaw ?? '0'),
        sizeBytes,
        sizeHuman: formatBytes(sizeBytes),
        model: label || model || name,
        mountpoint,
        label: label || uuid || '',
        uuid,
        fsUsedHuman: fsUsed ? String(fsUsed).trim() : undefined,
        fsAvailHuman: fsAvail ? String(fsAvail).trim() : undefined,
        fsSizeHuman: fsSize ? String(fsSize).trim() : undefined,
        fsUsedPercent: mountpoint ? fsUsedPercent : undefined,
        deviceType: deviceType(model, sizeBytes),
      });
    }
  } catch (e) {
    console.error('getRemovableDevices error', (e as Error).message);
  }
  return list;
}
