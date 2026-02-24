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

  const getCategoryColor = (label: string): { icon: string; bar: string; bg: string } => {
    switch (label) {
      case 'Photos': return { icon: 'text-blue-500', bar: 'bg-blue-400', bg: 'bg-blue-50' };
      case 'Videos': return { icon: 'text-[#5D5FEF]', bar: 'bg-[#5D5FEF]', bg: 'bg-[#5D5FEF]/10' };
      case 'Music': return { icon: 'text-pink-500', bar: 'bg-pink-400', bg: 'bg-pink-50' };
      case 'Files': return { icon: 'text-emerald-500', bar: 'bg-emerald-400', bg: 'bg-emerald-50' };
      default: return { icon: 'text-gray-500', bar: 'bg-gray-400', bg: 'bg-gray-100' };
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
      {/* Action bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] font-medium text-gray-400">Real-time storage analytics and health monitoring</p>
        <div className="flex gap-2">
          <button
            onClick={handleExportAudit}
            disabled={isExporting || loading}
            className="px-3 py-2 rounded-xl text-[12px] font-bold bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Exporting…' : 'Export'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className={`px-3 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-sm ${
              refreshSuccess
                ? 'bg-green-500 text-white'
                : 'bg-[#5D5FEF] text-white hover:bg-[#4B4DD4] disabled:opacity-50 shadow-[#5D5FEF]/20'
            }`}
          >
            {isRefreshing ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : refreshSuccess ? <Check className="w-3.5 h-3.5" /> : <RotateCw className="w-3.5 h-3.5" />}
            {isRefreshing ? 'Syncing…' : refreshSuccess ? 'Synced!' : 'Refresh'}
          </button>
        </div>
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
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-600 flex items-center justify-center shadow-lg shadow-[#5D5FEF]/25">
                  <Files className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">{categories.length} types</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{totalFiles.toLocaleString()}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Total Files</p>
            </div>

            {/* Storage Used */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Vault</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{totalSizeHuman}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Storage Used</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-500" style={{ width: `${Math.min(currentStorageUtil, 100)}%` }} />
                </div>
                <span className="text-[10px] font-medium text-gray-400 mt-1 block">{currentStorageUtil}% used</span>
              </div>
            </div>

            {/* Disk Usage */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                  currentStorageUtil > 90 ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/25' :
                  currentStorageUtil > 70 ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25' :
                  'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25'
                }`}>
                  <HardDrive className="w-5 h-5 text-white" />
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                  currentStorageUtil > 90 ? 'bg-red-100 text-red-600' : currentStorageUtil > 70 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-700'
                }`}>{currentStorageUtil > 90 ? 'Critical' : currentStorageUtil > 70 ? 'Warning' : 'Healthy'}</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{currentStorageUtil}<span className="text-lg text-gray-300 font-bold">%</span></p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Disk Usage</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${
                    currentStorageUtil > 90 ? 'bg-gradient-to-r from-red-400 to-red-500' :
                    currentStorageUtil > 70 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                    'bg-gradient-to-r from-emerald-400 to-teal-500'
                  }`} style={{ width: `${currentStorageUtil}%` }} />
                </div>
                <span className="text-[10px] font-medium text-gray-400 mt-1 block">{100 - currentStorageUtil}% free</span>
              </div>
            </div>

            {/* Health Index — purple gradient card (not black) */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-700 flex items-center justify-center shadow-lg shadow-[#5D5FEF]/25">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  healthIndex.efficiency >= 90 ? 'bg-emerald-100 text-emerald-700' :
                  healthIndex.efficiency >= 70 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>{healthIndex.status}</div>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{healthIndex.grade}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Health Index</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#5D5FEF] to-indigo-500 transition-all duration-500" style={{ width: `${healthIndex.efficiency}%` }} />
                </div>
                <span className="text-[10px] font-medium text-gray-400 mt-1 block">{healthIndex.efficiency}% efficiency</span>
              </div>
            </div>
          </div>

          {/* Storage Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-[13px] font-black text-gray-900 uppercase tracking-wider">Storage Breakdown</p>
              <span className="text-[11px] font-bold text-gray-400">{categories.length} categories</span>
            </div>
            {categories.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-300">
                <Files className="w-10 h-10" />
                <p className="text-sm font-bold text-gray-400 ml-3">No files stored yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {categories.map((cat, idx) => {
                  const colors = getCategoryColor(cat.label);
                  return (
                    <div key={idx} className="flex items-center gap-4 px-5 py-3.5">
                      <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
                        {getCategoryIcon(cat.label)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[13px] font-bold text-gray-800">{cat.label}</span>
                          <span className="text-[12px] font-bold text-gray-500">{cat.sizeHuman}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full ${colors.bar} transition-all duration-700`} style={{ width: `${Math.max(cat.percentage, 2)}%` }} />
                          </div>
                          <span className="text-[11px] text-gray-400 font-medium w-8 text-right">{cat.percentage}%</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">{cat.count.toLocaleString()} files</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Storage Trend */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[13px] font-black text-gray-900 uppercase tracking-wider">Utilization Trend</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Storage usage over the last 12 periods</p>
              </div>
              <span className="text-[11px] font-black text-[#5D5FEF] bg-[#5D5FEF]/10 px-2.5 py-1 rounded-full">{currentStorageUtil}% now</span>
            </div>
            <div className="flex items-end gap-1.5 h-48 relative">
              {/* Y-axis guide lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[100, 75, 50, 25, 0].map(val => (
                  <div key={val} className="flex items-center gap-2 w-full" style={{ bottom: `${val}%` }}>
                    <span className="absolute -left-7 text-[9px] font-medium text-gray-300 w-6 text-right">{val}</span>
                    <div className="w-full border-t border-dashed border-gray-100" />
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-1.5 w-full h-full pl-4">
                {(data?.storageUtilization || []).map((util, i) => {
                  const isLast = i === (data?.storageUtilization?.length ?? 0) - 1;
                  return (
                    <div
                      key={i}
                      className="flex-1 h-full relative group cursor-pointer"
                      title={`Period ${i + 1}: ${util}%`}
                    >
                      <div
                        className={`absolute inset-x-0 bottom-0 rounded-t-lg transition-all duration-150 ${
                          isLast
                            ? 'bg-[#5D5FEF] shadow-md shadow-[#5D5FEF]/20'
                            : 'bg-[#5D5FEF]/20 group-hover:bg-[#5D5FEF]/50'
                        }`}
                        style={{ height: `${Math.max(util, 3)}%` }}
                      />
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                        {util}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between text-[10px] font-medium text-gray-300 mt-3 pl-4">
              <span>Oldest</span>
              <span className="text-[#5D5FEF] font-bold">Now</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StatsView;
