import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  UserPlus,
  HardDrive,
  MoreVertical,
  Trash2,
  Edit3,
  Send,
  Crown,
  Eye,
  Pencil,
  Loader2,
  X,
  Check,
  Settings,
  Database,
  Gauge,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

/* ───── Types ───── */

interface FamilyMember {
  id: number;
  ownerId: number;
  name: string;
  email: string;
  role: 'viewer' | 'editor' | 'admin';
  storageQuota: number;
  storageUsed: number;
  status: 'pending' | 'active' | 'disabled';
  inviteToken: string | null;
  avatarUrl: string | null;
  notes: string | null;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FamilyStats {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  totalStorageUsed: number;
  totalStorageAllocated: number;
}

interface MobileFamilySharingViewProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface PoolInfo {
  poolSize: number;
  allocated: number;
  available: number;
  diskTotal: number;
  diskUsed: number;
  diskAvailable: number;
}

interface StorageRequest {
  id: number;
  requestedBytes: number;
  requestedHuman: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  adminNote: string | null;
  userName: string;
  userEmail: string;
  familyMemberId: number | null;
  createdAt: string;
  resolvedAt: string | null;
}

/* ───── Helpers ───── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' };
    case 'pending':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600', dot: 'bg-amber-500' };
    case 'disabled':
      return { bg: 'bg-red-500/10', text: 'text-red-500', dot: 'bg-red-500' };
    default:
      return { bg: 'bg-gray-500/10', text: 'text-gray-500', dot: 'bg-gray-400' };
  }
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'admin':
      return <Crown className="w-3 h-3" />;
    case 'editor':
      return <Pencil className="w-3 h-3" />;
    default:
      return <Eye className="w-3 h-3" />;
  }
}

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer', desc: 'Can view and download files' },
  { value: 'editor', label: 'Editor', desc: 'Can view, upload, and edit files' },
  { value: 'admin', label: 'Admin', desc: 'Full access including settings' },
];

const QUOTA_OPTIONS = [
  { value: 1073741824, label: '1 GB' },
  { value: 2147483648, label: '2 GB' },
  { value: 5368709120, label: '5 GB' },
  { value: 10737418240, label: '10 GB' },
  { value: 21474836480, label: '20 GB' },
  { value: 53687091200, label: '50 GB' },
  { value: 107374182400, label: '100 GB' },
];

/* ───── API Helpers ───── */

function authHeaders() {
  const token = localStorage.getItem('sessionToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, { ...opts, headers: { ...authHeaders(), ...(opts.headers as Record<string, string>) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ═══════════════════════════════════════════════════
   Mobile Family Sharing View
   ═══════════════════════════════════════════════════ */

const MobileFamilySharingView: React.FC<MobileFamilySharingViewProps> = ({ showToast }) => {
  /* ───── State ───── */
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [stats, setStats] = useState<FamilyStats | null>(null);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Pool settings
  const [showPoolSettings, setShowPoolSettings] = useState(false);
  const [poolInput, setPoolInput] = useState('');
  const [savingPool, setSavingPool] = useState(false);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteQuota, setInviteQuota] = useState(5368709120);
  const [inviteNotes, setInviteNotes] = useState('');
  const [inviting, setInviting] = useState(false);

  // Edit member
  const [editMember, setEditMember] = useState<FamilyMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('viewer');
  const [editQuota, setEditQuota] = useState(5368709120);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [saving, setSaving] = useState(false);

  // Action sheet
  const [actionMember, setActionMember] = useState<FamilyMember | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Storage requests
  const [storageRequests, setStorageRequests] = useState<StorageRequest[]>([]);
  const [resolvePopup, setResolvePopup] = useState<StorageRequest | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolvingRequestId, setResolvingRequestId] = useState<number | null>(null);

  /* ───── Data loading ───── */

  const loadData = useCallback(async () => {
    try {
      const [membersRes, statsRes, poolRes, requestsRes] = await Promise.all([
        apiFetch('/api/family/members'),
        apiFetch('/api/family/stats'),
        apiFetch('/api/family/pool'),
        fetch('/api/storage/requests', { headers: { ...authHeaders() } }).then(r => r.ok ? r.json() : { requests: [] }),
      ]);
      setMembers(membersRes.members || []);
      setStats(statsRes);
      setPoolInfo(poolRes);
      setStorageRequests((requestsRes.requests || []).filter((r: StorageRequest) => r.status === 'pending'));
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ───── Actions ───── */

  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      showToast?.('Name and email are required', 'error');
      return;
    }
    setInviting(true);
    try {
      await apiFetch('/api/family/invite', {
        method: 'POST',
        body: JSON.stringify({ name: inviteName, email: inviteEmail, role: inviteRole, storageQuota: inviteQuota, notes: inviteNotes }),
      });
      showToast?.(`Invited ${inviteName}`, 'success');
      setShowInvite(false);
      setInviteName(''); setInviteEmail(''); setInviteRole('viewer'); setInviteQuota(5368709120); setInviteNotes('');
      loadData();
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editMember) return;
    setSaving(true);
    try {
      await apiFetch(`/api/family/members/${editMember.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName, role: editRole, storageQuota: editQuota, status: editStatus, notes: editNotes }),
      });
      showToast?.('Member updated', 'success');
      setEditMember(null);
      loadData();
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    setDeleting(id);
    try {
      await apiFetch(`/api/family/members/${id}`, { method: 'DELETE' });
      showToast?.('Member removed', 'success');
      loadData();
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    } finally {
      setDeleting(null);
      setActionMember(null);
    }
  };

  const handleResend = async (id: number) => {
    try {
      await apiFetch(`/api/family/resend-invite/${id}`, { method: 'POST' });
      showToast?.('Invite resent', 'success');
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    }
    setActionMember(null);
  };

  const openEdit = (m: FamilyMember) => {
    setEditMember(m);
    setEditName(m.name);
    setEditRole(m.role);
    setEditQuota(m.storageQuota);
    setEditNotes(m.notes || '');
    setEditStatus(m.status);
    setActionMember(null);
  };

  const openPoolSettings = () => {
    if (poolInfo) {
      setPoolInput(poolInfo.poolSize > 0 ? String(Math.round(poolInfo.poolSize / (1024 * 1024 * 1024))) : '');
    }
    setShowPoolSettings(true);
  };

  const handleResolveRequest = async (requestId: number, action: 'approve' | 'deny', note?: string) => {
    setResolvingRequestId(requestId);
    try {
      const res = await fetch(`/api/storage/requests/${requestId}`, {
        method: 'PUT',
        headers: { ...authHeaders() },
        body: JSON.stringify({ action, note }),
      });
      if (res.ok) {
        showToast?.(`Request ${action === 'approve' ? 'approved' : 'denied'}`, 'success');
        setStorageRequests(prev => prev.filter(r => r.id !== requestId));
        loadData();
      } else {
        const data = await res.json();
        showToast?.(data.error || 'Failed to resolve request', 'error');
      }
    } catch {
      showToast?.('Network error', 'error');
    } finally {
      setResolvingRequestId(null);
    }
  };

  const getMemberRequest = (memberId: number): StorageRequest | undefined => {
    return storageRequests.find(r => r.familyMemberId === memberId);
  };

  const handleSavePool = async () => {
    const gbValue = parseFloat(poolInput);
    if (poolInput.trim() && (isNaN(gbValue) || gbValue < 0)) {
      showToast?.('Enter a valid number of GB', 'error');
      return;
    }
    setSavingPool(true);
    try {
      const poolSizeBytes = poolInput.trim() ? Math.round(gbValue * 1024 * 1024 * 1024) : 0;
      const res = await apiFetch('/api/family/pool', {
        method: 'PUT',
        body: JSON.stringify({ poolSize: poolSizeBytes }),
      });
      setPoolInfo(res);
      showToast?.('Storage pool updated', 'success');
      setShowPoolSettings(false);
      loadData();
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    } finally {
      setSavingPool(false);
    }
  };

  const getAvailableQuotaOptions = (excludeCurrentQuota = 0) => {
    if (!poolInfo || poolInfo.poolSize === 0) return QUOTA_OPTIONS;
    const avail = poolInfo.available + excludeCurrentQuota;
    return QUOTA_OPTIONS.filter(q => q.value <= avail);
  };

  /* ═══════════════════════════════════
     Render
     ═══════════════════════════════════ */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-[#5D5FEF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-200">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-5">
        <div className="relative">
          <div className="absolute -left-3 top-0 w-[3px] h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full" />
          <h2 className="text-[20px] font-extrabold text-gray-900 pl-2">Family Sharing</h2>
          <p className="text-[12px] font-medium text-gray-400 pl-2">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#5D5FEF] text-white rounded-xl text-[12px] font-semibold shadow-sm active:scale-95 touch-manipulation"
        >
          <UserPlus className="w-3.5 h-3.5" /> Invite
        </button>
      </div>

      {/* ─── Storage Pool ─── */}
      {poolInfo && (() => {
        const hasPool = poolInfo.poolSize > 0;
        const allocPct = hasPool ? Math.round((poolInfo.allocated / poolInfo.poolSize) * 100) : 0;
        return (
          <div className="space-y-2.5 mb-5">
            {/* Pool Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#5D5FEF] flex items-center justify-center shadow-sm shadow-[#5D5FEF]/20">
                  <Database className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-bold text-gray-800 block">Storage Pool</span>
                  <span className="text-[11px] font-medium text-gray-400">
                    {hasPool ? `${formatBytes(poolInfo.allocated)} of ${formatBytes(poolInfo.poolSize)}` : 'Not configured'}
                  </span>
                </div>
                <button
                  onClick={openPoolSettings}
                  className="p-2 active:bg-gray-100 rounded-xl transition-colors touch-manipulation"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {hasPool ? (
                <>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2.5">
                    <div
                      className="h-full bg-gradient-to-r from-[#5D5FEF] to-[#7B7DF4] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(allocPct, 100)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50/80 rounded-lg p-2.5">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Pool</p>
                      <p className="text-[12px] font-extrabold text-gray-800">{formatBytes(poolInfo.poolSize)}</p>
                    </div>
                    <div className="bg-gray-50/80 rounded-lg p-2.5">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Allocated</p>
                      <p className="text-[12px] font-extrabold text-[#5D5FEF]">{formatBytes(poolInfo.allocated)}</p>
                    </div>
                    <div className="bg-gray-50/80 rounded-lg p-2.5">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Available</p>
                      <p className="text-[12px] font-extrabold text-emerald-600">{formatBytes(poolInfo.available)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-[#5D5FEF]/5 border border-[#5D5FEF]/10 rounded-xl">
                  <Gauge className="w-4 h-4 text-[#5D5FEF] flex-shrink-0" />
                  <p className="text-[11px] text-[#5D5FEF]/80 font-medium">Tap settings to configure a shareable pool from your {formatBytes(poolInfo.diskAvailable)} available</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── Members ─── */}
      <div className="space-y-2.5">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <Users className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-[13px] font-bold text-gray-400 mb-1">No Members Yet</p>
            <p className="text-[11px] text-gray-300 mb-4">Invite family members to share your server</p>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#5D5FEF] text-white rounded-full text-[12px] font-semibold active:scale-95 touch-manipulation"
              style={{ opacity: 1 }}
            >
              <UserPlus className="w-3.5 h-3.5" /> Invite Member
            </button>
          </div>
        ) : (
          members.map((m) => {
            const sc = getStatusColor(m.status);
            const quotaPercent = m.storageQuota > 0 ? Math.round((m.storageUsed / m.storageQuota) * 100) : 0;

            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm active:bg-gray-50 transition-colors touch-manipulation"
                onClick={() => setActionMember(m)}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {m.avatarUrl && (
                    <img
                      src={m.avatarUrl}
                      className="w-10 h-10 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                      alt={`${m.name} avatar`}
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  {!m.avatarUrl && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-[#7B7DF4] flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-[13px]">{getInitials(m.name)}</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-bold text-gray-900 truncate">{m.name}</h3>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{m.email}</p>
                  </div>

                  {/* Role badge + Status + Menu */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${sc.bg} ${sc.text}`}>
                      {m.status === 'pending' ? (
                        <svg className="w-3 h-3" viewBox="0 -960 960 960" fill="currentColor"><path d="M322.5-437.5Q340-455 340-480t-17.5-42.5Q305-540 280-540t-42.5 17.5Q220-505 220-480t17.5 42.5Q255-420 280-420t42.5-17.5Zm200 0Q540-455 540-480t-17.5-42.5Q505-540 480-540t-42.5 17.5Q420-505 420-480t17.5 42.5Q455-420 480-420t42.5-17.5Zm200 0Q740-455 740-480t-17.5-42.5Q705-540 680-540t-42.5 17.5Q620-505 620-480t17.5 42.5Q655-420 680-420t42.5-17.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>
                      ) : (
                        <span className={`w-1 h-1 rounded-full ${sc.dot}`} />
                      )}
                      {m.status}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                      {getRoleIcon(m.role)}
                      {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                    </span>
                  </div>
                  <MoreVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>

                {/* Storage */}
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center justify-between text-[9px] text-gray-400 mb-0.5">
                    <span>{formatBytes(m.storageUsed)}</span>
                    <span>{formatBytes(m.storageQuota)}</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#5D5FEF] to-[#7B7DF4] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(quotaPercent, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Storage Request Badge */}
                {(() => {
                  const memberReq = getMemberRequest(m.id);
                  if (!memberReq) return null;
                  return (
                    <button
                      onClick={(e) => { e.stopPropagation(); setResolvePopup(memberReq); setResolveNote(''); }}
                      className="mt-2 w-full flex items-center gap-2 px-3 py-2 bg-[#5D5FEF]/5 active:bg-[#5D5FEF]/10 border border-[#5D5FEF]/15 rounded-xl transition-all touch-manipulation"
                    >
                      <div className="w-6 h-6 rounded-lg bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
                        <HardDrive className="w-3 h-3 text-[#5D5FEF]" />
                      </div>
                      <span className="text-[10px] font-bold text-[#5D5FEF] truncate">
                        Storage request: +{memberReq.requestedHuman}
                      </span>
                      <ChevronRight className="w-3 h-3 text-[#5D5FEF]/50 ml-auto flex-shrink-0" />
                    </button>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>

      {/* ═══════════ Action Sheet (bottom sheet) ═══════════ */}
      {actionMember && createPortal(
        <div className="fixed inset-0 z-[700]" onClick={() => setActionMember(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Member info */}
            <div className="flex items-center gap-3 px-5 pb-3 border-b border-gray-100">
              {actionMember.avatarUrl ? (
                <img src={actionMember.avatarUrl} className="w-10 h-10 rounded-xl object-cover border border-gray-100" alt={`${actionMember.name} avatar`} />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-[#7B7DF4] flex items-center justify-center">
                  <span className="text-white font-bold text-[13px]">{getInitials(actionMember.name)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-bold text-gray-900 truncate">{actionMember.name}</h3>
                <p className="text-[12px] text-gray-400 truncate">{actionMember.email}</p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(actionMember.status).bg} ${getStatusColor(actionMember.status).text}`}>
                {actionMember.status}
              </span>
            </div>

            {/* Actions */}
            <div className="py-2">
              <button
                onClick={() => openEdit(actionMember)}
                className="flex items-center gap-3 w-full px-5 py-3.5 active:bg-gray-50 transition-colors touch-manipulation"
              >
                <Edit3 className="w-5 h-5 text-gray-400" />
                <span className="text-[15px] font-medium text-gray-800">Edit Member</span>
              </button>
              {actionMember.status === 'pending' && (
                <button
                  onClick={() => handleResend(actionMember.id)}
                  className="flex items-center gap-3 w-full px-5 py-3.5 active:bg-gray-50 transition-colors touch-manipulation"
                >
                  <Send className="w-5 h-5 text-gray-400" />
                  <span className="text-[15px] font-medium text-gray-800">Resend Invite</span>
                </button>
              )}
              <button
                onClick={() => handleRemove(actionMember.id)}
                disabled={deleting === actionMember.id}
                className="flex items-center gap-3 w-full px-5 py-3.5 active:bg-red-50 transition-colors touch-manipulation"
              >
                {deleting === actionMember.id ? (
                  <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5 text-red-400" />
                )}
                <span className="text-[15px] font-medium text-red-500">Remove Member</span>
              </button>
            </div>

            {/* Cancel */}
            <div className="px-5 pb-5 pt-1">
              <button
                onClick={() => setActionMember(null)}
                className="w-full py-3 bg-gray-100 rounded-2xl text-[14px] font-bold text-gray-600 active:bg-gray-200 transition-colors touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══════════ Invite Modal (full-screen sheet) ═══════════ */}
      {showInvite && createPortal(
        <div className="fixed inset-0 z-[700]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowInvite(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 safe-area-bottom max-h-[90vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h2 className="text-[18px] font-extrabold text-gray-900">Invite Member</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">Add a family member to your server</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="p-2 -mr-2 active:bg-gray-100 rounded-xl transition-colors touch-manipulation">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[15px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. sarah@example.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[15px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[14px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 appearance-none"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Storage</label>
                  <select
                    value={inviteQuota}
                    onChange={(e) => setInviteQuota(Number(e.target.value))}
                    className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[14px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 appearance-none"
                  >
                    {getAvailableQuotaOptions().map((q) => (
                      <option key={q.value} value={q.value}>{q.label}</option>
                    ))}
                  </select>
                  {poolInfo && poolInfo.poolSize > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">{formatBytes(poolInfo.available)} available</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Notes <span className="text-gray-300">(optional)</span></label>
                <input
                  type="text"
                  value={inviteNotes}
                  onChange={(e) => setInviteNotes(e.target.value)}
                  placeholder="e.g. My sister"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[15px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-6 pt-2">
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#5D5FEF] active:bg-[#4D4FCF] disabled:opacity-50 text-white text-[15px] font-bold rounded-2xl transition-colors touch-manipulation"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Invite
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══════════ Edit Modal (full-screen sheet) ═══════════ */}
      {editMember && createPortal(
        <div className="fixed inset-0 z-[700]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setEditMember(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 safe-area-bottom max-h-[90vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-[#7B7DF4] flex items-center justify-center">
                  <span className="text-white font-bold text-[12px]">{getInitials(editMember.name)}</span>
                </div>
                <div>
                  <h2 className="text-[17px] font-extrabold text-gray-900">Edit Member</h2>
                  <p className="text-[11px] text-gray-400">{editMember.email}</p>
                </div>
              </div>
              <button onClick={() => setEditMember(null)} className="p-2 -mr-2 active:bg-gray-100 rounded-xl transition-colors touch-manipulation">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[15px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[14px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 appearance-none"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[14px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 appearance-none"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Storage Quota</label>
                <select
                  value={editQuota}
                  onChange={(e) => setEditQuota(Number(e.target.value))}
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[14px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 appearance-none"
                >
                  {getAvailableQuotaOptions(editMember?.storageQuota ?? 0).map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                  {editMember && !getAvailableQuotaOptions(editMember.storageQuota).find(q => q.value === editMember.storageQuota) && (
                    <option value={editMember.storageQuota}>{formatBytes(editMember.storageQuota)} (current)</option>
                  )}
                </select>
                {poolInfo && poolInfo.poolSize > 0 && editMember && (
                  <p className="text-[10px] text-gray-400 mt-1">{formatBytes(poolInfo.available + editMember.storageQuota)} available</p>
                )}
              </div>

              <div>
                <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[15px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-6 pt-2">
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#5D5FEF] active:bg-[#4D4FCF] disabled:opacity-50 text-white text-[15px] font-bold rounded-2xl transition-colors touch-manipulation"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══════════ Pool Settings Bottom Sheet ═══════════ */}
      {showPoolSettings && poolInfo && createPortal(
        <div className="fixed inset-0 z-[700]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowPoolSettings(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 safe-area-bottom max-h-[90vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h2 className="text-[18px] font-extrabold text-gray-900">Storage Pool</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">Share from your available space</p>
              </div>
              <button onClick={() => setShowPoolSettings(false)} className="p-2 -mr-2 active:bg-gray-100 rounded-xl transition-colors touch-manipulation">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-4">
              {/* Disk info */}
              <div className="bg-gray-50 rounded-xl p-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold mb-0.5">Total Disk</p>
                    <p className="text-[14px] text-gray-800 font-extrabold">{formatBytes(poolInfo.diskTotal)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold mb-0.5">Disk Used</p>
                    <p className="text-[14px] text-gray-800 font-extrabold">{formatBytes(poolInfo.diskUsed)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#5D5FEF] font-bold mb-0.5">Available Space</p>
                    <p className="text-[14px] text-[#5D5FEF] font-extrabold">{formatBytes(poolInfo.diskAvailable)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold mb-0.5">Member Allocated</p>
                    <p className="text-[14px] text-gray-800 font-extrabold">{formatBytes(poolInfo.allocated)}</p>
                  </div>
                </div>
              </div>

              {/* Pool size input */}
              <div>
                <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Pool Size (GB)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={poolInput}
                    onChange={(e) => setPoolInput(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[15px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-gray-400">GB</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {poolInput.trim() ? `${poolInput} GB shareable from ${formatBytes(poolInfo.diskAvailable)} available` : 'No limit (pool disabled)'}
                </p>
              </div>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-2">
                {[10, 25, 50, 100, 200, 500].filter(v => v * 1024 * 1024 * 1024 <= poolInfo.diskAvailable).map(gb => (
                  <button
                    key={gb}
                    onClick={() => setPoolInput(String(gb))}
                    className={`px-3 py-2 rounded-xl text-[12px] font-bold transition-colors touch-manipulation ${
                      poolInput === String(gb) ? 'bg-[#5D5FEF] text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                    }`}
                  >
                    {gb} GB
                  </button>
                ))}
                <button
                  onClick={() => setPoolInput('')}
                  className={`px-3 py-2 rounded-xl text-[12px] font-bold transition-colors touch-manipulation ${
                    poolInput === '' ? 'bg-[#5D5FEF] text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                  }`}
                >
                  No Limit
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-6 pt-2">
              <button
                onClick={handleSavePool}
                disabled={savingPool}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#5D5FEF] active:bg-[#4D4FCF] disabled:opacity-50 text-white text-[15px] font-bold rounded-2xl transition-colors touch-manipulation"
              >
                {savingPool ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Pool Settings
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══════════ Storage Request Resolve Sheet ═══════════ */}
      {resolvePopup && createPortal(
        <div className="fixed inset-0 z-[700]" onClick={() => { setResolvePopup(null); setResolveNote(''); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 safe-area-bottom max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center">
                  <HardDrive className="w-4.5 h-4.5 text-[#5D5FEF]" />
                </div>
                <div>
                  <h2 className="text-[17px] font-extrabold text-gray-900">Storage Request</h2>
                  <p className="text-[11px] text-gray-400">Review and respond</p>
                </div>
              </div>
              <button onClick={() => { setResolvePopup(null); setResolveNote(''); }} className="p-2 -mr-2 active:bg-gray-100 rounded-xl transition-colors touch-manipulation">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-4">
              {/* Requester info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#5D5FEF] to-[#7B7DF4] flex items-center justify-center">
                    <span className="text-white font-bold text-[11px]">
                      {resolvePopup.userName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900 truncate">{resolvePopup.userName}</p>
                    <p className="text-[11px] text-gray-400 truncate">{resolvePopup.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2.5 px-3.5 bg-white rounded-lg border border-gray-100">
                  <span className="text-[11px] font-bold text-gray-500">Requesting</span>
                  <span className="text-[15px] font-extrabold text-[#5D5FEF]">+{resolvePopup.requestedHuman}</span>
                </div>
              </div>

              {/* Reason */}
              {resolvePopup.reason && (
                <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100/50">
                  <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider mb-1">Reason</p>
                  <p className="text-[13px] text-gray-600 leading-relaxed">"{resolvePopup.reason}"</p>
                </div>
              )}

              {/* Admin note */}
              <div>
                <label className="text-[12px] font-bold text-gray-500 mb-1.5 block">Note (optional)</label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Add a message for the member..."
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[14px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-6 pt-1">
              {resolvingRequestId === resolvePopup.id ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-[#5D5FEF] animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={async () => {
                      await handleResolveRequest(resolvePopup.id, 'deny', resolveNote || undefined);
                      setResolvePopup(null);
                      setResolveNote('');
                    }}
                    className="py-3.5 bg-red-500 text-white rounded-2xl font-bold text-[13px] active:bg-red-600 transition-all flex items-center justify-center gap-1.5 touch-manipulation"
                  >
                    <XCircle className="w-4 h-4" />
                    Deny
                  </button>
                  <button
                    onClick={async () => {
                      await handleResolveRequest(resolvePopup.id, 'approve', resolveNote || undefined);
                      setResolvePopup(null);
                      setResolveNote('');
                    }}
                    className="py-3.5 bg-[#5D5FEF] text-white rounded-2xl font-bold text-[13px] active:bg-[#4D4FCF] transition-all flex items-center justify-center gap-1.5 touch-manipulation"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MobileFamilySharingView;
