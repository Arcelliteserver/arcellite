import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertCircle,
  CheckSquare,
  Square,
  Loader2,
  Grid as GridIcon,
  List as ListIcon,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileCode,
  BookOpen,
  Info,
} from 'lucide-react';
import ConfirmModal from '../../common/ConfirmModal';

/** Detect a display type from file name and category */
function getFileDisplayType(name: string, category: string): 'image' | 'video' | 'audio' | 'pdf' | 'code' | 'archive' | 'book' | 'file' {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg','jpeg','png','gif','webp','svg','heic','avif','bmp','tiff'].includes(ext) || category === 'photos') return 'image';
  if (['mp4','mov','avi','mkv','webm','m4v','flv','wmv'].includes(ext) || category === 'videos') return 'video';
  if (['mp3','wav','flac','aac','ogg','m4a','opus','wma'].includes(ext) || category === 'music') return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['epub','mobi','azw','azw3'].includes(ext)) return 'book';
  if (['js','ts','tsx','jsx','py','go','rs','cpp','c','h','java','php','rb','sh','css','html','json','yaml','yml','xml','toml'].includes(ext)) return 'code';
  if (['zip','tar','gz','rar','7z','bz2','xz'].includes(ext)) return 'archive';
  return 'file';
}

type FileIconConfig = { bg: string; iconColor: string; Icon: typeof FileText };

/** Get icon component and colors for a file type */
function getFileIconConfig(name: string, category: string): FileIconConfig {
  const type = getFileDisplayType(name, category);
  const map: Record<string, FileIconConfig> = {
    image:   { bg: 'bg-blue-50',    iconColor: 'text-blue-400',    Icon: ImageIcon as typeof FileText },
    video:   { bg: 'bg-slate-800',  iconColor: 'text-slate-300',   Icon: Film as typeof FileText },
    audio:   { bg: 'bg-pink-50',    iconColor: 'text-pink-400',    Icon: Music as typeof FileText },
    pdf:     { bg: 'bg-red-50',     iconColor: 'text-red-400',     Icon: FileText },
    book:    { bg: 'bg-indigo-50',  iconColor: 'text-indigo-400',  Icon: BookOpen as typeof FileText },
    code:    { bg: 'bg-emerald-50', iconColor: 'text-emerald-400', Icon: FileCode as typeof FileText },
    archive: { bg: 'bg-orange-50',  iconColor: 'text-orange-400',  Icon: Archive as typeof FileText },
    file:    { bg: 'bg-gray-50',    iconColor: 'text-gray-400',    Icon: FileText },
  };
  return map[type] ?? map.file;
}

interface TrashItem {
  id: string;
  name: string;
  originalPath: string;
  category: string;
  trashedAt: number;
  sizeBytes: number;
  sizeHuman: string;
}

