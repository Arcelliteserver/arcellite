import React, { useState } from 'react';
import { Download, FileJson, FileText, Database, Check, AlertCircle } from 'lucide-react';

const ExportDataView: React.FC = () => {
  const [exporting, setExporting] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const exportOptions = [
    {
      id: 'json',
      icon: FileJson,
      title: 'JSON Format',
      description: 'Export all data as JSON file',
      format: 'application/json',
      endpoint: '/api/export/json',
    },
    {
      id: 'csv',
      icon: FileText,
      title: 'CSV Format',
      description: 'Export file list as CSV',
      format: 'text/csv',
      endpoint: '/api/export/csv',
    },
    {
      id: 'backup',
      icon: Database,
      title: 'Full Backup',
      description: 'Complete backup with metadata',
      format: 'application/zip',
      endpoint: '/api/export/backup',
    },
  ];

  const handleExport = async (option: typeof exportOptions[0]) => {
    setExporting(option.id);
    setError(null);

    try {
      const response = await fetch(option.endpoint);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(errData.error || `Export failed (${response.status})`);
      }

      // Get the filename from Content-Disposition header or generate one
      const disposition = response.headers.get('Content-Disposition');
      let filename = `cloudnest-export.${option.id === 'csv' ? 'csv' : option.id === 'backup' ? 'zip' : 'json'}`;
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?$/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mark as completed
      setCompleted(prev => new Set(prev).add(option.id));

      // Reset completed state after 5 seconds
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
    <div className="w-full">
      <div className="mb-10">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            Export Data
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">Download your data in various formats</p>
      </div>

      <div className="space-y-4">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          const isExporting = exporting === option.id;
          const isComplete = completed.has(option.id);

          return (
            <div
              key={option.id}
              className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-[#5D5FEF]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-black text-gray-900 mb-1">{option.title}</h3>
                    <p className="text-[12px] text-gray-500">{option.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Format: {option.format}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleExport(option)}
                  disabled={isExporting || exporting !== null}
                  className={`flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                    isExporting
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isComplete
                      ? 'bg-green-50 text-green-600 border border-green-200'
                      : 'bg-[#5D5FEF] text-white hover:bg-[#4D4FCF]'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : isComplete ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Exported</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
        <p className="text-[12px] text-blue-700 font-medium">
          <strong>Note:</strong> Exporting large amounts of data may take some time. You'll receive a notification when the export is ready.
        </p>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-[12px] text-red-700 font-medium">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ExportDataView;

