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
      const res = await fetch('/api/trash/list');
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
              headers: { 'Content-Type': 'application/json' },
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
              headers: { 'Content-Type': 'application/json' },
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
          const res = await fetch('/api/trash/empty', { method: 'POST' });
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
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
        <div className="relative">
          <div className="absolute -left-2 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-red-500 to-red-500/20 rounded-full opacity-60" />
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 capitalize pl-4 md:pl-6 relative flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-red-500" />
            Trash
            {items.length > 0 && (
              <span className="text-lg md:text-xl text-gray-400">({items.length})</span>
            )}
          </h2>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-[#5D5FEF] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <GridIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-[#5D5FEF] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 relative overflow-hidden rounded-2xl shadow-sm">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50" />
        <div className="absolute -right-20 -top-20 w-48 h-48 bg-red-200/20 rounded-full blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-amber-200/20 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative border-2 border-red-100/50 p-5 sm:p-6 flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-500/25 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-gray-900 mb-1.5 tracking-tight">
              Automatic Cleanup After 30 Days
            </p>
            <p className="text-sm text-gray-700 font-medium leading-relaxed">
              Items in trash are automatically deleted after 30 days. You can restore or permanently delete them at any time before then.
            </p>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      {items.length > 0 && (
        <div className="mb-6 bg-white rounded-2xl border-2 border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-[#5D5FEF] transition-colors group"
            >
              {allSelected ? (
                <CheckSquare className="w-5 h-5 text-[#5D5FEF]" />
              ) : (
                <Square className="w-5 h-5 group-hover:text-[#5D5FEF]" />
              )}
              Select All
            </button>
            {selectedIds.size > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#5D5FEF]/10 text-[#5D5FEF]">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => handleRestore(Array.from(selectedIds))}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#5D5FEF] text-white hover:bg-[#4D4FCF] transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-[#5D5FEF]/25"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Restore Selected
                </button>
                <button
                  onClick={() => handlePermanentDelete(Array.from(selectedIds))}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-red-500/25"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
              </>
            )}
            <button
              onClick={handleEmptyTrash}
              disabled={actionLoading || items.length === 0}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Empty Trash
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const daysInTrash = Math.floor((Date.now() - item.trashedAt) / (24 * 60 * 60 * 1000));
            const daysRemaining = 30 - daysInTrash;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border-2 p-4 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#5D5FEF] ring-4 ring-[#5D5FEF]/10 shadow-lg'
                    : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
                }`}
                onClick={() => handleSelectItem(item.id)}
              >
                {/* File Icon & Checkbox */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectItem(item.id);
                    }}
                    className="flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-6 h-6 text-[#5D5FEF]" />
                    ) : (
                      <Square className="w-6 h-6 text-gray-300 hover:text-[#5D5FEF]" />
                    )}
                  </button>
                </div>

                {/* File Info */}
                <div className="mb-4">
                  <h4 className="font-bold text-gray-900 truncate mb-2">{item.name}</h4>
                  <div className="space-y-1 text-xs text-gray-500 font-medium">
                    <div className="truncate">📁 {item.originalPath || '/'}</div>
                    <div className="flex items-center gap-2">
                      <span>{item.sizeHuman}</span>
                      <span>•</span>
                      <span>{formatDate(item.trashedAt)}</span>
                    </div>
                    {daysRemaining > 0 && daysRemaining <= 7 && (
                      <div className="text-red-600 font-bold">
                        ⏰ {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore([item.id]);
                    }}
                    disabled={actionLoading}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-[#5D5FEF]/10 text-[#5D5FEF] hover:bg-[#5D5FEF]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePermanentDelete([item.id]);
                    }}
                    disabled={actionLoading}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
        <div className="space-y-3">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const daysInTrash = Math.floor((Date.now() - item.trashedAt) / (24 * 60 * 60 * 1000));
            const daysRemaining = 30 - daysInTrash;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border-2 p-4 transition-all ${
                  isSelected
                    ? 'border-[#5D5FEF] ring-4 ring-[#5D5FEF]/10 shadow-lg'
                    : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleSelectItem(item.id)}
                    className="flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-6 h-6 text-[#5D5FEF]" />
                    ) : (
                      <Square className="w-6 h-6 text-gray-300 hover:text-[#5D5FEF]" />
                    )}
                  </button>

                  {/* File Icon */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 truncate mb-1">{item.name}</h4>
                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium flex-wrap">
                      <span className="truncate max-w-xs">Original: {item.originalPath || '/'}</span>
                      <span>•</span>
                      <span>{item.sizeHuman}</span>
                      <span>•</span>
                      <span>Deleted: {formatDate(item.trashedAt)}</span>
                      {daysRemaining > 0 && daysRemaining <= 7 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600 font-bold">
                            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRestore([item.id])}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl text-sm font-bold bg-[#5D5FEF]/10 text-[#5D5FEF] hover:bg-[#5D5FEF]/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </button>
                    <button
                      onClick={() => handlePermanentDelete([item.id])}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
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
