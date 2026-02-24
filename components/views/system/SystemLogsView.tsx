
import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { LogEntry } from '@/types';

const SystemLogsView: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'warning' | 'neutral'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchLogs = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/system/logs?limit=200');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      // Silent — logs UI shows empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const parseLogEvent = (event: string) => {
    const match = event.match(/^\[([^\]]+)\]\s*(.+)/);
    if (match) {
      return {
        service: match[1],
        message: match[2]
      };
    }
    return { service: 'system', message: event };
  };

  // Colorize message parts (IP, MAC, server names)
  const colorizeMessage = (message: string) => {
    const ipPattern = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
    const macPattern = /([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/gi;
    const serverPattern = /(arcelliteserver|arcellieserver)/gi;

    let result: (string | React.ReactNode)[] = [message];

    result = result.flatMap((part) => {
      if (typeof part !== 'string') return part;
      return part.split(serverPattern).map((chunk, idx) => 
        chunk.match(serverPattern) 
          ? <span key={`server-${idx}`} className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-bold text-[10px] inline-block mx-0.5">{chunk}</span>
          : chunk
      );
    });

    result = result.flatMap((part) => {
      if (typeof part !== 'string') return part;
      return part.split(macPattern).map((chunk, idx) => 
        chunk.match(macPattern) 
          ? <span key={`mac-${idx}`} className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-bold text-[10px] inline-block mx-0.5 font-mono">{chunk}</span>
          : chunk
      );
    });

    result = result.flatMap((part) => {
      if (typeof part !== 'string') return part;
      return part.split(ipPattern).map((chunk, idx) => 
        chunk.match(ipPattern) 
          ? <span key={`ip-${idx}`} className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-bold text-[10px] inline-block mx-0.5 font-mono">{chunk}</span>
          : chunk
      );
    });

    return result;
  };

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.status !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return log.event.toLowerCase().includes(query) || log.time.toLowerCase().includes(query);
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  return (
    <div className="w-full">
      {/* Action bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] font-medium text-gray-400">System and service event logs</p>
        <button
          onClick={fetchLogs}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#5D5FEF] text-white rounded-xl font-bold text-[12px] hover:bg-[#4B4DD4] transition-all active:scale-95 disabled:opacity-50 shadow-sm shadow-[#5D5FEF]/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats */}
      {(() => {
        const successCount = logs.filter(l => l.status === 'success').length;
        const errorCount = logs.filter(l => l.status === 'error').length;
        const warningCount = logs.filter(l => l.status === 'warning').length;
        const infoCount = logs.filter(l => l.status === 'neutral').length;
        const healthPercent = logs.length > 0 ? Math.round(((logs.length - errorCount) / logs.length) * 100) : 100;

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {/* Total / Health */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-600 flex items-center justify-center shadow-lg shadow-[#5D5FEF]/25">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  healthPercent >= 95 ? 'bg-emerald-100 text-emerald-700' : healthPercent >= 80 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>
                  {healthPercent >= 95 ? 'Healthy' : healthPercent >= 80 ? 'Fair' : 'Issues'}
                </div>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{logs.length}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Total Events</p>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600">{healthPercent}% healthy</span>
                </div>
                {errorCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-red-500">{errorCount} errors</span>
                  </div>
                )}
              </div>
            </div>

            {/* Success */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Passed</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{successCount}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Success</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
                    style={{ width: `${logs.length > 0 ? Math.max(2, (successCount / logs.length) * 100) : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-gray-400">{logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0}% of total</span>
                </div>
              </div>
            </div>

            {/* Errors */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                {errorCount > 0 ? (
                  <div className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700">
                    {errorCount} found
                  </div>
                ) : (
                  <div className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
                    Clear
                  </div>
                )}
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{errorCount}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Errors</p>
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">Warnings</span>
                  <span className="text-[10px] sm:text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">{warningCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">Error rate</span>
                  <span className="text-[10px] sm:text-[11px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{logs.length > 0 ? Math.round((errorCount / logs.length) * 100) : 0}%</span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
                  <Info className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Logs</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">{infoCount}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Info Events</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-500 transition-all duration-500"
                    style={{ width: `${logs.length > 0 ? Math.max(2, (infoCount / logs.length) * 100) : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-gray-400">{logs.length > 0 ? Math.round((infoCount / logs.length) * 100) : 0}% of total</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filters */}
      <div className="flex items-center bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm gap-1 mb-6">
        {([
          { key: 'all', label: 'All', active: 'bg-[#5D5FEF] text-white shadow-sm shadow-[#5D5FEF]/20', inactive: 'text-gray-500 hover:bg-gray-50 hover:text-gray-700' },
          { key: 'success', label: 'Success', active: 'bg-emerald-500 text-white', inactive: 'text-gray-500 hover:bg-gray-50 hover:text-gray-700' },
          { key: 'error', label: 'Errors', active: 'bg-red-500 text-white', inactive: 'text-gray-500 hover:bg-gray-50 hover:text-gray-700' },
          { key: 'warning', label: 'Warnings', active: 'bg-amber-500 text-white', inactive: 'text-gray-500 hover:bg-gray-50 hover:text-gray-700' },
          { key: 'neutral', label: 'Info', active: 'bg-sky-500 text-white', inactive: 'text-gray-500 hover:bg-gray-50 hover:text-gray-700' },
        ] as const).map(({ key, label, active, inactive }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 px-3 py-2 rounded-xl text-[12px] font-bold transition-all ${filter === key ? active : inactive}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Database className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-[13px] font-black text-gray-900 uppercase tracking-wider">Log Entries</p>
          </div>
          <span className="text-[11px] font-bold text-gray-400">
            {filteredLogs.length} entries · page {currentPage} of {totalPages || 1}
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <Database className="w-10 h-10 text-gray-200 mb-3 animate-pulse" />
            <p className="text-[13px] font-bold">Loading logs…</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <Database className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-[13px] font-bold">No logs match your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {paginatedLogs.map((log, i) => {
              const parsed = parseLogEvent(log.event);
              const statusBadge = getStatusBadge(log.status);
              return (
                <div
                  key={i}
                  className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                >
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border flex-shrink-0 mt-0.5 ${statusBadge}`}>
                    {parsed.service}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-700 leading-snug line-clamp-2">
                      {colorizeMessage(parsed.message)}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium flex-shrink-0 mt-0.5">{log.time}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {filteredLogs.length > 0 && (
          <div className="p-4 md:p-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm font-bold text-gray-600">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredLogs.length)} of {filteredLogs.length}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 min-w-fit">
                <span className="text-sm font-black text-gray-900">{currentPage}</span>
                <span className="text-gray-400">/</span>
                <span className="text-sm font-bold text-gray-600">{totalPages || 1}</span>
              </div>
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-[#5D5FEF] text-white hover:bg-[#4D4FCF] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemLogsView;