const TrashView: React.FC = () => {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTrash = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trash/list', {
        headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` },
      });
      if (!res.ok) throw new Error('Failed to load trash');
      const data = await res.json();
      setItems(data.items || []);
      setSelectedIds(new Set()); // Clear selection when reloading
    } catch (error) {
      showToast('Failed to load trash items', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const handleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  };

  const handleSelectItem = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const handleRestore = async (ids: string[]) => {
    if (ids.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Restore Items',
      message: `Restore ${ids.length} item(s) to their original location?`,
      confirmText: 'Restore',
      variant: 'info',
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setActionLoading(true);
        let successCount = 0;
        let failCount = 0;

        for (const id of ids) {
          try {
            const res = await fetch('/api/trash/restore', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('sessionToken')}`,
              },
              body: JSON.stringify({ trashId: id }),
            });

            if (res.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            failCount++;
          }
        }

        await loadTrash();
        setActionLoading(false);

        if (successCount > 0) {
          showToast(`Successfully restored ${successCount} item(s)${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
        } else {
          showToast('Failed to restore items', 'error');
        }
      },
    });
  };

  const handlePermanentDelete = async (ids: string[]) => {
    if (ids.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete',
      message: `Permanently delete ${ids.length} item(s)? This cannot be undone!`,
      confirmText: 'Delete Forever',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setActionLoading(true);
        let successCount = 0;
        let failCount = 0;

        for (const id of ids) {
          try {
            const res = await fetch('/api/trash/delete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('sessionToken')}`,
              },
              body: JSON.stringify({ trashId: id }),
            });

            if (res.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            failCount++;
          }
        }

        await loadTrash();
        setActionLoading(false);

        if (successCount > 0) {
          showToast(`Successfully deleted ${successCount} item(s)${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
        } else {
          showToast('Failed to delete items', 'error');
        }
      },
    });
  };

  const handleEmptyTrash = async () => {
    if (items.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Empty Trash',
      message: `Permanently delete ALL ${items.length} item(s) in trash? This cannot be undone!`,
      confirmText: 'Empty Trash',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setActionLoading(true);
        try {
          const res = await fetch('/api/trash/empty', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` },
          });
          if (res.ok) {
            const data = await res.json();
            await loadTrash();
            showToast(`Successfully deleted ${data.deletedCount} item(s)`, 'success');
          } else {
            showToast('Failed to empty trash', 'error');
          }
        } catch (error) {
          showToast('Failed to empty trash', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

    return date.toLocaleDateString();
  };

  const selectedItems = items.filter(item => selectedIds.has(item.id));
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const isPreviewable = (name: string): 'image' | 'video' | null => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['jpg','jpeg','png','gif','webp','bmp','avif','tiff','heic'].includes(ext)) return 'image';
    if (['mp4','webm','mov','mkv','avi','m4v'].includes(ext)) return 'video';
    return null;
  };

  const getTrashServeUrl = (trashId: string) => `/api/trash/serve/${encodeURIComponent(trashId)}`;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 md:mb-10">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-red-500 to-red-500/20 rounded-full opacity-60" />
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-heading font-bold tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative">
              Trash
              {items.length > 0 && (
                <span className="text-base md:text-xl text-gray-400 ml-2">({items.length})</span>
              )}
            </h2>
            <p className="text-gray-500 font-medium text-xs md:text-sm pl-3 sm:pl-4 md:pl-6 mt-1">Deleted files are kept for 30 days before permanent removal</p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 flex-shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-[#5D5FEF] text-white shadow-sm'
                : 'text-gray-600 active:bg-gray-50'
            }`}
          >
            <GridIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-[#5D5FEF] text-white shadow-sm'
                : 'text-gray-600 active:bg-gray-50'
            }`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info section — 30-day policy — dark card */}
      <div className="mb-5 md:mb-6 rounded-2xl sm:rounded-3xl bg-[#1d1d1f] border border-[#2d2d2f] p-6 md:p-8 shadow-xl shadow-black/10 overflow-hidden relative">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#5D5FEF]/15 blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Trash Policy</h3>
              <p className="text-[11px] font-bold text-[#8B8DF8] mt-0.5">Auto-delete after 30 days</p>
            </div>
          </div>
          <p className="text-[12px] md:text-[13px] font-medium text-white/50 leading-relaxed sm:border-l sm:border-white/10 sm:pl-5 md:pl-6">
            Items in trash are <span className="font-bold text-white/80">permanently deleted after 30 days</span>. Restore items before they expire to recover them.
          </p>
        </div>
      </div>

      {/* Action Bar — all buttons side by side */}
      {items.length > 0 && (
        <div className="mb-5 md:mb-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-3 md:p-4 flex items-center justify-between gap-2">
          {/* Left: Select All */}
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 text-[12px] md:text-sm font-bold text-gray-700 active:text-[#5D5FEF] transition-colors touch-manipulation"
          >
            {allSelected ? (
              <CheckSquare className="w-5 h-5 text-[#5D5FEF]" />
            ) : (
              <Square className="w-5 h-5 text-gray-300" />
            )}
            <span className="hidden sm:inline">Select All</span>
            <span className="sm:hidden">All</span>
            {selectedIds.size > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#5D5FEF]/10 text-[#5D5FEF]">
                {selectedIds.size}
              </span>
            )}
          </button>

          {/* Right: Action buttons — same height */}
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => handleRestore(Array.from(selectedIds))}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#5D5FEF] text-white active:bg-[#4D4FCF] transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm shadow-[#5D5FEF]/20 touch-manipulation"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Restore</span>
                </button>
                <button
                  onClick={() => handlePermanentDelete(Array.from(selectedIds))}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-500 text-white active:bg-red-600 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm shadow-red-500/20 touch-manipulation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </>
            )}
            <button
              onClick={handleEmptyTrash}
              disabled={actionLoading || items.length === 0}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 active:bg-gray-200 transition-all flex items-center gap-1.5 disabled:opacity-50 touch-manipulation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Empty
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-[#5D5FEF] animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading trash...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && items.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-gray-100">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">Trash is Empty</h3>
          <p className="text-gray-500 font-medium">Deleted items will appear here</p>
        </div>
      )}

      {/* Item Grid View */}
      {!loading && items.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const daysInTrash = Math.floor((Date.now() - item.trashedAt) / (24 * 60 * 60 * 1000));
            const daysRemaining = 30 - daysInTrash;
            const previewType = isPreviewable(item.name);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all cursor-pointer touch-manipulation active:scale-[0.98] overflow-hidden ${
                  isSelected
                    ? 'border-[#5D5FEF] ring-2 ring-[#5D5FEF]/10 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300 shadow-sm'
                }`}
                onClick={() => handleSelectItem(item.id)}
              >
                {/* Preview area */}
                {(() => {
                  const { bg, iconColor, Icon } = getFileIconConfig(item.name, item.category);
                  const ext = item.name.split('.').pop()?.toUpperCase() || '';
                  return (
                    <div className={`relative w-full h-[140px] sm:h-[160px] ${previewType ? 'bg-gray-100' : bg} flex items-center justify-center overflow-hidden`}>
                      {previewType === 'image' ? (
                        <img
                          src={getTrashServeUrl(item.id)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            const parent = e.currentTarget.parentElement!;
                            e.currentTarget.style.display = 'none';
                            const fallback = document.createElement('div');
                            fallback.className = 'flex items-center justify-center w-full h-full';
                            fallback.innerHTML = '';
                            parent.appendChild(fallback);
                          }}
                        />
                      ) : previewType === 'video' ? (
                        <video
                          src={getTrashServeUrl(item.id)}
                          className="w-full h-full object-cover opacity-70"
                          preload="metadata"
                          muted
                        />
                      ) : (
                        <Icon className={`w-10 h-10 ${iconColor}`} />
                      )}
                      {previewType === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                            <Film className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}
                      {ext && !previewType && (
                        <span className="absolute bottom-2 left-2.5 text-[8px] font-black uppercase tracking-wider text-gray-500 bg-white/80 px-1.5 py-0.5 rounded">
                          {ext}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSelectItem(item.id); }}
                        className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm rounded-lg p-1 touch-manipulation shadow-sm"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#5D5FEF]" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  );
                })()}

                <div className="p-3">
                  {/* Filename */}
                  <h4 className="text-[12px] font-bold text-gray-900 truncate mb-1.5">{item.name}</h4>

                  {/* Meta */}
                  <div className="text-[10px] text-gray-400 font-medium mb-3">
                    <span>{item.sizeHuman}</span>
                    <span className="mx-1">·</span>
                    <span>{formatDate(item.trashedAt)}</span>
                    {daysRemaining > 0 && daysRemaining <= 7 && (
                      <span className="ml-1 text-red-500 font-bold">{daysRemaining}d left</span>
                    )}
                  </div>

                  {/* Actions — equal height buttons */}
                  <div className="flex items-center gap-1.5 pt-2.5 border-t border-gray-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRestore([item.id]); }}
                      disabled={actionLoading}
                      className="flex-1 px-2 py-2.5 rounded-xl text-[10px] font-bold bg-[#5D5FEF] text-white active:bg-[#4D4FCF] transition-all flex items-center justify-center gap-1 disabled:opacity-50 touch-manipulation shadow-sm shadow-[#5D5FEF]/20"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePermanentDelete([item.id]); }}
                      disabled={actionLoading}
                      className="flex-1 px-2 py-2.5 rounded-xl text-[10px] font-bold bg-red-50 text-red-600 active:bg-red-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50 touch-manipulation"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Item List View */}
      {!loading && items.length > 0 && viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const daysInTrash = Math.floor((Date.now() - item.trashedAt) / (24 * 60 * 60 * 1000));
            const daysRemaining = 30 - daysInTrash;

            return (
              <div
                key={item.id}
                className={`px-4 md:px-5 py-3.5 md:py-4 transition-all touch-manipulation cursor-pointer ${
                  isSelected
                    ? 'bg-[#5D5FEF]/5'
                    : 'hover:bg-gray-50/50'
                }`}
                onClick={() => handleSelectItem(item.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSelectItem(item.id); }}
                    className="flex-shrink-0 touch-manipulation"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-[#5D5FEF]" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300" />
                    )}
                  </button>

                  {/* File Icon */}
                  {(() => {
                    const { bg, iconColor, Icon } = getFileIconConfig(item.name, item.category);
                    return (
                      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                      </div>
                    );
                  })()}

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] md:text-sm font-bold text-gray-900 truncate">{item.name}</h4>
                    <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-gray-400 font-medium mt-0.5">
                      <span>{item.sizeHuman}</span>
                      <span>·</span>
                      <span>{formatDate(item.trashedAt)}</span>
                      {daysRemaining > 0 && daysRemaining <= 7 && (
                        <>
                          <span>·</span>
                          <span className="text-red-500 font-bold">{daysRemaining}d left</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRestore([item.id]); }}
                      disabled={actionLoading}
                      className="p-2 rounded-xl bg-[#5D5FEF]/10 text-[#5D5FEF] active:bg-[#5D5FEF]/20 transition-all disabled:opacity-50 touch-manipulation"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePermanentDelete([item.id]); }}
                      disabled={actionLoading}
                      className="p-2 rounded-xl bg-red-50 text-red-500 active:bg-red-100 transition-all disabled:opacity-50 touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl border-2 flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {toast.type === 'success' ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
};

export default TrashView;
