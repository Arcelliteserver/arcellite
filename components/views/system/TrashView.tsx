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
  FileText
} from 'lucide-react';
import ConfirmModal from '../../common/ConfirmModal';

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
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

  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 md:mb-10">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-red-500 to-red-500/20 rounded-full" />
          <Trash2 className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
          <h2 className="text-[22px] md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900">
            Trash
            {items.length > 0 && (
              <span className="text-base md:text-xl text-gray-400 ml-2">({items.length})</span>
            )}
          </h2>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
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

      {/* Info Banner — compact on mobile */}
      <div className="mb-5 md:mb-6 rounded-2xl border border-red-100/50 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4 md:p-6 flex items-start gap-3">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-500/25 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] md:text-base font-black text-gray-900 mb-0.5 md:mb-1.5 tracking-tight">
            Auto-cleanup after 30 days
          </p>
          <p className="text-[11px] md:text-sm text-gray-600 font-medium leading-relaxed">
            Trash items are permanently deleted after 30 days.
          </p>
        </div>
      </div>

      {/* Action Bar — all buttons side by side */}
      {items.length > 0 && (
        <div className="mb-5 md:mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 md:p-4 flex items-center justify-between gap-2">
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

          {/* Right: Action buttons — side by side */}
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => handleRestore(Array.from(selectedIds))}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-xl text-[11px] md:text-sm font-bold bg-[#5D5FEF] text-white active:bg-[#4D4FCF] transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-[#5D5FEF]/25 touch-manipulation"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Restore</span>
                </button>
                <button
                  onClick={() => handlePermanentDelete(Array.from(selectedIds))}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-xl text-[11px] md:text-sm font-bold bg-red-500 text-white active:bg-red-600 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-red-500/25 touch-manipulation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </>
            )}
            <button
              onClick={handleEmptyTrash}
              disabled={actionLoading || items.length === 0}
              className="px-3 py-2 rounded-xl text-[11px] md:text-sm font-bold bg-gray-100 text-gray-700 active:bg-gray-200 transition-all flex items-center gap-1.5 disabled:opacity-50 touch-manipulation"
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

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-3 md:p-4 transition-all cursor-pointer touch-manipulation active:scale-[0.98] ${
                  isSelected
                    ? 'border-[#5D5FEF] ring-2 ring-[#5D5FEF]/10 shadow-lg'
                    : 'border-gray-100 active:border-gray-200'
                }`}
                onClick={() => handleSelectItem(item.id)}
              >
                {/* File Icon & Checkbox */}
                <div className="flex items-start justify-between mb-2 md:mb-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
                  </div>
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
                </div>

                {/* File Info */}
                <div className="mb-3">
                  <h4 className="text-[13px] md:text-sm font-bold text-gray-900 truncate mb-1">{item.name}</h4>
                  <div className="space-y-0.5 text-[10px] md:text-xs text-gray-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>{item.sizeHuman}</span>
                      <span>·</span>
                      <span>{formatDate(item.trashedAt)}</span>
                    </div>
                    {daysRemaining > 0 && daysRemaining <= 7 && (
                      <div className="text-red-600 font-bold text-[10px]">
                        ⏰ {daysRemaining}d left
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRestore([item.id]); }}
                    disabled={actionLoading}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] md:text-xs font-bold bg-[#5D5FEF]/10 text-[#5D5FEF] active:bg-[#5D5FEF]/20 transition-all flex items-center justify-center gap-1 disabled:opacity-50 touch-manipulation"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePermanentDelete([item.id]); }}
                    disabled={actionLoading}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] md:text-xs font-bold bg-red-50 text-red-600 active:bg-red-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50 touch-manipulation"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Item List View */}
      {!loading && items.length > 0 && viewMode === 'list' && (
        <div className="space-y-2">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const daysInTrash = Math.floor((Date.now() - item.trashedAt) / (24 * 60 * 60 * 1000));
            const daysRemaining = 30 - daysInTrash;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-3 md:p-4 transition-all touch-manipulation active:scale-[0.99] ${
                  isSelected
                    ? 'border-[#5D5FEF] ring-2 ring-[#5D5FEF]/10 shadow-lg'
                    : 'border-gray-100 active:border-gray-200'
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
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-gray-400" />
                  </div>

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

                  {/* Actions — side by side, compact */}
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
