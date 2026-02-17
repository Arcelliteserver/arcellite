
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
    <div className="w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
        <div className="relative">
          <div className="absolute -left-2 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-4 md:pl-6 relative">
            System Logs
            <span className="absolute -top-2 -right-8 md:-right-12 w-16 h-16 md:w-20 md:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h2>
        </div>
        <button
          onClick={fetchLogs}
          disabled={refreshing}
          className="flex items-center gap-2 px-5 py-3 bg-[#5D5FEF] text-white rounded-xl font-bold text-sm hover:bg-[#4D4FDF] transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
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
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
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
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
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
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
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
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
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

      {/* Filters and Search - redesigned */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="text-base font-bold text-gray-700">Filter by type</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setFilter('all')}
            className={`px-5 py-3 rounded-xl text-base font-bold transition-all ${filter === 'all' ? 'bg-[#5D5FEF] text-white' : 'bg-gray-100 text-[#5D5FEF] hover:bg-[#E0E7FF]'}`}>All</button>
          <button onClick={() => setFilter('success')}
            className={`px-5 py-3 rounded-xl text-base font-bold transition-all ${filter === 'success' ? 'bg-green-500 text-white' : 'bg-gray-100 text-green-600 hover:bg-green-100'}`}>Success</button>
          <button onClick={() => setFilter('error')}
            className={`px-5 py-3 rounded-xl text-base font-bold transition-all ${filter === 'error' ? 'bg-red-500 text-white' : 'bg-gray-100 text-red-600 hover:bg-red-100'}`}>Errors</button>
          <button onClick={() => setFilter('warning')}
            className={`px-5 py-3 rounded-xl text-base font-bold transition-all ${filter === 'warning' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-amber-600 hover:bg-amber-100'}`}>Warnings</button>
          <button onClick={() => setFilter('neutral')}
            className={`px-5 py-3 rounded-xl text-base font-bold transition-all ${filter === 'neutral' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-blue-600 hover:bg-blue-100'}`}>Info</button>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-xl md:rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-[#5D5FEF]" />
              <h3 className="text-base md:text-lg font-black text-gray-900">
                Log Entries ({filteredLogs.length}) — Page {currentPage} of {totalPages || 1}
              </h3>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-pulse" />
              <p className="text-sm font-bold">Loading logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold">No logs match your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedLogs.map((log, i) => {
                const parsed = parseLogEvent(log.event);
                const statusBadge = getStatusBadge(log.status);
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 md:gap-4 p-3 md:p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-50/50 border border-gray-100 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md transition-all group"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(log.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${statusBadge}`}>
                            {parsed.service}
                          </span>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                            {log.time}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-700 leading-relaxed line-clamp-3">
                        {colorizeMessage(parsed.message)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredLogs.length > 0 && (
          <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
