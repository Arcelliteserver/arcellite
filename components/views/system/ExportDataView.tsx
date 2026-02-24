import React, { useState } from 'react';
import { Download, FileJson, FileText, Database, Check, AlertCircle, Loader2, Archive } from 'lucide-react';

const ExportDataView: React.FC = () => {
  const [exporting, setExporting] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const exportOptions = [
    {
      id: 'json',
      icon: FileJson,
      title: 'JSON Format',
      description: 'Export all data as a structured JSON file',
      detail: 'application/json',
      endpoint: '/api/export/json',
    },
    {
      id: 'csv',
      icon: FileText,
      title: 'CSV Format',
      description: 'Export your file list as a CSV spreadsheet',
      detail: 'text/csv',
      endpoint: '/api/export/csv',
    },
    {
      id: 'backup',
      icon: Database,
      title: 'Full Backup',
      description: 'Complete backup with metadata and settings',
      detail: 'application/zip',
      endpoint: '/api/export/backup',
    },
  ];

  const handleExport = async (option: typeof exportOptions[0]) => {
    setExporting(option.id);
    setError(null);

    try {
      const response = await fetch(option.endpoint, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(errData.error || `Export failed (${response.status})`);
      }

      const disposition = response.headers.get('Content-Disposition');
      let filename = `arcellite-export.${option.id === 'csv' ? 'csv' : option.id === 'backup' ? 'zip' : 'json'}`;
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?$/);
        if (match) filename = match[1];
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCompleted(prev => new Set(prev).add(option.id));
      setTimeout(() => {
        setCompleted(prev => {
          const next = new Set(prev);
          next.delete(option.id);
          return next;
        });
      }, 5000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="py-2">
      {/* ── Header ── */}
      <div className="mb-6 md:mb-8 pb-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 md:h-10 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full flex-shrink-0" />
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 tracking-tight">Export Data</h1>
            <p className="text-sm text-gray-500 mt-1">Download your data in various formats.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* ── Sidebar Navigation ── */}
        <nav className="w-full md:w-52 flex-shrink-0">
          <div className="space-y-1">
            {[
              { id: 'exports', label: 'Export Options', icon: Download },
              { id: 'info', label: 'Information', icon: Archive },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-all text-[14px] font-medium bg-[#F5F5F7] text-gray-900 cursor-default"
                >
                  <Icon className="w-[18px] h-[18px] flex-shrink-0 text-[#5D5FEF]" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content Area ── */}
        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Export Options</h2>
            <p className="text-sm text-gray-400">Choose a format to download your data.</p>
          </div>

          <div className="space-y-3">
            {exportOptions.map((option) => {
              const Icon = option.icon;
              const isExporting = exporting === option.id;
              const isComplete = completed.has(option.id);

              return (
                <div key={option.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:border-[#5D5FEF]/20 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{option.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
                        <p className="text-[10px] text-gray-300 mt-1 font-mono">{option.detail}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleExport(option)}
                      disabled={isExporting || exporting !== null}
                      className={`flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                        isExporting
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : isComplete
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-[#5D5FEF] text-white hover:bg-[#4B4DD4] shadow-sm shadow-[#5D5FEF]/20'
                      }`}
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Exporting...
                        </>
                      ) : isComplete ? (
                        <>
                          <Check className="w-4 h-4" />
                          Downloaded
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Export
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="p-4 bg-white rounded-2xl border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 font-medium">{error}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
              <Archive className="w-4 h-4 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700 mb-1">About exports</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Large exports may take a moment to process. Files are downloaded directly to your browser. Full backups include all metadata, settings, and file references.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportDataView;
