import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  MoreVertical,
  Trash2,
  Edit3,
  Search,
  Crown,
  Eye,
  Pencil,
  Loader2,
  X,
  Check,
  Send,
  Settings,
  Database,
  Gauge,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  HardDrive,
  CheckCircle2,
  XCircle,
  ChevronRight,
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
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
  adminNote: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  familyMemberId: number | null;
}

interface FamilySharingViewProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
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
      return { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' };
    case 'pending':
      return { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' };
    case 'disabled':
      return { bg: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-500' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' };
  }
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'admin':
      return <Crown className="w-3.5 h-3.5" />;
    case 'editor':
      return <Pencil className="w-3.5 h-3.5" />;
    default:
      return <Eye className="w-3.5 h-3.5" />;
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
   Component
   ═══════════════════════════════════════════════════ */

const FamilySharingView: React.FC<FamilySharingViewProps> = ({ showToast }) => {
  /* ───── State ───── */
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [stats, setStats] = useState<FamilyStats | null>(null);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pool settings modal
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

  // Context menu
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<FamilyMember | null>(null);

  // Storage requests
  const [storageRequests, setStorageRequests] = useState<StorageRequest[]>([]);
  const [resolvingRequestId, setResolvingRequestId] = useState<number | null>(null);
  const [resolvePopup, setResolvePopup] = useState<StorageRequest | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  /* ───── Data loading ───── */

  const loadData = useCallback(async () => {
    try {
      const [membersRes, statsRes, poolRes, requestsRes] = await Promise.all([
        apiFetch('/api/family/members'),
        apiFetch('/api/family/stats'),
        apiFetch('/api/family/pool'),
        fetch('/api/storage/requests', { headers: authHeaders() }).then(r => r.json()).catch(() => ({ requests: [] })),
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

  const handleResolveRequest = async (requestId: number, action: 'approve' | 'deny', note?: string) => {
    setResolvingRequestId(requestId);
    try {
      const res = await fetch(`/api/storage/requests/${requestId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ action, note }),
      });
      if (res.ok) {
        setStorageRequests(prev => prev.filter(r => r.id !== requestId));
        showToast?.(action === 'approve' ? 'Storage request approved' : 'Storage request denied', action === 'approve' ? 'success' : 'info');
        loadData(); // refresh member quotas
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
      setRemoveConfirm(null);
      loadData();
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    } finally {
      setDeleting(null);
      setMenuOpen(null);
    }
  };

  const handleToggleStatus = async (m: FamilyMember) => {
    const newStatus = m.status === 'active' ? 'disabled' : 'active';
    setToggling(m.id);
    setMenuOpen(null);
    try {
      await apiFetch(`/api/family/members/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: m.name, role: m.role, storageQuota: m.storageQuota, status: newStatus, notes: m.notes }),
      });
      showToast?.(newStatus === 'disabled' ? `${m.name} suspended` : `${m.name} reactivated`, 'success');
      loadData();
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    } finally {
      setToggling(null);
    }
  };

  const handleResend = async (id: number) => {
    try {
      await apiFetch(`/api/family/resend-invite/${id}`, { method: 'POST' });
      showToast?.('Invite resent', 'success');
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    }
    setMenuOpen(null);
  };

  const openEdit = (m: FamilyMember) => {
    setEditMember(m);
    setEditName(m.name);
    setEditRole(m.role);
    setEditQuota(m.storageQuota);
    setEditNotes(m.notes || '');
    setEditStatus(m.status);
    setMenuOpen(null);
  };

  const openPoolSettings = () => {
    if (poolInfo) {
      setPoolInput(poolInfo.poolSize > 0 ? String(Math.round(poolInfo.poolSize / (1024 * 1024 * 1024))) : '');
    }
    setShowPoolSettings(true);
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

  /* ── Pool-aware quota options ── */
  const getAvailableQuotaOptions = (excludeCurrentQuota = 0) => {
    if (!poolInfo || poolInfo.poolSize === 0) return QUOTA_OPTIONS;
    const avail = poolInfo.available + excludeCurrentQuota;
    return QUOTA_OPTIONS.filter(q => q.value <= avail);
  };

  /* ── Get pending request for a specific member ── */
  const getMemberRequest = (memberId: number): StorageRequest | undefined => {
    return storageRequests.find(r => r.familyMemberId === memberId);
  };

  /* ───── Filtered list ───── */

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  );

  /* ═══════════════════════════════════
     Render
     ═══════════════════════════════════ */

  return (
    <div className="w-full">
      {/* ─── Header — matches FilesView gradient bar style ─── */}
      <div className="flex flex-row items-center justify-between mb-6 sm:mb-8 md:mb-10 gap-3 sm:gap-4">
        <div className="relative flex-1 min-w-0">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative">
            Family Sharing
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-36 sm:w-48 pl-9 pr-3 py-2 sm:py-2.5 md:py-3 bg-white border border-gray-100 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
            />
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 bg-[#5D5FEF] hover:bg-[#4D4FCF] text-white rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-[#5D5FEF]/20"
          >
            <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Invite Member</span>
            <span className="sm:hidden">Invite</span>
          </button>
        </div>
      </div>

      {/* ─── Storage Pool & Overview ─── */}
      {poolInfo && (() => {
        const hasPool = poolInfo.poolSize > 0;
        const allocPct = hasPool ? Math.round((poolInfo.allocated / poolInfo.poolSize) * 100) : 0;
        const remainingAvailable = hasPool ? Math.max(poolInfo.diskAvailable - poolInfo.poolSize, 0) : poolInfo.diskAvailable;
        return (
          <div className="mb-8 sm:mb-10 md:mb-14 space-y-3 sm:space-y-4">
            {/* Pool Configuration Card */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-5 sm:p-6 md:p-7 shadow-sm">
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
                <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-[#5D5FEF] flex items-center justify-center shadow-md shadow-[#5D5FEF]/20">
                  <Database className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm sm:text-base md:text-lg font-black text-gray-900 block">Storage Pool</span>
                  <span className="text-[11px] sm:text-xs md:text-sm font-medium text-gray-400">
                    {hasPool
                      ? `${formatBytes(poolInfo.poolSize)} shareable · ${formatBytes(remainingAvailable)} remaining`
                      : `${formatBytes(poolInfo.diskAvailable)} available · No pool configured`}
                  </span>
                </div>
                <button
                  onClick={openPoolSettings}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configure
                </button>
              </div>

              {hasPool ? (
                <>
                  {/* Pool allocation bar */}
                  <div className="mb-4 sm:mb-5">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-gray-400 mb-1.5">
                      <span>{formatBytes(poolInfo.allocated)} allocated</span>
                      <span>{formatBytes(poolInfo.available)} available</span>
                    </div>
                    <div className="h-2.5 sm:h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#5D5FEF] to-[#7B7DF4] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(allocPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Pool detail boxes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-gray-50/80 rounded-lg sm:rounded-xl p-3 sm:p-3.5">
                      <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pool Size</p>
                      <p className="text-sm sm:text-base md:text-lg font-black text-gray-800">{formatBytes(poolInfo.poolSize)}</p>
                    </div>
                    <div className="bg-gray-50/80 rounded-lg sm:rounded-xl p-3 sm:p-3.5">
                      <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Allocated</p>
                      <p className="text-sm sm:text-base md:text-lg font-black text-[#5D5FEF]">{formatBytes(poolInfo.allocated)}</p>
                    </div>
                    <div className="bg-gray-50/80 rounded-lg sm:rounded-xl p-3 sm:p-3.5">
                      <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Available</p>
                      <p className="text-sm sm:text-base md:text-lg font-black text-emerald-600">{formatBytes(poolInfo.available)}</p>
                    </div>
                    <div className="bg-gray-50/80 rounded-lg sm:rounded-xl p-3 sm:p-3.5">
                      <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Remaining</p>
                      <p className="text-sm sm:text-base md:text-lg font-black text-gray-800">{formatBytes(remainingAvailable)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-[#5D5FEF]/5 border border-[#5D5FEF]/10 rounded-xl">
                  <Gauge className="w-5 h-5 text-[#5D5FEF] flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-[#5D5FEF]/80 font-medium">
                    Configure a storage pool to control how much of your available space ({formatBytes(poolInfo.diskAvailable)}) is shareable with family members.
                  </p>
                </div>
              )}
            </div>


          </div>
        );
      })()}

      {/* ─── Members List ─── */}
      <div className="mb-6 sm:mb-8">
        <p className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] mb-4 sm:mb-6 md:mb-8 ml-1">
          Members
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#5D5FEF] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-30">
            <Users className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-4">
              {members.length === 0 ? 'No Family Members Yet' : 'No Results Found'}
            </p>
            {members.length === 0 && (
              <button
                onClick={() => setShowInvite(true)}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-[#5D5FEF] hover:bg-[#4D4FCF] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors opacity-100"
                style={{ opacity: 1 }}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite Your First Member
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map((m) => {
              const sc = getStatusColor(m.status);
              const quotaPercent = m.storageQuota > 0 ? Math.round((m.storageUsed / m.storageQuota) * 100) : 0;

              return (
                <div
                  key={m.id}
                  className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group relative"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Avatar */}
                    {m.avatarUrl ? (
                      <img
                        src={m.avatarUrl}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl object-cover border border-gray-100 flex-shrink-0"
                        alt={`${m.name} avatar`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#5D5FEF] to-[#7B7DF4] flex items-center justify-center flex-shrink-0 shadow-sm ${m.avatarUrl ? 'hidden' : ''}`}>
                      <span className="text-white font-black text-xs sm:text-sm">{getInitials(m.name)}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-[15px] font-black text-gray-900 truncate">{m.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {m.status}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-gray-400 truncate mt-0.5">{m.email}</p>
                    </div>

                    {/* Role badge + Actions */}
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-gray-500 bg-gray-50 px-2 sm:px-2.5 py-1 rounded-lg flex-shrink-0">
                      {getRoleIcon(m.role)}
                      {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                    </span>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                        className="p-1.5 sm:p-2 hover:bg-gray-50 rounded-lg sm:rounded-xl transition-colors text-gray-400 hover:text-gray-600"
                      >
                        <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      {menuOpen === m.id && (
                        <div className="absolute right-0 top-9 sm:top-10 w-48 bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 py-1.5 sm:py-2 z-50">
                          <button
                            onClick={() => openEdit(m)}
                            className="flex items-center gap-3 w-full px-4 py-2 sm:py-2.5 hover:bg-gray-50 text-xs sm:text-sm text-gray-700 font-medium"
                          >
                            <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" /> Edit Member
                          </button>
                          {m.status === 'pending' && (
                            <button
                              onClick={() => handleResend(m.id)}
                              className="flex items-center gap-3 w-full px-4 py-2 sm:py-2.5 hover:bg-gray-50 text-xs sm:text-sm text-gray-700 font-medium"
                            >
                              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" /> Resend Invite
                            </button>
                          )}
                          {m.status !== 'pending' && (
                            <button
                              onClick={() => handleToggleStatus(m)}
                              disabled={toggling === m.id}
                              className="flex items-center gap-3 w-full px-4 py-2 sm:py-2.5 hover:bg-amber-50 text-xs sm:text-sm text-amber-600 font-medium"
                            >
                              {toggling === m.id ? (
                                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                              ) : m.status === 'active' ? (
                                <PauseCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              ) : (
                                <PlayCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                              )}
                              <span className={m.status === 'disabled' ? 'text-emerald-600' : ''}>
                                {m.status === 'active' ? 'Suspend' : 'Reactivate'}
                              </span>
                            </button>
                          )}
                          <div className="my-1 border-t border-gray-50" />
                          <button
                            onClick={() => { setRemoveConfirm(m); setMenuOpen(null); }}
                            className="flex items-center gap-3 w-full px-4 py-2 sm:py-2.5 hover:bg-red-50 text-xs sm:text-sm text-red-500 font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Storage row below user info */}
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-gray-400 mb-1">
                        <span>{formatBytes(m.storageUsed)} used</span>
                        <span>{formatBytes(m.storageQuota)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#5D5FEF] to-[#7B7DF4] rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(quotaPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Storage Request Badge */}
                  {(() => {
                    const memberReq = getMemberRequest(m.id);
                    if (!memberReq) return null;
                    return (
                      <button
                        onClick={() => { setResolvePopup(memberReq); setResolveNote(''); }}
                        className="mt-2 sm:mt-3 w-full flex items-center gap-2 px-3 py-2 bg-[#5D5FEF]/5 hover:bg-[#5D5FEF]/10 border border-[#5D5FEF]/15 rounded-lg sm:rounded-xl transition-all group/req"
                      >
                        <div className="w-6 h-6 rounded-lg bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
                          <HardDrive className="w-3 h-3 text-[#5D5FEF]" />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold text-[#5D5FEF] truncate">
                          Storage request: +{memberReq.requestedHuman}
                        </span>
                        <ChevronRight className="w-3 h-3 text-[#5D5FEF]/50 ml-auto flex-shrink-0 group-hover/req:translate-x-0.5 transition-transform" />
                      </button>
                    );
                  })()}

                  {m.notes && (
                    <p className="text-[10px] sm:text-[11px] text-gray-400 mt-2 sm:mt-3 truncate">{m.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════ Invite Modal ═══════════ */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-black text-gray-900">Invite Member</h2>
                <p className="text-xs text-gray-400 mt-0.5">Add a family member to share your server</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. sarah@example.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 appearance-none"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">Storage Quota</label>
                  <select
                    value={inviteQuota}
                    onChange={(e) => setInviteQuota(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 appearance-none"
                  >
                    {getAvailableQuotaOptions().map((q) => (
                      <option key={q.value} value={q.value}>{q.label}</option>
                    ))}
                  </select>
                  {poolInfo && poolInfo.poolSize > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">{formatBytes(poolInfo.available)} available in pool</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Notes <span className="text-gray-300">(optional)</span></label>
                <input
                  type="text"
                  value={inviteNotes}
                  onChange={(e) => setInviteNotes(e.target.value)}
                  placeholder="e.g. My sister"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowInvite(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#5D5FEF] hover:bg-[#4D4FCF] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Edit Modal ═══════════ */}
      {editMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#5D5FEF] to-[#7B7DF4] flex items-center justify-center">
                  <span className="text-white font-black text-sm">{getInitials(editMember.name)}</span>
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">Edit Member</h2>
                  <p className="text-xs text-gray-400">{editMember.email}</p>
                </div>
              </div>
              <button onClick={() => setEditMember(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 appearance-none"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 appearance-none"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Storage Quota</label>
                <select
                  value={editQuota}
                  onChange={(e) => setEditQuota(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 appearance-none"
                >
                  {getAvailableQuotaOptions(editMember?.storageQuota ?? 0).map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                  {/* Always include current quota so it's selectable */}
                  {editMember && !getAvailableQuotaOptions(editMember.storageQuota).find(q => q.value === editMember.storageQuota) && (
                    <option value={editMember.storageQuota}>{formatBytes(editMember.storageQuota)} (current)</option>
                  )}
                </select>
                {poolInfo && poolInfo.poolSize > 0 && editMember && (
                  <p className="text-[10px] text-gray-400 mt-1">{formatBytes(poolInfo.available + (editMember.storageQuota))} available in pool</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setEditMember(null)}
                className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#5D5FEF] hover:bg-[#4D4FCF] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Remove Confirmation Modal ═══════════ */}
      {removeConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200 p-8">
            <div className="flex items-center justify-center mb-5">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
            </div>
            <h3 className="text-lg font-black text-gray-900 text-center mb-2">Remove Member?</h3>
            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              <span className="font-bold text-gray-700">{removeConfirm.name}</span> ({removeConfirm.email}) will be removed from your family. Their invite will be revoked and they will no longer have access.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRemoveConfirm(null)}
                className="py-3 bg-gray-100 text-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(removeConfirm.id)}
                disabled={deleting === removeConfirm.id}
                className="py-3 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting === removeConfirm.id ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Removing…</>
                ) : (
                  'Remove'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Storage Request Popup ═══════════ */}
      {resolvePopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-[#5D5FEF]" />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900">Storage Request</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">Review and respond</p>
                </div>
              </div>
              <button onClick={() => { setResolvePopup(null); setResolveNote(''); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4">
              {/* Requester info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5D5FEF] to-[#7B7DF4] flex items-center justify-center">
                    <span className="text-white font-black text-[10px]">
                      {resolvePopup.userName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{resolvePopup.userName}</p>
                    <p className="text-[11px] text-gray-400">{resolvePopup.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100">
                  <span className="text-[11px] font-bold text-gray-500">Requesting</span>
                  <span className="text-sm font-black text-[#5D5FEF]">+{resolvePopup.requestedHuman}</span>
                </div>
              </div>

              {/* Reason */}
              {resolvePopup.reason && (
                <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100/50">
                  <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider mb-1">Reason</p>
                  <p className="text-xs text-gray-600 leading-relaxed">"{resolvePopup.reason}"</p>
                </div>
              )}

              {/* Admin note */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">Note (optional)</label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Add a message for the member..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6">
              {resolvingRequestId === resolvePopup.id ? (
                <div className="flex items-center justify-center py-3">
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
                    className="py-3 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Deny
                  </button>
                  <button
                    onClick={async () => {
                      await handleResolveRequest(resolvePopup.id, 'approve', resolveNote || undefined);
                      setResolvePopup(null);
                      setResolveNote('');
                    }}
                    className="py-3 bg-[#5D5FEF] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#4B4DD9] transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Pool Settings Modal ═══════════ */}
      {showPoolSettings && poolInfo && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-black text-gray-900">Storage Pool Settings</h2>
                <p className="text-xs text-gray-400 mt-0.5">Share from your available disk space</p>
              </div>
              <button onClick={() => setShowPoolSettings(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Info */}
            <div className="px-6 py-5 space-y-4">
              {/* Disk info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-400 font-bold mb-0.5">Total Disk</p>
                    <p className="text-gray-800 font-black text-base">{formatBytes(poolInfo.diskTotal)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-bold mb-0.5">Disk Used</p>
                    <p className="text-gray-800 font-black text-base">{formatBytes(poolInfo.diskUsed)}</p>
                  </div>
                  <div>
                    <p className="text-[#5D5FEF] font-bold mb-0.5">Available Space</p>
                    <p className="text-[#5D5FEF] font-black text-base">{formatBytes(poolInfo.diskAvailable)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-bold mb-0.5">Member Allocated</p>
                    <p className="text-gray-800 font-black text-base">{formatBytes(poolInfo.allocated)}</p>
                  </div>
                </div>
              </div>

              {/* Pool size input */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Shareable Pool Size (GB)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={poolInput}
                    onChange={(e) => setPoolInput(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF]/30 pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">GB</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  {poolInput.trim()
                    ? `${poolInput} GB shareable from ${formatBytes(poolInfo.diskAvailable)} available · ${formatBytes(Math.max(poolInfo.diskAvailable - parseFloat(poolInput || '0') * 1024 * 1024 * 1024, 0))} remains`
                    : 'Enter 0 or leave blank to disable the pool (no limit on allocations)'}
                </p>
                {poolInfo.allocated > 0 && (
                  <p className="text-[10px] text-[#5D5FEF]/70 mt-1">
                    Minimum: {formatBytes(poolInfo.allocated)} (already allocated to members)
                  </p>
                )}
              </div>

              {/* Quick presets */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Quick Set</label>
                <div className="flex flex-wrap gap-2">
                  {[10, 25, 50, 100, 200, 500].filter(v => v * 1024 * 1024 * 1024 <= poolInfo.diskAvailable).map(gb => (
                    <button
                      key={gb}
                      onClick={() => setPoolInput(String(gb))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        poolInput === String(gb) ? 'bg-[#5D5FEF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {gb} GB
                    </button>
                  ))}
                  <button
                    onClick={() => setPoolInput('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      poolInput === '' ? 'bg-[#5D5FEF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    No Limit
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowPoolSettings(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePool}
                disabled={savingPool}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#5D5FEF] hover:bg-[#4D4FCF] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {savingPool ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Pool Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close menu on outside click */}
      {menuOpen !== null && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
      )}
    </div>
  );
};

export default FamilySharingView;
