import React, { useState, useEffect, useCallback } from 'react';
import {
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  LogOut,
  Loader2,
  Shield,
  Clock,
  Globe,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Wifi,
} from 'lucide-react';
import { authApi } from '@/services/api.client';

interface DeviceSession {
  id: number;
  deviceName: string;
  deviceType: string;
  ipAddress: string | null;
  isCurrent: boolean;
  isCurrentHost: boolean;
  lastActivity: string;
  createdAt: string;
}

function getDeviceIcon(deviceType: string) {
  switch (deviceType) {
    case 'mobile': return Smartphone;
    case 'tablet': return Tablet;
    case 'desktop': return Monitor;
    default: return Laptop;
  }
}

function getTimeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Active now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

interface SessionsViewProps {
  onNavigate?: (tab: string) => void;
}

const SessionsView: React.FC<SessionsViewProps> = ({ onNavigate }) => {
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await authApi.getSessions();
      setDevices(data.sessions || []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (sessionId: number) => {
    setRevokingId(sessionId);
    try {
      await authApi.revokeSession(sessionId);
      setDevices(prev => prev.filter(d => d.id !== sessionId));
    } catch {
      // Keep list as is
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokeAllLoading(true);
    try {
      const others = devices.filter(d => !d.isCurrent);
      for (const d of others) {
        await authApi.revokeSession(d.id);
      }
      setDevices(prev => prev.filter(d => d.isCurrent));
      setConfirmRevokeAll(false);
    } catch {
      // partial revoke is fine
    } finally {
      setRevokeAllLoading(false);
    }
  };

  const currentDevice = devices.find(d => d.isCurrent);
  const otherDevices = devices.filter(d => !d.isCurrent);
  const hostDevice = devices.find(d => d.isCurrentHost);

  return (
    <div className="max-w-[1600px] mx-auto w-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 md:mb-8 pb-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 md:h-10 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full flex-shrink-0" />
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 tracking-tight">Sessions</h1>
            <p className="text-sm text-gray-500 mt-1">Manage devices signed in to your account</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => loadSessions(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#5D5FEF] text-white rounded-xl font-bold text-[12px] hover:bg-[#4B4DD4] transition-all active:scale-95 disabled:opacity-50 shadow-sm shadow-[#5D5FEF]/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Stats row */}
      {!loading && devices.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-600 flex items-center justify-center shadow-lg shadow-[#5D5FEF]/25">
                <Wifi className="w-5 h-5 text-white" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">Online</span>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{devices.length}</p>
            <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Active Sessions</p>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600">All sessions healthy</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Primary</span>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{hostDevice ? 1 : 0}</p>
            <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Host Device</p>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400">{hostDevice?.deviceName || 'Not detected'}</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Globe className="w-5 h-5 text-white" />
              </div>
              {otherDevices.length > 0 && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">{otherDevices.length} active</span>
              )}
            </div>
            <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{otherDevices.length}</p>
            <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Other Devices</p>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400">{otherDevices.length === 0 ? 'Only this device' : `${otherDevices.length} remote connection${otherDevices.length !== 1 ? 's' : ''}`}</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Recent</span>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none truncate">
              {currentDevice ? getTimeAgo(currentDevice.lastActivity) : '—'}
            </p>
            <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Last Activity</p>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400">{currentDevice ? currentDevice.deviceName : 'No activity'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Current Device Card */}
      {!loading && currentDevice && (() => {
        const DeviceIcon = getDeviceIcon(currentDevice.deviceType);
        return (
          <div className="rounded-2xl sm:rounded-3xl bg-[#1d1d1f] border border-[#2d2d2f] shadow-xl shadow-black/10 overflow-hidden relative mb-6">
            <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#5D5FEF]/15 blur-3xl" />
            <div className="p-6 md:p-8 relative z-10">
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle2 className="w-4 h-4 text-[#8B8DF8]" />
                <span className="text-[10px] font-black text-[#8B8DF8] uppercase tracking-widest">Current Device</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                    <DeviceIcon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-heading font-bold text-white">{currentDevice.deviceName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-white/50">
                        <Clock className="w-3 h-3" />
                        {getTimeAgo(currentDevice.lastActivity)}
                      </span>
                      {currentDevice.ipAddress && (
                        <span className="flex items-center gap-1 text-xs text-white/50">
                          <Globe className="w-3 h-3" />
                          {currentDevice.ipAddress}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-white/50">
                        <Shield className="w-3 h-3" />
                        {currentDevice.isCurrentHost ? 'Primary host' : 'Trusted device'}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/30 mt-1">
                      Signed in {formatDate(currentDevice.createdAt)}
                    </p>
                  </div>
                </div>
                <span className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-[#8B8DF8] bg-[#5D5FEF]/15 border border-[#5D5FEF]/30 shrink-0 text-center">
                  Active session
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Other Devices */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl sm:rounded-t-3xl">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Other devices</span>
          {otherDevices.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">{otherDevices.length} device{otherDevices.length !== 1 ? 's' : ''}</span>
              {!confirmRevokeAll ? (
                <button
                  type="button"
                  onClick={() => setConfirmRevokeAll(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                >
                  <LogOut className="w-3 h-3" />
                  Revoke all
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-red-500">Are you sure?</span>
                  <button
                    type="button"
                    onClick={handleRevokeAll}
                    disabled={revokeAllLoading}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50"
                  >
                    {revokeAllLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, revoke'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeAll(false)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
          ) : otherDevices.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-base font-bold text-gray-500">No other devices</p>
              <p className="text-sm text-gray-400 mt-1">Only this device is currently signed in.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {otherDevices.map((device) => {
                const DeviceIcon = getDeviceIcon(device.deviceType);
                return (
                  <div
                    key={device.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-[#5D5FEF]/20 hover:shadow-md transition-all gap-3 sm:gap-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm text-gray-400">
                        <DeviceIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-gray-900">{device.deviceName}</p>
                          {device.isCurrentHost && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">Host</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(device.lastActivity)}
                          </span>
                          {device.ipAddress && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Globe className="w-3 h-3" />
                              {device.ipAddress}
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400">
                            Since {formatDate(device.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(device.id)}
                      disabled={revokingId === device.id}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-red-500 hover:bg-red-50 border border-gray-100 hover:border-red-100 transition-all disabled:opacity-50 shrink-0"
                    >
                      {revokingId === device.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Revoking...</>
                      ) : (
                        <><LogOut className="w-3.5 h-3.5" /> Revoke</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Security Tip */}
      {!loading && otherDevices.length > 0 && (
        <div className="mt-6 flex items-start gap-3 px-5 py-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">Security Reminder</p>
            <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
              If you don't recognize a device, revoke its access immediately and change your password in Account Settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsView;
