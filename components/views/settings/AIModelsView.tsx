import React, { useState, useEffect, useCallback } from 'react';
import { Check, Eye, EyeOff, Copy, Plug, Loader2, Save, Key, Bot, Layers } from 'lucide-react';
import { AI_MODELS } from '@/constants';

interface ProviderAPIKey {
  provider: string;
  key: string;
}

interface AIModelsViewProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const AIModelsView: React.FC<AIModelsViewProps> = ({ showToast }) => {
  const [providerKeys, setProviderKeys] = useState<Record<string, ProviderAPIKey>>({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [elevenLabsVisible, setElevenLabsVisible] = useState(false);
  const [elevenLabsSaving, setElevenLabsSaving] = useState(false);
  const [elevenLabsSaved, setElevenLabsSaved] = useState(false);
  const [elevenLabsChanged, setElevenLabsChanged] = useState(false);

  const modelsByProvider = AI_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof AI_MODELS>);

  const providerList = Object.keys(modelsByProvider);

  type SectionId = 'overview' | 'services' | string;
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const initEmpty = useCallback(() => {
    const initial: Record<string, ProviderAPIKey> = {};
    providerList.forEach((p) => { initial[p] = { provider: p, key: '' }; });
    setProviderKeys(initial);
  }, []);

  useEffect(() => {
    fetch('/api/ai/keys/load')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.keys) {
          const initial: Record<string, ProviderAPIKey> = {};
          const alreadyConnected = new Set<string>();
          providerList.forEach((p) => {
            initial[p] = { provider: p, key: data.keys[p] || '' };
            if (data.keys[p]) alreadyConnected.add(p);
          });
          if (data.keys['ElevenLabs']) { setElevenLabsKey(data.keys['ElevenLabs']); setElevenLabsSaved(true); }
          setProviderKeys(initial);
          setConnectedProviders(alreadyConnected);
        } else { initEmpty(); }
      })
      .catch(() => initEmpty())
      .finally(() => setLoading(false));
  }, []);

  const toggleVisibility = (p: string) => setVisibleKeys(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const handleKeyChange = (p: string, v: string) => { setProviderKeys(prev => ({ ...prev, [p]: { ...prev[p], key: v } })); setHasChanges(prev => new Set(prev).add(p)); };
  const getProviderKey = (p: string) => providerKeys[p]?.key || '';
  const hasKey = (p: string) => !!providerKeys[p]?.key;

  const handleSave = useCallback(async (provider: string) => {
    const key = providerKeys[provider]?.key || '';
    setSavingProvider(provider);
    try {
      const resp = await fetch('/api/ai/keys/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: { [provider]: key } }) });
      const data = await resp.json();
      if (data.ok) { showToast?.(`${provider} API key saved`, 'success'); setHasChanges(prev => { const n = new Set(prev); n.delete(provider); return n; }); }
      else showToast?.(`Failed to save: ${data.error}`, 'error');
    } catch (e) { showToast?.(`Failed to save: ${(e as Error).message}`, 'error'); }
    finally { setSavingProvider(null); }
  }, [providerKeys, showToast]);

  const handleConnect = useCallback(async (provider: string) => {
    const key = providerKeys[provider]?.key || '';
    if (!key) { showToast?.(`Enter an API key for ${provider} first`, 'error'); return; }
    setConnectingProvider(provider);
    try {
      await fetch('/api/ai/keys/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: { [provider]: key } }) });
      setHasChanges(prev => { const n = new Set(prev); n.delete(provider); return n; });
      const resp = await fetch('/api/ai/keys/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) });
      const data = await resp.json();
      if (data.ok) { showToast?.(data.message || `Connected to ${provider}!`, 'success'); setConnectedProviders(prev => new Set(prev).add(provider)); }
      else { showToast?.(data.message || `Connection failed for ${provider}`, 'error'); setConnectedProviders(prev => { const n = new Set(prev); n.delete(provider); return n; }); }
    } catch (e) { showToast?.(`Connection test failed: ${(e as Error).message}`, 'error'); }
    finally { setConnectingProvider(null); }
  }, [providerKeys, showToast]);

  const handleElevenLabsSave = useCallback(async () => {
    setElevenLabsSaving(true);
    try {
      const saveRes = await fetch('/api/ai/keys/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: { ElevenLabs: elevenLabsKey } }) });
      const saveData = await saveRes.json();
      if (!saveData.ok) { showToast?.('Failed to save key', 'error'); return; }
      setElevenLabsChanged(false);
      const res = await fetch('/api/ai/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Connected.' }) });
      if (res.ok) { setElevenLabsSaved(true); showToast?.('ElevenLabs connected successfully', 'success'); }
      else { const err = await res.json().catch(() => ({})); showToast?.(err.error || 'Connection failed — check your API key', 'error'); setElevenLabsSaved(false); }
    } catch { showToast?.('Connection failed', 'error'); }
    finally { setElevenLabsSaving(false); }
  }, [elevenLabsKey, showToast]);

  const connectedCount = connectedProviders.size;
  const totalProviders = providerList.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#5D5FEF]" />
      </div>
    );
  }

  const renderProviderSection = (provider: string) => {
    const models = modelsByProvider[provider];
    const providerKey = getProviderKey(provider);
    const isVisible = visibleKeys.has(provider);
    const hasApiKey = hasKey(provider);
    const isConnecting = connectingProvider === provider;
    const isSaving = savingProvider === provider;
    const isConnected = connectedProviders.has(provider);
    const hasUnsaved = hasChanges.has(provider);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center p-2 ${models[0]?.bg || 'bg-gray-50'}`}>
              <img src={models[0]?.icon || '/assets/models/gemini-color.svg'} alt={provider} className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{provider}</h2>
                {isConnected && <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
              </div>
              <p className="text-xs text-gray-400">{models.length} model{models.length !== 1 ? 's' : ''}{isConnected ? ' · Connected' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => handleConnect(provider)}
            disabled={!hasApiKey || isConnecting}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              isConnecting ? 'bg-gray-100 text-gray-400'
              : isConnected ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
              : hasApiKey ? 'bg-[#5D5FEF] text-white hover:bg-[#4B4DD4] shadow-sm shadow-[#5D5FEF]/20'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            {isConnecting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : isConnected ? <><Plug className="w-4 h-4" /> Connected</> : <><Plug className="w-4 h-4" /> Connect</>}
          </button>
        </div>

        {/* API Key Input */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">API Key</label>
          <div className="relative">
            <input
              type={isVisible ? 'text' : 'password'}
              value={providerKey}
              onChange={(e) => handleKeyChange(provider, e.target.value)}
              placeholder={`Enter ${provider} API key`}
              className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-[#5D5FEF]/30 focus:ring-2 focus:ring-[#5D5FEF]/10 transition-all text-sm outline-none placeholder:text-gray-400 font-mono pr-32"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {hasApiKey && (
                <>
                  <button onClick={() => toggleVisibility(provider)} className="p-2 rounded-lg hover:bg-gray-50 transition-all">
                    {isVisible ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                  </button>
                  <button onClick={() => { navigator.clipboard?.writeText(providerKey); showToast?.('Copied to clipboard', 'success'); }} className="p-2 rounded-lg hover:bg-gray-50 transition-all">
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                </>
              )}
              {hasUnsaved && (
                <button onClick={() => handleSave(provider)} disabled={isSaving} className="p-2 rounded-lg bg-[#5D5FEF] hover:bg-[#4B4DD4] transition-all">
                  {isSaving ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Save className="w-4 h-4 text-white" />}
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">One key works for all {provider} models below.</p>
        </div>

        {/* Models list */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Available Models</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {models.map((model) => (
              <div key={model.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F5F7]">
                <div className={`w-7 h-7 rounded-lg ${model.bg} flex items-center justify-center p-1 flex-shrink-0`}>
                  <img src={model.icon || '/assets/models/gemini-color.svg'} alt={model.provider} className="w-full h-full object-contain" />
                </div>
                <p className="text-xs font-bold text-gray-800 truncate">{model.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="py-2">
      {/* ── Header ── */}
      <div className="mb-6 md:mb-8 pb-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 md:h-10 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full flex-shrink-0" />
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 tracking-tight">AI Models</h1>
            <p className="text-sm text-gray-500 mt-1">Configure API keys by provider — one key works for all models.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* ── Sidebar Navigation ── */}
        <nav className="w-full md:w-52 flex-shrink-0">
          <div className="space-y-1">
            <button
              onClick={() => setActiveSection('overview')}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-all text-[14px] font-medium ${
                activeSection === 'overview' ? 'bg-[#F5F5F7] text-gray-900' : 'text-gray-500 hover:bg-[#F5F5F7] hover:text-gray-900'
              }`}
            >
              <Bot className={`w-[18px] h-[18px] flex-shrink-0 ${activeSection === 'overview' ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
              Overview
            </button>

            <div className="pt-2 pb-1 px-4">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Providers</p>
            </div>

            {providerList.map((provider) => {
              const isActive = activeSection === provider;
              const isConnected = connectedProviders.has(provider);
              const models = modelsByProvider[provider];
              return (
                <button
                  key={provider}
                  onClick={() => setActiveSection(provider)}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-all text-[14px] font-medium ${
                    isActive ? 'bg-[#F5F5F7] text-gray-900' : 'text-gray-500 hover:bg-[#F5F5F7] hover:text-gray-900'
                  }`}
                >
                  <div className={`w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 overflow-hidden ${isActive ? '' : 'grayscale opacity-60'}`}>
                    <img src={models[0]?.icon || '/assets/models/gemini-color.svg'} alt={provider} className="w-full h-full object-contain" />
                  </div>
                  <span className="flex-1 truncate">{provider}</span>
                  {isConnected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
                </button>
              );
            })}

            <div className="pt-2 pb-1 px-4">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Services</p>
            </div>

            <button
              onClick={() => setActiveSection('services')}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-all text-[14px] font-medium ${
                activeSection === 'services' ? 'bg-[#F5F5F7] text-gray-900' : 'text-gray-500 hover:bg-[#F5F5F7] hover:text-gray-900'
              }`}
            >
              <Layers className={`w-[18px] h-[18px] flex-shrink-0 ${activeSection === 'services' ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
              <span className="flex-1">ElevenLabs</span>
              {elevenLabsSaved && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
            </button>
          </div>
        </nav>

        {/* ── Content Area ── */}
        <div className="flex-1 min-w-0">

          {/* ═══ Overview ═══ */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Provider Overview</h2>
                <p className="text-sm text-gray-400">API key status for all providers.</p>
              </div>

              <div className="rounded-2xl sm:rounded-3xl bg-[#1d1d1f] border border-[#2d2d2f] p-6 sm:p-8 md:p-10 shadow-xl shadow-black/10 overflow-hidden relative">
                <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#5D5FEF]/15 blur-3xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Key className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Connected Providers</p>
                        <p className="text-2xl sm:text-3xl font-heading font-bold text-white leading-tight">
                          {connectedCount}/{totalProviders}
                        </p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-5 md:gap-8">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Models</p>
                        <p className="text-lg md:text-xl font-heading font-bold text-white">{AI_MODELS.length}</p>
                      </div>
                      <div className="w-px h-10 bg-white/10" />
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Providers</p>
                        <p className="text-lg md:text-xl font-heading font-bold text-white">{totalProviders}</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/10 mb-3 overflow-hidden">
                    <div className="h-full bg-[#5D5FEF] rounded-full transition-all duration-700" style={{ width: `${totalProviders > 0 ? (connectedCount / totalProviders) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[11px] font-bold text-white/40">
                    {connectedCount === 0 ? 'No providers connected. Add API keys to get started.' : connectedCount === totalProviders ? 'All providers connected.' : `${totalProviders - connectedCount} provider${totalProviders - connectedCount !== 1 ? 's' : ''} remaining.`}
                  </p>
                </div>
              </div>

              {/* Provider cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {providerList.map((provider) => {
                  const models = modelsByProvider[provider];
                  const isConnected = connectedProviders.has(provider);
                  const hasApiKey = hasKey(provider);
                  return (
                    <button key={provider} onClick={() => setActiveSection(provider)} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3 min-h-[110px] text-left hover:border-[#5D5FEF]/20 transition-all">
                      <div className="flex items-center justify-between">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center p-1.5 ${models[0]?.bg || 'bg-gray-50'}`}>
                          <img src={models[0]?.icon || '/assets/models/gemini-color.svg'} alt={provider} className="w-full h-full object-contain" />
                        </div>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : hasApiKey ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">{provider}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{models.length} model{models.length !== 1 ? 's' : ''}</p>
                      </div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-auto ${isConnected ? 'text-emerald-600' : hasApiKey ? 'text-[#5D5FEF]' : 'text-gray-300'}`}>
                        {isConnected ? 'Connected' : hasApiKey ? 'Key Set' : 'Not configured'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ Provider Sections ═══ */}
          {providerList.includes(activeSection) && renderProviderSection(activeSection)}

          {/* ═══ Services (ElevenLabs) ═══ */}
          {activeSection === 'services' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 p-2">
                    <img src="/assets/models/elevenlabs.svg" alt="ElevenLabs" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">ElevenLabs</h2>
                      {elevenLabsSaved && <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                    </div>
                    <p className="text-xs text-gray-400">Text-to-Speech · Read AI responses aloud</p>
                  </div>
                </div>
                <button
                  onClick={handleElevenLabsSave}
                  disabled={!elevenLabsKey || elevenLabsSaving}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    elevenLabsSaving ? 'bg-gray-100 text-gray-400'
                    : elevenLabsSaved ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                    : elevenLabsKey ? 'bg-[#5D5FEF] text-white hover:bg-[#4B4DD4] shadow-sm shadow-[#5D5FEF]/20'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {elevenLabsSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : elevenLabsSaved ? <><Plug className="w-4 h-4" /> Connected</> : <><Plug className="w-4 h-4" /> Connect</>}
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">API Key</label>
                <div className="relative">
                  <input
                    type={elevenLabsVisible ? 'text' : 'password'}
                    value={elevenLabsKey}
                    onChange={(e) => { setElevenLabsKey(e.target.value); setElevenLabsChanged(true); }}
                    placeholder="Enter ElevenLabs API key"
                    className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-[#5D5FEF]/30 focus:ring-2 focus:ring-[#5D5FEF]/10 transition-all text-sm outline-none placeholder:text-gray-400 font-mono pr-24"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {elevenLabsKey && (
                      <>
                        <button onClick={() => setElevenLabsVisible(v => !v)} className="p-2 rounded-lg hover:bg-gray-50 transition-all">
                          {elevenLabsVisible ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button onClick={() => { navigator.clipboard?.writeText(elevenLabsKey); showToast?.('Copied', 'success'); }} className="p-2 rounded-lg hover:bg-gray-50 transition-all">
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                      </>
                    )}
                    {elevenLabsChanged && (
                      <button onClick={handleElevenLabsSave} disabled={elevenLabsSaving} className="p-2 rounded-lg bg-[#5D5FEF] hover:bg-[#4B4DD4] transition-all">
                        {elevenLabsSaving ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Save className="w-4 h-4 text-white" />}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Get your API key at <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-[#5D5FEF] hover:underline">elevenlabs.io</a> — enables the speak button on AI responses.</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AIModelsView;
