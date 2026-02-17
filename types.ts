/** Response from GET /api/system/storage (backend) */
export interface RootStorageInfo {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
  totalHuman: string;
  usedHuman: string;
  availableHuman: string;
}

export type RemovableDeviceType = 'usb' | 'portable' | 'sd_card' | 'emmc';

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
  deviceType?: RemovableDeviceType;
}

export interface SystemStorageResponse {
  rootStorage: RootStorageInfo | null;
  removable: RemovableDeviceInfo[];
}

/** Response from GET /api/system/stats (backend) */
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

/** Response from GET /api/vault/analytics (backend) */
export interface CategoryStats {
  label: string;
  count: number;
  sizeBytes: number;
  sizeHuman: string;
  percentage: number;
  extensions: string[];
}

export interface VaultAnalytics {
  categories: CategoryStats[];
  totalFiles: number;
  totalSize: number;
  totalSizeHuman: string;
  storageUtilization: number[];
  healthIndex: {
    grade: string;
    status: string;
    efficiency: number;
  };
}

export type FileType = 'folder' | 'document' | 'image' | 'video' | 'audio' | 'pdf' | 'book' | 'archive' | 'code' | 'spreadsheet' | 'data' | 'config';
export type FileCategory = 'media' | 'video_vault' | 'general' | 'shared' | 'trash' | 'music' | 'external';

export interface FileItem {
  id: string;
  name: string;
  type: FileType;
  size?: string;
  sizeBytes?: number;
  modified: string;
  modifiedTimestamp: number;
  parentId: string | null;
  isFolder: boolean;
  color?: string;
  tags?: string[];
  category?: FileCategory; // Used to route folders and files to specific silos
  url?: string; // URL to access the file
  itemCount?: number; // Number of children in a folder (from server)
}

// Authentication & User Management Types
export interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  storagePath: string;
  isSetupComplete: boolean;
  emailVerified: boolean;
}

export interface AuthResponse {
  user: User;
  sessionToken: string;
}

export interface SetupStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

