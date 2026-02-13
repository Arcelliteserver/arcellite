import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Files,
  Image,
  Film,
  Music,
  Database,
  TrendingUp,
  Activity,
  Download,
  RotateCw,
  Check,
  FileText,
  Shield,
  Zap
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

  const getCategoryColor = (label: string) => {
    switch (label) {
      case 'Photos': return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' };
      case 'Videos': return { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' };
      case 'Music': return { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-100' };
      case 'Files': return { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100' };
      default: return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-100' };
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Total Files */}
            <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center">
                  <Files className="w-6 h-6 text-[#5D5FEF]" />
                </div>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Files</p>
              <p className="text-3xl font-black text-gray-900">{totalFiles.toLocaleString()}</p>
            </div>

            {/* Total Size */}
            <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Database className="w-6 h-6 text-blue-600" />
                </div>
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Storage Used</p>
              <p className="text-3xl font-black text-gray-900">{totalSizeHuman}</p>
            </div>

            {/* Disk Usage */}
            <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                  <HardDrive className="w-6 h-6 text-purple-600" />
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-md ${
                  currentStorageUtil > 80 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                }`}>
                  {currentStorageUtil}%
                </span>
              </div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Disk Usage</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-gray-900">{currentStorageUtil}%</p>
                <p className="text-sm text-gray-500 font-bold">used</p>
              </div>
            </div>

            {/* Health Grade */}
            <div className={`rounded-[2rem] border p-6 shadow-sm hover:shadow-md transition-all ${
              healthIndex.grade === 'A+' || healthIndex.grade === 'A'
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
                : healthIndex.grade === 'B'
                ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-100'
                : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  healthIndex.grade === 'A+' || healthIndex.grade === 'A'
                    ? 'bg-green-100'
                    : healthIndex.grade === 'B'
                    ? 'bg-blue-100'
                    : 'bg-amber-100'
                }`}>
                  <Shield className={`w-6 h-6 ${
                    healthIndex.grade === 'A+' || healthIndex.grade === 'A'
                      ? 'text-green-600'
                      : healthIndex.grade === 'B'
                      ? 'text-blue-600'
                      : 'text-amber-600'
                  }`} />
                </div>
                <Zap className={`w-4 h-4 ${
                  healthIndex.grade === 'A+' || healthIndex.grade === 'A'
                    ? 'text-green-500'
                    : healthIndex.grade === 'B'
                    ? 'text-blue-500'
                    : 'text-amber-500'
                }`} />
              </div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Health Index</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-gray-900">{healthIndex.grade}</p>
                <p className="text-sm text-gray-600 font-bold">{healthIndex.status}</p>
              </div>
            </div>
          </div>

          {/* Storage Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Category Breakdown */}
            <div className="lg:col-span-2 bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-wider">Storage Breakdown</h2>
                <span className="text-[11px] font-bold text-gray-400">{categories.length} Categories</span>
              </div>

              <div className="space-y-4">
                {categories.map((cat, idx) => {
                  const colors = getCategoryColor(cat.label);
                  return (
                    <div key={idx} className="group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
                            <div className={colors.text}>
                              {getCategoryIcon(cat.label)}
                            </div>
                          </div>
                          <div>
                            <p className="text-[14px] font-black text-gray-900">{cat.label}</p>
                            <p className="text-[11px] text-gray-500 font-medium">{cat.count.toLocaleString()} files · {cat.sizeHuman}</p>
                          </div>
                        </div>
                        <span className="text-[13px] font-black text-gray-400">{cat.percentage}%</span>
                      </div>
                      <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors.bg.replace('50', '200')} transition-all duration-1000`}
                          style={{ width: `${cat.percentage}%` }}
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
            <div className="bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
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
          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-wider">Storage Utilization Trend</h2>
              <span className="text-[11px] font-bold text-gray-400">Last 12 Periods</span>
            </div>

            <div className="flex items-end gap-2 h-48">
              {(data?.storageUtilization || []).map((util, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gray-50 rounded-t-xl relative group hover:bg-[#5D5FEF]/10 transition-all cursor-pointer"
                  title={`${util}% utilization`}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-[#5D5FEF]/20 rounded-t-xl transition-all duration-500 group-hover:bg-[#5D5FEF]"
                    style={{ height: `${util}%` }}
                  />
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
