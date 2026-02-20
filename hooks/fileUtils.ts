import type { FileCategory, FileItem } from '@/types';

export const FILES_API = '/api/files';

export function getCategoryFromTab(tab: string): FileCategory | null {
  if (tab === 'all') return 'general';
  if (tab === 'photos') return 'media';
  if (tab === 'videos') return 'video_vault';
  if (tab === 'music') return 'music';
  return null;
}

export function getFolderPath(folderId: string | null, category: string): string {
  if (!folderId || !category) return '';
  const prefix = `server-${category}-`;
  return folderId.startsWith(prefix) ? folderId.slice(prefix.length) : '';
}

export const CATEGORY_DIR_MAP: Record<FileCategory, string> = {
  general: 'files',
  media: 'photos',
  video_vault: 'videos',
  music: 'music',
  shared: 'shared',
  trash: 'trash',
  external: 'external',
};

export function getCategoryFromFileId(fileId: string): FileCategory | null {
  const match = fileId.match(/^server-([^-]+)-/);
  return match ? (match[1] as FileCategory) : null;
}

export function getSecurityFolderPath(file: FileItem): string | null {
  if (!file.id.startsWith('server-')) return null;
  const relativePath = file.id.replace(/^server-[^-]+-/, '');
  const category = file.category ?? getCategoryFromFileId(file.id);
  if (!category) return null;
  const categoryDir = CATEGORY_DIR_MAP[category];
  return `${categoryDir}/${relativePath}`;
}

export function folderEntriesToFileItems(
  category: string,
  path: string,
  folders: { name: string; mtimeMs: number; itemCount?: number; hasSubfolders?: boolean }[]
): FileItem[] {
  const parentId = path ? `server-${category}-${path}` : null;
  return folders.map((f) => ({
    id: `server-${category}-${path ? path + '/' : ''}${f.name}`,
    name: f.name,
    type: 'folder' as import('@/types').FileType,
    isFolder: true,
    modified: new Date(f.mtimeMs).toLocaleDateString(),
    modifiedTimestamp: f.mtimeMs,
    parentId,
    category: category as FileCategory,
    itemCount: f.itemCount ?? 0,
    hasSubfolders: f.hasSubfolders ?? false,
  }));
}

export function fileEntriesToFileItems(
  category: string,
  path: string,
  files: { name: string; mtimeMs: number; sizeBytes?: number }[]
): FileItem[] {
  const parentId = path ? `server-${category}-${path}` : null;
  return files.map((f) => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif'];
    const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp'];
    const pdfExts = ['pdf'];
    const docExts = ['doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'tex', 'md', 'markdown'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'dmg', 'iso'];
    const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'hpp', 'html', 'css', 'scss', 'sass', 'less', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'lua', 'r', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'sql', 'graphql', 'vue', 'svelte', 'dart', 'zig', 'nim', 'ex', 'exs', 'erl', 'hs', 'ml', 'clj'];
    const dataExts = ['json', 'xml', 'csv', 'yaml', 'yml', 'toml', 'ini', 'env', 'log', 'ndjson', 'geojson', 'plist'];
    const spreadsheetExts = ['xls', 'xlsx', 'ods', 'numbers', 'tsv'];
    const bookExts = ['epub', 'mobi', 'azw', 'azw3', 'fb2', 'djvu'];
    const configExts = ['conf', 'cfg', 'rc', 'properties', 'lock', 'editorconfig', 'gitignore', 'dockerignore', 'makefile'];

    let fileType: import('@/types').FileType = 'document';
    if (imageExts.includes(ext)) fileType = 'image';
    else if (videoExts.includes(ext)) fileType = 'video';
    else if (pdfExts.includes(ext)) fileType = 'pdf';
    else if (docExts.includes(ext)) fileType = 'document';
    else if (audioExts.includes(ext)) fileType = 'audio';
    else if (archiveExts.includes(ext)) fileType = 'archive';
    else if (codeExts.includes(ext)) fileType = 'code';
    else if (dataExts.includes(ext)) fileType = 'data';
    else if (spreadsheetExts.includes(ext)) fileType = 'spreadsheet';
    else if (bookExts.includes(ext)) fileType = 'book';
    else if (configExts.includes(ext)) fileType = 'config';
    else if (f.name.startsWith('.') || f.name === 'Makefile' || f.name === 'Dockerfile' || f.name === 'Vagrantfile') fileType = 'config';

    const sizeHuman = f.sizeBytes
      ? f.sizeBytes < 1024 ? `${f.sizeBytes}B`
      : f.sizeBytes < 1024 * 1024 ? `${(f.sizeBytes / 1024).toFixed(1)}KB`
      : f.sizeBytes < 1024 * 1024 * 1024 ? `${(f.sizeBytes / (1024 * 1024)).toFixed(1)}MB`
      : `${(f.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)}GB`
      : undefined;

    const relativePath = path ? `${path}/${f.name}` : f.name;
    const fileUrl = `${FILES_API}/serve?category=${category}&path=${encodeURIComponent(relativePath)}`;

    return {
      id: `server-${category}-${path ? path + '/' : ''}${f.name}`,
      name: f.name,
      type: fileType,
      isFolder: false,
      size: sizeHuman,
      sizeBytes: f.sizeBytes,
      modified: new Date(f.mtimeMs).toLocaleDateString(),
      modifiedTimestamp: f.mtimeMs,
      parentId,
      category: category as FileCategory,
      url: fileUrl,
    };
  });
}

export async function fetchFolderList(
  category: string,
  path: string
): Promise<{
  folders: { name: string; mtimeMs: number; itemCount?: number; hasSubfolders?: boolean }[];
  files: { name: string; mtimeMs: number; sizeBytes?: number }[];
}> {
  const params = new URLSearchParams({ category, path: path || '' });
  const token = localStorage.getItem('sessionToken');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${FILES_API}/list?${params}`, { headers });
  if (!res.ok) throw new Error('List failed');
  return res.json();
}
