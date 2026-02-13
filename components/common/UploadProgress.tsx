import React, { useState } from 'react';
import { Upload, X, ChevronDown, ChevronUp, Check, AlertCircle, Loader2 } from 'lucide-react';

export interface UploadFileProgress {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface UploadProgressProps {
  files: UploadFileProgress[];
  visible: boolean;
  onDismiss: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const UploadProgress: React.FC<UploadProgressProps> = ({ files, visible, onDismiss }) => {
  const [minimized, setMinimized] = useState(false);

  if (!visible || files.length === 0) return null;

  const completedCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const totalCount = files.length;
  const allDone = completedCount + errorCount === totalCount;
  const activeFile = files.find(f => f.status === 'uploading');
  const overallProgress = totalCount > 0
    ? Math.round(files.reduce((sum, f) => sum + (f.status === 'done' ? 100 : f.status === 'error' ? 100 : f.progress), 0) / totalCount)
    : 0;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[900] w-[420px] max-w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-6 fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/80 overflow-hidden">
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center gap-3 cursor-pointer select-none bg-gradient-to-r from-[#5D5FEF]/5 to-transparent"
          onClick={() => setMinimized(m => !m)}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            allDone
              ? errorCount > 0 ? 'bg-amber-100' : 'bg-green-100'
              : 'bg-[#5D5FEF]/10'
          }`}>
            {allDone ? (
              errorCount > 0 ? (
                <AlertCircle className="w-4 h-4 text-amber-600" />
              ) : (
                <Check className="w-4 h-4 text-green-600" />
              )
            ) : (
              <Loader2 className="w-4 h-4 text-[#5D5FEF] animate-spin" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-gray-900 truncate">
              {allDone
                ? errorCount > 0
                  ? `${completedCount} uploaded, ${errorCount} failed`
                  : `${completedCount} file${completedCount !== 1 ? 's' : ''} uploaded`
                : `Uploading ${completedCount + 1} of ${totalCount}...`
              }
            </p>
            {!allDone && activeFile && (
              <p className="text-[10px] text-gray-500 truncate mt-0.5">{activeFile.fileName}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!allDone && (
              <span className="text-[10px] font-bold text-[#5D5FEF] tabular-nums">{overallProgress}%</span>
            )}
            {minimized ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
            {allDone && (
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                className="ml-1 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        {!allDone && (
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-gradient-to-r from-[#5D5FEF] to-[#7D7FFF] transition-all duration-300 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        )}

        {/* File list (expanded) */}
        {!minimized && (
          <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
            {files.map((file) => (
              <div key={file.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  file.status === 'done' ? 'bg-green-100' :
                  file.status === 'error' ? 'bg-red-100' :
                  file.status === 'uploading' ? 'bg-[#5D5FEF]/10' :
                  'bg-gray-100'
                }`}>
                  {file.status === 'done' ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : file.status === 'error' ? (
                    <AlertCircle className="w-3 h-3 text-red-500" />
                  ) : file.status === 'uploading' ? (
                    <Loader2 className="w-3 h-3 text-[#5D5FEF] animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-semibold truncate ${
                    file.status === 'error' ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    {file.fileName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-gray-400">{formatFileSize(file.fileSize)}</span>
                    {file.status === 'uploading' && (
                      <span className="text-[9px] font-bold text-[#5D5FEF] tabular-nums">{file.progress}%</span>
                    )}
                    {file.status === 'error' && file.error && (
                      <span className="text-[9px] text-red-400 truncate">{file.error}</span>
                    )}
                  </div>
                  {file.status === 'uploading' && (
                    <div className="h-0.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-[#5D5FEF] rounded-full transition-all duration-200 ease-out"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadProgress;
