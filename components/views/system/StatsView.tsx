import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Files,
  Image,
  Film,
  Music,
  Database,
  Download,
  RotateCw,
  Check,
  FileText,
  Shield
} from 'lucide-react';
import type { VaultAnalytics } from '@/types';

const ANALYTICS_API = '/api/vault/analytics';
const AUDIT_API = '/api/vault/audit';
const REFRESH_INTERVAL_MS = 30_000;

function useVaultAnalytics() {
  const [data, setData] = useState<VaultAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setError(false);
      const res = await fetch(ANALYTICS_API);
      if (!res.ok) throw new Error('Analytics API error');
      const json: VaultAnalytics = await res.json();
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const id = setInterval(fetchAnalytics, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchAnalytics]);

  return { data, loading, error, refetch: fetchAnalytics };
}

const StatsView: React.FC = () => {
  const { data, loading, error, refetch } = useVaultAnalytics();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 2000);
    }, 500);
  };

  const handleExportAudit = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const res = await fetch(AUDIT_API);
      if (!res.ok) throw new Error('Failed to generate audit');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `vault-audit-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // Export failure — non-critical
    } finally {
      setIsExporting(false);
    }
  };

  const getCategoryIcon = (label: string) => {
    switch (label) {
      case 'Photos': return <Image className="w-5 h-5" />;
      case 'Videos': return <Film className="w-5 h-5" />;
      case 'Music': return <Music className="w-5 h-5" />;
      case 'Files': return <FileText className="w-5 h-5" />;
      default: return <Files className="w-5 h-5" />;
    }
  };

  const getCategoryGradient = (label: string) => {
    switch (label) {
      case 'Photos': return { from: 'from-blue-500', to: 'to-sky-600', shadow: 'shadow-blue-500/25', bar: 'from-blue-400 to-sky-500', badge: 'bg-blue-100 text-blue-700' };
      case 'Videos': return { from: 'from-purple-500', to: 'to-violet-600', shadow: 'shadow-purple-500/25', bar: 'from-purple-400 to-violet-500', badge: 'bg-purple-100 text-purple-700' };
      case 'Music': return { from: 'from-pink-500', to: 'to-rose-600', shadow: 'shadow-pink-500/25', bar: 'from-pink-400 to-rose-500', badge: 'bg-pink-100 text-pink-700' };
      case 'Files': return { from: 'from-emerald-500', to: 'to-green-600', shadow: 'shadow-emerald-500/25', bar: 'from-emerald-400 to-green-500', badge: 'bg-emerald-100 text-emerald-700' };
      default: return { from: 'from-gray-500', to: 'to-gray-600', shadow: 'shadow-gray-500/25', bar: 'from-gray-400 to-gray-500', badge: 'bg-gray-100 text-gray-700' };
    }
  };

  const healthIndex = data?.healthIndex || { grade: 'N/A', status: 'Loading', efficiency: 0 };
  const categories = data?.categories || [];
  const totalFiles = data?.totalFiles || 0;
  const totalSizeHuman = data?.totalSizeHuman || '0 B';

  // Calculate storage percentage from utilization array
  const currentStorageUtil = data?.storageUtilization?.[data.storageUtilization.length - 1] || 0;

  return (
    <div className="w-full">
      {/* Header with Divider */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="relative">
            <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative">
              Vault Intelligence
              <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportAudit}
              disabled={isExporting || loading}
              className="px-4 py-2.5 rounded-xl text-[13px] font-bold bg-white text-gray-600 border border-gray-100 hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className={`px-5 py-2.5 rounded-xl text-[13px] font-bold shadow-lg transition-all flex items-center gap-2 ${
                refreshSuccess
                  ? 'bg-green-500 text-white'
                  : 'bg-[#5D5FEF] text-white hover:bg-[#4D4FCF] disabled:opacity-50'
              }`}
            >
              {isRefreshing ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : refreshSuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <RotateCw className="w-4 h-4" />
              )}
              {isRefreshing ? 'Syncing...' : refreshSuccess ? 'Synced!' : 'Refresh'}
            </button>
          </div>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">Real-time storage analytics and health monitoring</p>
      </div>

      {loading && (
        <div className="text-center py-16">
          <RotateCw className="w-8 h-8 text-[#5D5FEF] animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400 font-bold">Loading analytics...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-16">
          <p className="text-sm text-red-400 font-bold">Failed to load analytics</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Top Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {/* Total Files */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Files className="w-5 h-5 text-white" />
                </div>
                <div className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">
                  Tracked
                </div>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{totalFiles.toLocaleString()}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Total Files</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">Categories</span>
                  <span className="text-[10px] sm:text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{categories.length}</span>
                </div>
              </div>
            </div>

            {/* Storage Used */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Vault</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{totalSizeHuman}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Storage Used</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all duration-500"
                    style={{ width: `${Math.min(currentStorageUtil, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">Used</span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400">{currentStorageUtil}%</span>
                </div>
              </div>
            </div>

            {/* Disk Usage */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <HardDrive className="w-5 h-5 text-white" />
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  currentStorageUtil > 90 ? 'bg-red-100 text-red-700' : currentStorageUtil > 70 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {currentStorageUtil > 90 ? 'Critical' : currentStorageUtil > 70 ? 'Warning' : 'Normal'}
                </div>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{currentStorageUtil}<span className="text-lg text-gray-300 font-bold">%</span></p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Disk Usage</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${
                      currentStorageUtil > 90 ? 'from-red-400 to-red-500' : 'from-amber-400 to-orange-500'
                    } transition-all duration-500`}
                    style={{ width: `${currentStorageUtil}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">Capacity</span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400">{100 - currentStorageUtil}% free</span>
                </div>
              </div>
            </div>

            {/* Health Index */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                  healthIndex.grade === 'A+' || healthIndex.grade === 'A'
                    ? 'from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25'
                    : healthIndex.grade === 'B'
                    ? 'from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/25'
                    : 'from-amber-500 to-yellow-600 shadow-lg shadow-amber-500/25'
                } flex items-center justify-center`}>
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  healthIndex.grade === 'A+' || healthIndex.grade === 'A'
                    ? 'bg-emerald-100 text-emerald-700'
                    : healthIndex.grade === 'B'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {healthIndex.status}
                </div>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{healthIndex.grade}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Health Index</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${
                      healthIndex.grade === 'A+' || healthIndex.grade === 'A'
                        ? 'from-emerald-400 to-green-500'
                        : healthIndex.grade === 'B'
                        ? 'from-blue-400 to-cyan-500'
                        : 'from-amber-400 to-yellow-500'
                    } transition-all duration-500`}
                    style={{ width: `${healthIndex.efficiency}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">Efficiency</span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400">{healthIndex.efficiency}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Storage Breakdown & System Health — side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Category Breakdown */}
            <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-wider">Storage Breakdown</h2>
                <span className="text-[11px] font-bold text-gray-400">{categories.length} Categories</span>
              </div>

              <div className="space-y-5">
                {categories.map((cat, idx) => {
                  const gradient = getCategoryGradient(cat.label);
                  return (
                    <div key={idx} className="group">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient.from} ${gradient.to} flex items-center justify-center shadow-lg ${gradient.shadow}`}>
                            <div className="text-white">{getCategoryIcon(cat.label)}</div>
                          </div>
                          <div>
                            <p className="text-[14px] font-black text-gray-900">{cat.label}</p>
                            <p className="text-[11px] text-gray-500 font-medium">{cat.count.toLocaleString()} files · {cat.sizeHuman}</p>
                          </div>
                        </div>
                        <span className="text-[13px] font-black text-gray-400">{cat.percentage}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${gradient.bar} transition-all duration-1000`}
                          style={{ width: `${Math.max(cat.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {categories.length === 0 && (
                <div className="text-center py-8">
                  <Files className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-400">No files stored yet</p>
                </div>
              )}
            </div>

            {/* System Health */}
            <div className="bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/10 rounded-full blur-[80px]" />
              <div className="relative z-10">
                <h2 className="text-[11px] font-black text-white/60 uppercase tracking-wider mb-6">System Health</h2>

                <div className="text-center py-8 mb-6">
                  <div className="text-7xl font-black mb-2">{healthIndex.grade}</div>
                  <p className="text-sm font-bold text-white/80">{healthIndex.status}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-white/60 mb-2">
                      <span>EFFICIENCY</span>
                      <span>{healthIndex.efficiency}%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-1000"
                        style={{ width: `${healthIndex.efficiency}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-white/60 mb-2">
                      <span>STORAGE</span>
                      <span>{100 - currentStorageUtil}% free</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-1000"
                        style={{ width: `${100 - currentStorageUtil}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Storage Trend */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-6 sm:p-8 pb-8 sm:pb-10 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-wider">Storage Utilization Trend</h2>
                <span className="text-[11px] font-bold text-gray-400">Last 12 Periods</span>
              </div>

              <div className="flex items-end gap-2 h-56">
                {(data?.storageUtilization || []).map((util, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full bg-gray-50 rounded-t-xl relative group hover:bg-[#5D5FEF]/10 transition-all cursor-pointer"
                    title={`Period ${i + 1}: ${util}%`}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-[#5D5FEF]/20 rounded-t-xl transition-all duration-500 group-hover:bg-[#5D5FEF]"
                      style={{ height: `${util}%` }}
                    />
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                      {util}%
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-[10px] font-bold text-gray-300 mt-4">
                <span>Period 1</span>
                <span>Period 6</span>
                <span>Current</span>
              </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StatsView;
