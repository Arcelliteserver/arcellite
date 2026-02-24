import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive, ArrowUpCircle, Clock, CheckCircle2, XCircle, Loader2,
  AlertTriangle, Send, FolderOpen, Image, Film, Music,
  FileText, Database, X
} from 'lucide-react';

interface StorageInfo {
  quota: number;
  used: number;
  free: number;
  usedPercent: number;
  quotaHuman: string;
  usedHuman: string;
  freeHuman: string;
}

interface StorageRequest {
  id: number;
  requestedBytes: number;
  requestedHuman: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ─── Helpers ──────
function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return (bytes / 1024 ** 4).toFixed(1) + ' TB';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function parseGBToBytes(gb: string): number {
  const v = parseFloat(gb);
  if (Number.isNaN(v) || v <= 0) return 0;
  return Math.round(v * 1024 * 1024 * 1024);
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const api = (path: string, opts?: RequestInit) => {
  const token = localStorage.getItem('sessionToken');
  return fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
};

// ─── Storage category breakdown ──────
interface CategoryUsage {
  label: string;
  bytes: number;
  color: string;
}

interface ManageStorageViewProps {
  isFamilyMember?: boolean;
}

const ManageStorageView: React.FC<ManageStorageViewProps> = ({ isFamilyMember = false }) => {
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [categories, setCategories] = useState<CategoryUsage[]>([]);
  const [requests, setRequests] = useState<StorageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);

  // Request form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestGB, setRequestGB] = useState('5');
  const [requestReason, setRequestReason] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [storageRes, requestsRes, breakdownRes] = await Promise.all([
        api('/api/system/storage'),
        api('/api/storage/requests'),
        api('/api/storage/breakdown'),
      ]);

      if (storageRes.ok) {
        const data = await storageRes.json();
        if (data.familyMemberStorage) {
          setStorage(data.familyMemberStorage);
        } else if (data.rootStorage) {
          setStorage(data.rootStorage);
        }
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(data.requests || []);
      }

      if (breakdownRes.ok) {
        const data = await breakdownRes.json();
        setCategories(data.categories || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCancelRequest = async (requestId: number) => {
    setCancellingId(requestId);
    try {
      const res = await api(`/api/storage/requests/${requestId}`, { method: 'DELETE' });
      if (res.ok) {
        setRequests((prev: StorageRequest[]) => prev.filter((r: StorageRequest) => r.id !== requestId));
      } else {
        const data = await res.json();
        console.error('Cancel failed:', data.error);
      }
    } catch {
      // Silent
    } finally {
      setCancellingId(null);
    }
  };

  const handleSubmitRequest = async () => {
    setSubmitError('');
    setSubmitSuccess(false);
    const bytes = parseGBToBytes(requestGB);
    if (bytes <= 0) {
      setSubmitError('Please enter a valid amount');
      return;
    }
    if (!requestReason.trim()) {
      setSubmitError('Please provide a reason');
      return;
    }
    setRequestLoading(true);
    try {
      const res = await api('/api/storage/request', {
        method: 'POST',
        body: JSON.stringify({ requestedBytes: bytes, reason: requestReason.trim() }),
      });
      if (res.ok) {
        setSubmitSuccess(true);
        setRequestGB('5');
        setRequestReason('');
        setShowRequestForm(false);
        fetchData();
      } else {
        const data = await res.json();
        setSubmitError(data.error || 'Failed to submit request');
      }
    } catch {
      setSubmitError('Network error');
    } finally {
      setRequestLoading(false);
    }
  };

  const pct = storage ? storage.usedPercent : 0;

  const getCategoryIcon = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('photo') || lower.includes('image')) return <Image className="w-4 h-4" />;
    if (lower.includes('video')) return <Film className="w-4 h-4" />;
    if (lower.includes('music') || lower.includes('audio')) return <Music className="w-4 h-4" />;
    if (lower.includes('document') || lower.includes('file')) return <FileText className="w-4 h-4" />;
    if (lower.includes('database')) return <Database className="w-4 h-4" />;
    return <FolderOpen className="w-4 h-4" />;
  };

  const getCategoryGradient = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('photo') || lower.includes('image')) return 'from-blue-500 to-sky-600';
    if (lower.includes('video')) return 'from-violet-500 to-purple-600';
    if (lower.includes('music') || lower.includes('audio')) return 'from-pink-500 to-rose-600';
    if (lower.includes('document') || lower.includes('file')) return 'from-amber-500 to-orange-600';
    if (lower.includes('database')) return 'from-emerald-500 to-teal-600';
    return 'from-gray-500 to-slate-600';
  };

  return (
    <div>
      {/* ── Header — matches FilesView style ── */}
      <div className="flex flex-row items-center justify-between mb-4 sm:mb-6 md:mb-8 gap-3 sm:gap-4">
        <div className="relative flex-1 min-w-0">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-heading font-bold tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative">
            Manage Storage
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h2>
          <p className="text-[11px] sm:text-xs md:text-sm text-gray-400 font-medium mt-0.5 sm:mt-1 pl-3 sm:pl-4 md:pl-6">{isFamilyMember ? 'View your usage and request more space' : 'Monitor disk usage across all categories'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pct >= 80 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 rounded-lg sm:rounded-xl border border-amber-100">
              <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Storage {pct >= 90 ? 'Critical' : 'Running Low'}</span>
              <span className="sm:hidden">{pct}%</span>
            </span>
          )}
        </div>
      </div>

      {/* Divider line */}
      <div className="h-px bg-gray-100 mb-6 sm:mb-8" />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#5D5FEF]" />
        </div>
      ) : (
        <>
          {/* ── Your Storage — dark anchor card ── */}
          <div className="rounded-2xl sm:rounded-3xl bg-[#1d1d1f] border border-[#2d2d2f] p-6 sm:p-8 md:p-10 shadow-xl shadow-black/10 overflow-hidden relative mb-6 sm:mb-8">
            <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#5D5FEF]/15 blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                    <HardDrive className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Your Storage</p>
                    <p className="text-2xl sm:text-3xl font-heading font-bold text-white leading-tight">
                      {storage ? storage.usedHuman : '—'} <span className="text-base font-bold text-white/40">/ {storage ? storage.quotaHuman : '—'}</span>
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-5 md:gap-8">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Used</p>
                    <p className="text-lg md:text-xl font-heading font-bold text-white">{storage?.usedHuman || '—'}</p>
                  </div>
                  <div className="w-px h-10 bg-white/10" />
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Free</p>
                    <p className="text-lg md:text-xl font-heading font-bold text-emerald-400">{storage?.freeHuman || '—'}</p>
                  </div>
                  <div className="w-px h-10 bg-white/10" />
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Categories</p>
                    <p className="text-lg md:text-xl font-heading font-bold text-white">{categories.length}</p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 w-full rounded-full bg-white/10 mb-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-[#5D5FEF]'}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] font-bold text-white/40">
                <span>{storage ? `${pct}% used` : '—'}</span>
                <span>{storage ? `${storage.freeHuman} free` : '—'}</span>
              </div>
            </div>
          </div>

          {/* ── Two columns: Need More Space (family) / Quick Stats (owner) + Request History ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {isFamilyMember ? (
              /* ── Need More Space (family members only) ── */
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-sm flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-600 flex items-center justify-center shadow-lg shadow-[#5D5FEF]/25">
                    <ArrowUpCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-heading font-bold text-gray-900">Need More Space?</h2>
                    <p className="text-[11px] text-gray-400 font-medium">Request from your administrator</p>
                  </div>
                </div>

                {submitSuccess && (
                  <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-green-50 border border-green-100">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-[12px] font-bold text-green-700">Request sent! The admin will review it shortly.</p>
                  </div>
                )}

                <div className="flex-1 flex flex-col">
                  {!showRequestForm ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-6">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#5D5FEF]/5 flex items-center justify-center mb-3">
                        <ArrowUpCircle className="w-7 h-7 sm:w-8 sm:h-8 text-[#5D5FEF]/40" />
                      </div>
                      <p className="text-[12px] sm:text-[13px] text-gray-400 font-medium text-center mb-4 max-w-[240px]">Running low on storage? Send a request to your admin for more space.</p>
                      <button
                        onClick={() => { setShowRequestForm(true); setSubmitSuccess(false); }}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[13px] font-bold text-white bg-[#5D5FEF] hover:bg-[#4B4DD9] active:scale-[0.98] transition-all shadow-sm"
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                        Request More Storage
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1">
                      <div>
                        <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1 block">Amount (GB)</label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={requestGB}
                          onChange={(e) => setRequestGB(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/30 focus:border-[#5D5FEF]"
                          placeholder="e.g. 10"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1 block">Reason</label>
                        <textarea
                          value={requestReason}
                          onChange={(e) => setRequestReason(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/30 focus:border-[#5D5FEF] resize-none"
                          placeholder="I need more space for photos and videos…"
                        />
                      </div>
                      {submitError && (
                        <p className="text-[11px] font-bold text-red-600">{submitError}</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setShowRequestForm(false); setSubmitError(''); }}
                          className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSubmitRequest}
                          disabled={requestLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold text-white bg-[#5D5FEF] hover:bg-[#4B4DD9] transition-all disabled:opacity-50"
                        >
                          {requestLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Send Request
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── Quick Stats card for owner/admin ── */
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-sm flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-600 flex items-center justify-center shadow-lg shadow-[#5D5FEF]/25">
                    <HardDrive className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-heading font-bold text-gray-900">Disk Overview</h2>
                    <p className="text-[11px] text-gray-400 font-medium">System storage at a glance</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 flex-1">
                  {[
                    { label: 'Total', value: storage?.quotaHuman || '—', color: 'text-gray-900', border: 'border-gray-200' },
                    { label: 'Used', value: storage?.usedHuman || '—', color: 'text-[#5D5FEF]', border: 'border-[#5D5FEF]/20' },
                    { label: 'Free', value: storage?.freeHuman || '—', color: 'text-emerald-600', border: 'border-emerald-200' },
                  ].map(({ label, value, color, border }) => (
                    <div key={label} className={`flex flex-col items-center justify-center p-4 rounded-2xl bg-white border ${border} shadow-sm`}>
                      <p className={`text-[20px] sm:text-[24px] font-heading font-bold ${color} leading-tight`}>{value}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1.5">{label}</p>
                    </div>
                  ))}
                </div>
                {storage && (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <div className="flex justify-between text-[11px] font-bold text-gray-400 mb-2">
                      <span>{pct}% used</span>
                      <span>{storage.freeHuman} remaining</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-[#5D5FEF]'}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Request History (family) / Pending Requests notice (owner) ── */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-[15px] font-heading font-bold text-gray-900">{isFamilyMember ? 'Request History' : 'Pending Requests'}</h2>
                  <p className="text-[11px] text-gray-400 font-medium">{isFamilyMember ? 'Your most recent storage request' : 'Storage requests from family members'}</p>
                </div>
              </div>

              {(() => {
                const latestRequest = requests[0];
                if (!latestRequest) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-6">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                        <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-gray-200" />
                      </div>
                      <p className="text-[12px] sm:text-[13px] text-gray-500 font-medium text-center">No requests yet</p>
                      <p className="text-[11px] text-gray-400 font-medium text-center mt-0.5">{isFamilyMember ? 'Your storage requests will appear here' : 'Family member requests will appear here'}</p>
                    </div>
                  );
                }
                return (
                  <div className="flex-1 flex flex-col">
                    {/* Status badge */}
                    <div className={`flex items-center gap-2 p-3.5 mb-4 rounded-xl border ${
                      latestRequest.status === 'approved'
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : latestRequest.status === 'denied'
                        ? 'bg-red-50/50 border-red-200'
                        : 'bg-[#5D5FEF]/5 border-[#5D5FEF]/15'
                    }`}>
                      {latestRequest.status === 'approved' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : latestRequest.status === 'denied' ? (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-[#5D5FEF] flex-shrink-0" />
                      )}
                      <p className={`text-[12px] font-bold ${
                        latestRequest.status === 'approved' ? 'text-emerald-700' : latestRequest.status === 'denied' ? 'text-red-700' : 'text-[#5D5FEF]'
                      }`}>
                        {latestRequest.status === 'approved'
                          ? `Approved! +${latestRequest.requestedHuman} added to your storage.`
                          : latestRequest.status === 'denied'
                          ? `Request for +${latestRequest.requestedHuman} was denied.`
                          : `Pending — +${latestRequest.requestedHuman} requested`}
                      </p>
                    </div>

                    {/* Request details */}
                    <div className="space-y-3 flex-1">
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Amount Requested</label>
                        <div className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[14px] font-heading font-bold text-gray-900 bg-white">
                          +{latestRequest.requestedHuman}
                        </div>
                      </div>
                      {latestRequest.reason && (
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Your Reason</label>
                          <div className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[13px] text-gray-700 bg-white line-clamp-3">
                            {latestRequest.reason}
                          </div>
                        </div>
                      )}
                      {latestRequest.adminNote && (
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Admin Note</label>
                          <div className="w-full px-4 py-3 rounded-xl border border-[#5D5FEF]/20 text-[13px] text-[#5D5FEF] font-medium bg-[#5D5FEF]/5">
                            &ldquo;{latestRequest.adminNote}&rdquo;
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 font-medium">{relativeTime(latestRequest.createdAt)}</p>
                      {latestRequest.status === 'pending' && (
                        <div className="pt-1">
                          <button
                            onClick={() => handleCancelRequest(latestRequest.id)}
                            disabled={cancellingId === latestRequest.id}
                            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-[12px] font-bold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 transition-all disabled:opacity-50"
                          >
                            {cancellingId === latestRequest.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                            Cancel Request
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Storage Breakdown — full-width bottom row ── */}
          {categories.length > 0 && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-600 flex items-center justify-center shadow-lg shadow-[#5D5FEF]/25">
                    <Database className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-[15px] sm:text-[16px] font-heading font-bold text-gray-900">Storage Breakdown</h2>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">Usage by category</p>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-500">
                  {categories.length} types
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {categories.map((cat) => {
                  const catPct = storage && storage.quota > 0 ? Math.min(100, (cat.bytes / storage.quota) * 100) : 0;
                  return (
                    <div
                      key={cat.label}
                      className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gray-50/80 border border-gray-100/80 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getCategoryGradient(cat.label)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <span className="text-white">{getCategoryIcon(cat.label)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] sm:text-[13px] font-bold text-gray-800">{cat.label}</span>
                          <span className="text-[11px] font-black text-gray-400">{catPct.toFixed(1)}%</span>
                        </div>
                        <p className="text-[14px] sm:text-[15px] font-black text-gray-900 mb-1.5">{formatBytes(cat.bytes)}</p>
                        <div className="h-1.5 w-full rounded-full bg-gray-200/60 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(catPct, 0.5)}%`, backgroundColor: cat.color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ManageStorageView;
