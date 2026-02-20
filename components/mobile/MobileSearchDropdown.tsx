import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FileText,
  Music,
  Film,
  Image as ImageIcon,
  Code,
  File,
  Search,
  Loader2,
} from 'lucide-react';
import { FileItem } from '../../types';

interface SearchResult {
  name: string;
  isFolder: boolean;
  sizeBytes?: number;
  mtimeMs: number;
  category: string;
  path: string;
}

interface MobileSearchDropdownProps {
  query: string;
  onFileClick: (file: FileItem) => void;
  onClose: () => void;
}

const getIcon = (file: FileItem) => {
  if (file.isFolder) return Folder;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext)) return ImageIcon;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return Film;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return Music;
  if (['js', 'ts', 'py', 'html', 'css', 'json', 'xml', 'yaml', 'sh'].includes(ext)) return Code;
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext)) return FileText;
  return File;
};

const getIconColor = (file: FileItem) => {
  if (file.isFolder) return 'text-[#5D5FEF] bg-[#5D5FEF]/10';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext)) return 'text-pink-500 bg-pink-50';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'text-purple-500 bg-purple-50';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return 'text-emerald-500 bg-emerald-50';
  if (['js', 'ts', 'py', 'html', 'css', 'json', 'xml', 'yaml', 'sh'].includes(ext)) return 'text-amber-500 bg-amber-50';
  if (['pdf'].includes(ext)) return 'text-red-500 bg-red-50';
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return 'text-blue-500 bg-blue-50';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'text-green-500 bg-green-50';
  return 'text-gray-500 bg-gray-100';
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
};

const toFileItem = (r: SearchResult): FileItem => {
  const ext = r.name.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'];
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
  let type: any = 'document';
  if (r.isFolder) type = 'folder';
  else if (imageExts.includes(ext)) type = 'image';
  else if (videoExts.includes(ext)) type = 'video';
  else if (audioExts.includes(ext)) type = 'audio';
  else if (ext === 'pdf') type = 'pdf';
  return {
    id: `server-${r.category}-${r.path}`,
    name: r.name,
    type,
    isFolder: r.isFolder,
    size: formatSize(r.sizeBytes),
    sizeBytes: r.sizeBytes,
    modified: new Date(r.mtimeMs).toLocaleDateString(),
    modifiedTimestamp: r.mtimeMs,
    parentId: null,
    category: r.category as any,
    url: r.isFolder ? undefined : `/api/files/serve?category=${r.category}&path=${encodeURIComponent(r.path)}`,
  };
};

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'];

const isImageFile = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTS.includes(ext);
};

const MobileSearchDropdown: React.FC<MobileSearchDropdownProps> = ({
  query,
  onFileClick,
  onClose,
}) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/files/search?q=${encodeURIComponent(query.trim())}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {} finally { setLoading(false); }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  if (!query.trim()) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[199] bg-black/20"
        onClick={onClose}
      />

      {/* Dropdown — capped at ~45vh so it never overwhelms the screen */}
      <div className="fixed left-4 right-4 top-[80px] z-[201] bg-white rounded-2xl shadow-xl border border-gray-100 max-h-[45vh] overflow-y-auto overscroll-contain safe-area-top">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Loader2 className="w-7 h-7 text-[#5D5FEF] animate-spin mb-2" />
            <p className="text-[13px] font-medium text-gray-400">Searching...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Search className="w-9 h-9 text-gray-300 mb-2" />
            <p className="text-[14px] font-medium text-gray-400">No results for "{query}"</p>
            <p className="text-[12px] text-gray-300 mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="py-1.5">
            <p className="px-4 pt-1.5 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((r, idx) => {
              const file = toFileItem(r);
              const Icon = getIcon(file);
              const colorClass = getIconColor(file);
              const showThumb = !r.isFolder && isImageFile(r.name);
              const thumbUrl = showThumb
                ? `/api/files/serve?category=${r.category}&path=${encodeURIComponent(r.path)}`
                : null;
              return (
                <button
                  key={`${r.category}-${r.path}-${idx}`}
                  onClick={() => {
                    onFileClick(file);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-gray-50 transition-colors"
                >
                  {thumbUrl ? (
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                      <img
                        src={thumbUrl}
                        alt={r.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{r.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {r.isFolder ? 'Folder' : formatSize(r.sizeBytes)}
                      {r.category ? ` · ${r.category}` : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default MobileSearchDropdown;
