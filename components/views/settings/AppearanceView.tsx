import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, FileImage, BookOpen, Film, Loader2, Wand2, Eye, Cast, Wifi, Link2 } from 'lucide-react';
import { authApi } from '@/services/api.client';

interface AppearanceViewProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onSettingsChange?: (settings: { aiAutoRename: boolean; pdfThumbnails: boolean; videoThumbnails: boolean }) => void;
  isMobile?: boolean;
}

const AppearanceView: React.FC<AppearanceViewProps> = ({ showToast, onSettingsChange, isMobile }) => {
  const [aiAutoRename, setAiAutoRename] = useState(false);
  const [pdfThumbnails, setPdfThumbnails] = useState(true);
  const [videoThumbnails, setVideoThumbnails] = useState(true);
  const [castMode, setCastMode] = useState<'scan' | 'webhook'>('scan');
  const [castWebhookUrl, setCastWebhookUrl] = useState('');
  const [castWebhookDraft, setCastWebhookDraft] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);

  const [batchRenaming, setBatchRenaming] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
    renamed: number;
    log: { oldName: string; newName: string }[];
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    authApi.getSettings()
      .then(({ settings }) => {
        if (settings.aiAutoRename !== undefined) setAiAutoRename(settings.aiAutoRename);
        if (settings.pdfThumbnails !== undefined) setPdfThumbnails(settings.pdfThumbnails);
        if (settings.videoThumbnails !== undefined) setVideoThumbnails(settings.videoThumbnails);
        const cm = settings.castMode as string | undefined;
        if (cm === 'scan' || cm === 'webhook') setCastMode(cm);
        const cwu = (settings.castWebhookUrl as string) ?? '';
        setCastWebhookUrl(cwu);
        setCastWebhookDraft(cwu);
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, []);

  const updateSetting = useCallback(async (key: string, value: boolean) => {
    if (key === 'aiAutoRename') setAiAutoRename(value);
    else if (key === 'pdfThumbnails') setPdfThumbnails(value);
    else if (key === 'videoThumbnails') setVideoThumbnails(value);
    onSettingsChange?.({ aiAutoRename: key === 'aiAutoRename' ? value : aiAutoRename, pdfThumbnails: key === 'pdfThumbnails' ? value : pdfThumbnails, videoThumbnails: key === 'videoThumbnails' ? value : videoThumbnails });

    setSavingField(key);
    try {
      await authApi.updateSettings({ [key]: value });
      const label = key === 'aiAutoRename' ? 'AI Auto-Rename' : key === 'pdfThumbnails' ? 'PDF Thumbnails' : 'Video Thumbnails';
      showToast?.(`${label} ${value ? 'enabled' : 'disabled'}`, 'success');
    } catch {
      if (key === 'aiAutoRename') setAiAutoRename(!value);
      else if (key === 'pdfThumbnails') setPdfThumbnails(!value);
      else if (key === 'videoThumbnails') setVideoThumbnails(!value);
      onSettingsChange?.({ aiAutoRename: key === 'aiAutoRename' ? !value : aiAutoRename, pdfThumbnails: key === 'pdfThumbnails' ? !value : pdfThumbnails, videoThumbnails: key === 'videoThumbnails' ? !value : videoThumbnails });
      showToast?.('Failed to update setting', 'error');
    } finally { setSavingField(null); }
  }, [aiAutoRename, pdfThumbnails, videoThumbnails, showToast, onSettingsChange]);

  const saveCastSettings = useCallback(async (newMode?: 'scan' | 'webhook', newUrl?: string) => {
    const mode = newMode ?? castMode;
    const url = newUrl ?? castWebhookUrl;
    setSavingField('cast');
    try {
      await authApi.updateSettings({ castMode: mode, castWebhookUrl: url });
      setCastMode(mode);
      setCastWebhookUrl(url);
      setCastWebhookDraft(url);
      showToast?.('Cast settings saved', 'success');
    } catch {
      showToast?.('Failed to save cast settings', 'error');
    } finally { setSavingField(null); }
  }, [castMode, castWebhookUrl, showToast]);

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
                if (data.total === 0) showToast?.('No images with generic names found — all photos already have descriptive names!', 'info');
              } else if (eventType === 'progress') {
                setBatchProgress(prev => prev ? { ...prev, current: data.current, total: data.total, currentFile: data.file } : prev);
              } else if (eventType === 'renamed') {
                setBatchProgress(prev => prev ? { ...prev, renamed: prev.renamed + 1, log: [...prev.log, { oldName: data.oldName, newName: data.newName }] } : prev);
              } else if (eventType === 'done') {
                if (data.renamed > 0) showToast?.(`Renamed ${data.renamed} image${data.renamed > 1 ? 's' : ''} successfully!`, 'success');
                else if (data.total > 0) showToast?.('Could not rename any images — check your Gemini API key', 'error');
              }
            } catch { /* skip */ }
            eventType = '';
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast?.(`Batch rename failed: ${(e as Error).message}`, 'error');
    } finally {
      setBatchRenaming(false);
      setTimeout(() => setBatchProgress(null), 8000);
      abortRef.current = null;
    }
  }, [showToast]);

  type SectionId = 'overview' | 'ai' | 'thumbnails' | 'cast';
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const sidebarItems: { id: SectionId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'ai', label: 'AI Features', icon: FileImage },
    { id: 'thumbnails', label: 'Thumbnails', icon: Eye },
    { id: 'cast', label: 'Cast Settings', icon: Cast },
  ];

  const enabledCount = [aiAutoRename, pdfThumbnails, videoThumbnails].filter(Boolean).length;

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#5D5FEF]" />
      </div>
    );
  }

  return (
    <div className="py-2">
      {/* ── Header ── */}
      <div className="mb-6 md:mb-8 pb-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 md:h-10 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full flex-shrink-0" />
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 tracking-tight">Smart Features</h1>
            <p className="text-sm text-gray-500 mt-1">AI-powered and display enhancements for your files.</p>
          </div>
        </div>
      </div>

      <div className={`flex gap-6 md:gap-8 ${isMobile ? 'flex-col' : 'flex-row'}`}>
        {/* ── Navigation: 2x2 grid on mobile, sidebar on desktop ── */}
        {isMobile ? (
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-white rounded-xl border border-gray-200 shadow-sm">
            {sidebarItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`px-2 py-2.5 rounded-lg text-xs font-semibold transition-all text-center ${
                    isActive ? 'bg-[#5D5FEF] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : (
          <nav className="w-52 flex-shrink-0">
            <div className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-all text-[14px] font-medium ${
                      isActive ? 'bg-[#F5F5F7] text-gray-900' : 'text-gray-500 hover:bg-[#F5F5F7] hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* ── Content Area ── */}
        <div className="flex-1 min-w-0">

          {/* ═══ Overview ═══ */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Feature Overview</h2>
                <p className="text-sm text-gray-400">Status of all smart features at a glance.</p>
              </div>

              <div className="rounded-2xl sm:rounded-3xl bg-[#1d1d1f] border border-[#2d2d2f] p-6 sm:p-8 md:p-10 shadow-xl shadow-black/10 overflow-hidden relative">
                <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#5D5FEF]/15 blur-3xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Smart Features</p>
                        <p className="text-2xl sm:text-3xl font-heading font-bold text-white leading-tight">
                          {enabledCount}/3 <span className="text-base font-bold text-white/40">Active</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/10 mb-3 overflow-hidden">
                    <div className="h-full bg-[#5D5FEF] rounded-full transition-all duration-700" style={{ width: `${(enabledCount / 3) * 100}%` }} />
                  </div>
                  <p className="text-[11px] font-bold text-white/40">
                    {enabledCount === 3 ? 'All smart features are enabled.' : `${3 - enabledCount} feature${3 - enabledCount !== 1 ? 's' : ''} disabled.`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'AI Auto-Rename', desc: 'Gemini Vision renaming', enabled: aiAutoRename, icon: FileImage },
                  { label: 'PDF Thumbnails', desc: 'First-page previews', enabled: pdfThumbnails, icon: BookOpen },
                  { label: 'Video Thumbnails', desc: 'First-frame previews', enabled: videoThumbnails, icon: Film },
                ].map(({ label, desc, enabled, icon: FeatureIcon }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3 min-h-[110px]">
                    <div className="flex items-center justify-between">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${enabled ? 'bg-[#5D5FEF]/10' : 'bg-gray-100'}`}>
                        <FeatureIcon className={`w-4 h-4 ${enabled ? 'text-[#5D5FEF]' : 'text-gray-300'}`} />
                      </div>
                      <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{label}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
                    </div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mt-auto ${enabled ? 'text-emerald-600' : 'text-gray-300'}`}>{enabled ? 'Active' : 'Disabled'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ AI Features ═══ */}
          {activeSection === 'ai' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">AI Features</h2>
                <p className="text-sm text-gray-400">AI-powered image analysis and renaming.</p>
              </div>

              <div className="flex items-center justify-between py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <FileImage className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">AI Auto-Rename Images</p>
                    <p className="text-xs text-gray-400 mt-0.5">Analyze uploads with Gemini Vision and rename with descriptive titles.</p>
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('aiAutoRename', !aiAutoRename)}
                  disabled={savingField === 'aiAutoRename'}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${aiAutoRename ? 'bg-[#5D5FEF]' : 'bg-gray-200'} ${savingField === 'aiAutoRename' ? 'opacity-60' : ''}`}
                  role="switch"
                  aria-checked={aiAutoRename}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${aiAutoRename ? 'translate-x-6' : 'translate-x-1'}`}>
                    {savingField === 'aiAutoRename' && <Loader2 className="w-3 h-3 text-gray-400 animate-spin absolute top-1 left-1" />}
                  </span>
                </button>
              </div>

              {aiAutoRename && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Batch Rename</p>
                  <p className="text-xs text-gray-400">Rename existing photos in your library using AI vision analysis.</p>

                  {!batchRenaming && !batchProgress && (
                    <button
                      onClick={startBatchRename}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#5D5FEF] text-white rounded-xl text-xs font-bold hover:bg-[#4B4DD4] transition-all shadow-sm shadow-[#5D5FEF]/20"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Rename Existing Photos
                    </button>
                  )}

                  {batchProgress && (
                    <div className="bg-[#F5F5F7] rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {batchRenaming && <Loader2 className="w-3 h-3 text-[#5D5FEF] animate-spin" />}
                          <span className="text-[11px] font-bold text-gray-700">
                            {batchRenaming
                              ? `Analyzing ${batchProgress.current}/${batchProgress.total}...`
                              : `Done! Renamed ${batchProgress.renamed} photo${batchProgress.renamed !== 1 ? 's' : ''}`}
                          </span>
                        </div>
                        {batchRenaming && (
                          <button onClick={() => abortRef.current?.abort()} className="text-[10px] font-bold text-red-500 hover:text-red-600">Cancel</button>
                        )}
                      </div>
                      {batchProgress.total > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-[#5D5FEF] h-1.5 rounded-full transition-all duration-300" style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }} />
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

                  <p className="text-[10px] text-gray-400">Requires a Google Gemini API key configured in API Keys settings.</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ Thumbnails ═══ */}
          {activeSection === 'thumbnails' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Thumbnails</h2>
                <p className="text-sm text-gray-400">Control file preview generation.</p>
              </div>

              <div className="space-y-0">
                <div className="flex items-center justify-between py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">PDF & Book Thumbnails</p>
                      <p className="text-xs text-gray-400 mt-0.5">Show first-page preview thumbnails for PDF and book files.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting('pdfThumbnails', !pdfThumbnails)}
                    disabled={savingField === 'pdfThumbnails'}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${pdfThumbnails ? 'bg-[#5D5FEF]' : 'bg-gray-200'} ${savingField === 'pdfThumbnails' ? 'opacity-60' : ''}`}
                    role="switch"
                    aria-checked={pdfThumbnails}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${pdfThumbnails ? 'translate-x-6' : 'translate-x-1'}`}>
                      {savingField === 'pdfThumbnails' && <Loader2 className="w-3 h-3 text-gray-400 animate-spin absolute top-1 left-1" />}
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Film className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Video Thumbnails</p>
                      <p className="text-xs text-gray-400 mt-0.5">Generate preview thumbnails from the first frame of video files.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting('videoThumbnails', !videoThumbnails)}
                    disabled={savingField === 'videoThumbnails'}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${videoThumbnails ? 'bg-[#5D5FEF]' : 'bg-gray-200'} ${savingField === 'videoThumbnails' ? 'opacity-60' : ''}`}
                    role="switch"
                    aria-checked={videoThumbnails}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${videoThumbnails ? 'translate-x-6' : 'translate-x-1'}`}>
                      {savingField === 'videoThumbnails' && <Loader2 className="w-3 h-3 text-gray-400 animate-spin absolute top-1 left-1" />}
                    </span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                  <Eye className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-1">About thumbnails</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    When disabled, files use generic placeholder icons instead of previews. Enabling thumbnails may use slightly more storage for cached previews.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Cast Settings ═══ */}
          {activeSection === 'cast' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Cast Settings</h2>
                <p className="text-sm text-gray-400">Choose how Arcellite finds your cast devices.</p>
              </div>

              {/* Mode picker */}
              <div className="space-y-3">
                <button
                  onClick={() => { setCastMode('scan'); saveCastSettings('scan', castWebhookUrl); }}
                  className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${castMode === 'scan' ? 'border-[#5D5FEF] bg-[#5D5FEF]/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${castMode === 'scan' ? 'bg-[#5D5FEF]/15' : 'bg-gray-100'}`}>
                    <Wifi className={`w-5 h-5 ${castMode === 'scan' ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">Auto-Scan Network</p>
                      {castMode === 'scan' && <span className="text-[9px] font-black text-[#5D5FEF] bg-[#5D5FEF]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                      Automatically discovers UPnP/DLNA smart TVs and Chromecast devices on your local network using SSDP and ARP scanning.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setCastMode('webhook')}
                  className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${castMode === 'webhook' ? 'border-[#5D5FEF] bg-[#5D5FEF]/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${castMode === 'webhook' ? 'bg-[#5D5FEF]/15' : 'bg-gray-100'}`}>
                    <Link2 className={`w-5 h-5 ${castMode === 'webhook' ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">Custom Webhook</p>
                      {castMode === 'webhook' && <span className="text-[9px] font-black text-[#5D5FEF] bg-[#5D5FEF]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                      Send cast requests to a custom URL (e.g. an n8n or Home Assistant webhook). The file name, type, URL, and MIME type are included in the POST body.
                    </p>
                  </div>
                </button>
              </div>

              {/* Webhook URL input — only shown when webhook mode selected */}
              {castMode === 'webhook' && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Webhook URL</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={castWebhookDraft}
                      onChange={e => setCastWebhookDraft(e.target.value)}
                      placeholder="https://your-n8n.example.com/webhook/..."
                      className="flex-1 min-w-0 text-sm px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-1 focus:ring-[#5D5FEF]/30 bg-[#F9F9FB] transition"
                    />
                    <button
                      onClick={() => saveCastSettings('webhook', castWebhookDraft)}
                      disabled={savingField === 'cast' || !castWebhookDraft.trim()}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#5D5FEF] text-white rounded-xl text-xs font-bold hover:bg-[#4B4DD4] transition-all disabled:opacity-50 flex-shrink-0"
                    >
                      {savingField === 'cast' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Save
                    </button>
                  </div>
                  {castWebhookUrl && (
                    <p className="text-[11px] text-gray-400">
                      Current: <span className="text-[#5D5FEF] font-medium break-all">{castWebhookUrl}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    The webhook receives a POST request with JSON body: <code className="bg-gray-100 px-1 rounded text-[10px]">fileName</code>, <code className="bg-gray-100 px-1 rounded text-[10px]">fileType</code>, <code className="bg-gray-100 px-1 rounded text-[10px]">fileUrl</code>, <code className="bg-gray-100 px-1 rounded text-[10px]">mimeType</code>.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AppearanceView;
