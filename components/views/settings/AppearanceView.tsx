import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Palette, Moon, Sun, Monitor, Type, Sparkles, FileImage, BookOpen, Loader2, Wand2 } from 'lucide-react';
import { authApi } from '@/services/api.client';

interface AppearanceViewProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onSettingsChange?: (settings: { aiAutoRename: boolean; pdfThumbnails: boolean }) => void;
}

const AppearanceView: React.FC<AppearanceViewProps> = ({ showToast, onSettingsChange }) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [aiAutoRename, setAiAutoRename] = useState(false);
  const [pdfThumbnails, setPdfThumbnails] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);

  // Batch rename state
  const [batchRenaming, setBatchRenaming] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
    renamed: number;
    log: { oldName: string; newName: string }[];
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load settings from backend on mount
  useEffect(() => {
    authApi.getSettings()
      .then(({ settings }) => {
        if (settings.aiAutoRename !== undefined) setAiAutoRename(settings.aiAutoRename);
        if (settings.pdfThumbnails !== undefined) setPdfThumbnails(settings.pdfThumbnails);
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, []);

  const updateSetting = useCallback(async (key: string, value: boolean) => {
    // Optimistic update — toggle immediately, save in background
    if (key === 'aiAutoRename') {
      setAiAutoRename(value);
    } else if (key === 'pdfThumbnails') {
      setPdfThumbnails(value);
    }
    onSettingsChange?.({ aiAutoRename: key === 'aiAutoRename' ? value : aiAutoRename, pdfThumbnails: key === 'pdfThumbnails' ? value : pdfThumbnails });

    setSavingField(key);
    try {
      await authApi.updateSettings({ [key]: value });
      showToast?.(`${key === 'aiAutoRename' ? 'AI Auto-Rename' : 'PDF Thumbnails'} ${value ? 'enabled' : 'disabled'}`, 'success');
    } catch {
      // Revert on failure
      if (key === 'aiAutoRename') {
        setAiAutoRename(!value);
      } else if (key === 'pdfThumbnails') {
        setPdfThumbnails(!value);
      }
      onSettingsChange?.({ aiAutoRename: key === 'aiAutoRename' ? !value : aiAutoRename, pdfThumbnails: key === 'pdfThumbnails' ? !value : pdfThumbnails });
      showToast?.('Failed to update setting', 'error');
    } finally {
      setSavingField(null);
    }
  }, [aiAutoRename, pdfThumbnails, showToast, onSettingsChange]);

  const startBatchRename = useCallback(async () => {
    setBatchRenaming(true);
    setBatchProgress({ current: 0, total: 0, currentFile: 'Scanning...', renamed: 0, log: [] });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/ai/batch-rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'media' }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        showToast?.(err.error || 'Batch rename failed', 'error');
        setBatchRenaming(false);
        setBatchProgress(null);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        showToast?.('Streaming not supported', 'error');
        setBatchRenaming(false);
        setBatchProgress(null);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'start') {
                setBatchProgress(prev => prev ? { ...prev, total: data.total, currentFile: `Found ${data.total} images to rename (${data.scanned} scanned)` } : prev);
                if (data.total === 0) {
                  showToast?.('No images with generic names found — all photos already have descriptive names!', 'info');
                }
              } else if (eventType === 'progress') {
                setBatchProgress(prev => prev ? { ...prev, current: data.current, total: data.total, currentFile: data.file } : prev);
              } else if (eventType === 'renamed') {
                setBatchProgress(prev => prev ? { ...prev, renamed: prev.renamed + 1, log: [...prev.log, { oldName: data.oldName, newName: data.newName }] } : prev);
              } else if (eventType === 'done') {
                if (data.renamed > 0) {
                  showToast?.(`Renamed ${data.renamed} image${data.renamed > 1 ? 's' : ''} successfully!`, 'success');
                } else if (data.total > 0) {
                  showToast?.('Could not rename any images — check your Gemini API key', 'error');
                }
              }
            } catch { /* skip malformed SSE */ }
            eventType = '';
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        showToast?.(`Batch rename failed: ${(e as Error).message}`, 'error');
      }
    } finally {
      setBatchRenaming(false);
      // Keep progress visible for a moment so user can see final results
      setTimeout(() => setBatchProgress(null), 8000);
      abortRef.current = null;
    }
  }, [showToast]);

  const themes = [
    { id: 'light', icon: Sun, label: 'Light', description: 'Light theme' },
    { id: 'dark', icon: Moon, label: 'Dark', description: 'Dark theme' },
    { id: 'auto', icon: Monitor, label: 'Auto', description: 'Follow system preference' },
  ];

  const fontSizes = [
    { id: 'small', label: 'Small', size: '14px' },
    { id: 'medium', label: 'Medium', size: '16px' },
    { id: 'large', label: 'Large', size: '18px' },
  ];

  return (
    <div className="w-full">
      <div className="mb-10">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            Appearance
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">Customize the look and feel of your vault</p>
      </div>

      <div className="space-y-8">
        {/* Theme Selection */}
        <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-5 h-5 text-[#5D5FEF]" />
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider text-xs">
              Theme
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themes.map((themeOption) => {
              const Icon = themeOption.icon;
              const isSelected = theme === themeOption.id;
              return (
                <button
                  key={themeOption.id}
                  onClick={() => setTheme(themeOption.id as 'light' | 'dark' | 'auto')}
                  className={`p-5 sm:p-6 rounded-2xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                      : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:block">
                    <div className={`w-10 h-10 sm:w-auto sm:h-auto rounded-xl sm:rounded-none flex items-center justify-center sm:block flex-shrink-0 ${isSelected ? 'bg-[#5D5FEF]/10 sm:bg-transparent' : 'bg-gray-100 sm:bg-transparent'}`}>
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 sm:mb-3 ${isSelected ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-black text-gray-900 mb-0.5 sm:mb-1">{themeOption.label}</h3>
                      <p className="text-[11px] text-gray-500">{themeOption.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Size */}
        <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Type className="w-5 h-5 text-[#5D5FEF]" />
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider text-xs">
              Font Size
            </h2>
          </div>
          <div className="space-y-3">
            {fontSizes.map((size) => {
              const isSelected = fontSize === size.id;
              return (
                <button
                  key={size.id}
                  onClick={() => setFontSize(size.id as 'small' | 'medium' | 'large')}
                  className={`w-full p-5 rounded-2xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                      : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-black text-gray-900">{size.label}</span>
                    <span
                      className="text-gray-500 font-medium"
                      style={{ fontSize: size.size }}
                    >
                      Sample Text
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Smart Features */}
        <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-5 h-5 text-[#5D5FEF]" />
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider text-xs">
              Smart Features
            </h2>
          </div>
          <p className="text-gray-400 text-xs mb-6 pl-8">AI-powered and display enhancements for your files</p>

          <div className="space-y-4">
            {/* AI Auto-Rename */}
            <div className={`p-5 rounded-2xl border-2 transition-all ${aiAutoRename ? 'border-[#5D5FEF]/30 bg-[#5D5FEF]/5' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${aiAutoRename ? 'bg-[#5D5FEF]/10' : 'bg-gray-100'}`}>
                    <FileImage className={`w-5 h-5 ${aiAutoRename ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-black text-gray-900">AI Auto-Rename Images</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5 hidden sm:block">
                      Automatically analyzes uploaded images with Google Gemini Vision and renames them with descriptive titles. Use the button below to rename existing photos too
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5 sm:hidden">
                      Auto-rename images with AI
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('aiAutoRename', !aiAutoRename)}
                  disabled={savingField === 'aiAutoRename' || loadingSettings}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    aiAutoRename ? 'bg-[#5D5FEF]' : 'bg-gray-200'
                  } ${savingField === 'aiAutoRename' ? 'opacity-60' : ''}`}
                >
                  <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    aiAutoRename ? 'translate-x-5' : 'translate-x-0'
                  }`}>
                    {savingField === 'aiAutoRename' && (
                      <Loader2 className="w-3 h-3 text-gray-400 animate-spin absolute top-1.5 left-1.5" />
                    )}
                  </span>
                </button>
              </div>
              {aiAutoRename && (
                <div className="mt-3 pl-14 space-y-3">
                  <p className="text-[10px] font-bold text-[#5D5FEF]/70 uppercase tracking-wider">
                    Requires Google Gemini API key in Settings → API Keys
                  </p>
                  {/* Batch rename existing photos */}
                  {!batchRenaming && !batchProgress && (
                    <button
                      onClick={startBatchRename}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5D5FEF]/10 hover:bg-[#5D5FEF]/20 transition-colors text-[#5D5FEF] text-xs font-bold"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Rename Existing Photos
                    </button>
                  )}
                  {/* Batch rename progress */}
                  {batchProgress && (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {batchRenaming && <Loader2 className="w-3 h-3 text-[#5D5FEF] animate-spin" />}
                          <span className="text-[11px] font-bold text-gray-700">
                            {batchRenaming
                              ? `Analyzing ${batchProgress.current}/${batchProgress.total}...`
                              : `Done! Renamed ${batchProgress.renamed} photo${batchProgress.renamed !== 1 ? 's' : ''}`
                            }
                          </span>
                        </div>
                        {batchRenaming && (
                          <button
                            onClick={() => abortRef.current?.abort()}
                            className="text-[10px] font-bold text-red-500 hover:text-red-600"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      {batchProgress.total > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-[#5D5FEF] h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
                          />
                        </div>
                      )}
                      {batchProgress.currentFile && batchRenaming && (
                        <p className="text-[10px] text-gray-400 truncate">{batchProgress.currentFile}</p>
                      )}
                      {batchProgress.log.length > 0 && (
                        <div className="max-h-24 overflow-y-auto space-y-0.5">
                          {batchProgress.log.slice(-5).map((entry, i) => (
                            <p key={i} className="text-[10px] text-gray-500">
                              <span className="text-gray-400">{entry.oldName}</span>
                              <span className="mx-1">→</span>
                              <span className="text-[#5D5FEF] font-medium">{entry.newName}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PDF Thumbnails */}
            <div className={`p-5 rounded-2xl border-2 transition-all ${pdfThumbnails ? 'border-[#5D5FEF]/30 bg-[#5D5FEF]/5' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${pdfThumbnails ? 'bg-[#5D5FEF]/10' : 'bg-gray-100'}`}>
                    <BookOpen className={`w-5 h-5 ${pdfThumbnails ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-black text-gray-900">PDF & Book Thumbnails</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5 hidden sm:block">
                      Show first-page preview thumbnails for PDF and book files. Disable to use placeholder icons instead
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5 sm:hidden">
                      Show PDF page previews
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('pdfThumbnails', !pdfThumbnails)}
                  disabled={savingField === 'pdfThumbnails' || loadingSettings}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    pdfThumbnails ? 'bg-[#5D5FEF]' : 'bg-gray-200'
                  } ${savingField === 'pdfThumbnails' ? 'opacity-60' : ''}`}
                >
                  <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    pdfThumbnails ? 'translate-x-5' : 'translate-x-0'
                  }`}>
                    {savingField === 'pdfThumbnails' && (
                      <Loader2 className="w-3 h-3 text-gray-400 animate-spin absolute top-1.5 left-1.5" />
                    )}
                  </span>
                </button>
              </div>
              {!pdfThumbnails && (
                <div className="mt-3 pl-14">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Thumbnails disabled — showing placeholder icons
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceView;

