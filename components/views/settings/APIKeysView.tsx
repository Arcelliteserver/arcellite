import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, Check, Plug, Loader2, Save } from 'lucide-react';
import { AI_MODELS } from '../../../constants';

interface ProviderAPIKey {
  provider: string;
  key: string;
  isVisible: boolean;
}

interface APIKeysViewProps {
  showToast?: (message: string, type: 'success' | 'error') => void;
}

const APIKeysView: React.FC<APIKeysViewProps> = ({ showToast }) => {
  const [providerKeys, setProviderKeys] = useState<Record<string, ProviderAPIKey>>({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState<Set<string>>(new Set());

  // Group models by provider
  const modelsByProvider = AI_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof AI_MODELS>);

  const initEmpty = () => {
    const initial: Record<string, ProviderAPIKey> = {};
    Object.keys(modelsByProvider).forEach((provider) => {
      initial[provider] = { provider, key: '', isVisible: false };
    });
    setProviderKeys(initial);
  };

  // Load saved keys on mount and mark providers with keys as connected
  useEffect(() => {
    fetch('/api/ai/keys/load')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.keys) {
          const initial: Record<string, ProviderAPIKey> = {};
          const alreadyConnected = new Set<string>();
          Object.keys(modelsByProvider).forEach((provider) => {
            initial[provider] = { provider, key: data.keys[provider] || '', isVisible: false };
            if (data.keys[provider]) {
              alreadyConnected.add(provider);
            }
          });
          setProviderKeys(initial);
          setConnectedProviders(alreadyConnected);
        } else {
          initEmpty();
        }
      })
      .catch(() => initEmpty());
  }, []);

  const toggleVisibility = (provider: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  const handleKeyChange = (provider: string, value: string) => {
    setProviderKeys((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], key: value },
    }));
    setHasChanges((prev) => new Set(prev).add(provider));
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast?.('Copied to clipboard', 'success');
  };

  const handleSave = async (provider: string) => {
    const key = providerKeys[provider]?.key || '';
    setSavingProvider(provider);
    try {
      const resp = await fetch('/api/ai/keys/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: { [provider]: key } }),
      });
      const data = await resp.json();
      if (data.ok) {
        showToast?.(`${provider} API key saved`, 'success');
        setHasChanges((prev) => { const n = new Set(prev); n.delete(provider); return n; });
      } else {
        showToast?.(`Failed to save: ${data.error}`, 'error');
      }
    } catch (e) {
      showToast?.(`Failed to save: ${(e as Error).message}`, 'error');
    } finally {
      setSavingProvider(null);
    }
  };

  const handleConnect = async (provider: string) => {
    const key = providerKeys[provider]?.key || '';
    if (!key) {
      showToast?.(`Enter an API key for ${provider} first`, 'error');
      return;
    }
    setConnectingProvider(provider);
    try {
      // Save key first
      await fetch('/api/ai/keys/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: { [provider]: key } }),
      });
      setHasChanges((prev) => { const n = new Set(prev); n.delete(provider); return n; });

      // Test connection
      const resp = await fetch('/api/ai/keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await resp.json();
      if (data.ok) {
        showToast?.(data.message || `Connected to ${provider}!`, 'success');
        setConnectedProviders((prev) => new Set(prev).add(provider));
      } else {
        showToast?.(data.message || `Connection failed for ${provider}`, 'error');
        setConnectedProviders((prev) => { const n = new Set(prev); n.delete(provider); return n; });
      }
    } catch (e) {
      showToast?.(`Connection test failed: ${(e as Error).message}`, 'error');
    } finally {
      setConnectingProvider(null);
    }
  };

  const getProviderKey = (provider: string) => providerKeys[provider]?.key || '';
  const hasKey = (provider: string) => !!providerKeys[provider]?.key;

  return (
    <div className="w-full">
      <div className="mb-6 md:mb-10">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            AI Models
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-xs md:text-sm pl-3 sm:pl-4 md:pl-6">
          Configure API keys by provider — one key works for all models from the same provider
        </p>
      </div>

      <div className="space-y-4 md:space-y-6">
        {Object.entries(modelsByProvider).map(([provider, models]) => {
          const providerKey = getProviderKey(provider);
          const isVisible = visibleKeys.has(provider);
          const hasApiKey = hasKey(provider);
          const isConnecting = connectingProvider === provider;
          const isSaving = savingProvider === provider;
          const isConnected = connectedProviders.has(provider);
          const hasUnsaved = hasChanges.has(provider);

          return (
            <div
              key={provider}
              className={`bg-white rounded-xl md:rounded-[2rem] border-2 p-5 md:p-6 lg:p-8 shadow-sm transition-all ${
                isConnected
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : hasApiKey
                  ? 'border-[#5D5FEF]/30 bg-[#5D5FEF]/5'
                  : 'border-gray-100'
              }`}
            >
              {/* Provider Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-sm p-2.5 ${models[0]?.bg || 'bg-gray-50'}`}>
                    <img src={models[0]?.icon || '/assets/models/gemini-color.svg'} alt={provider} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-black text-gray-900">{provider}</h2>
                      {isConnected && (
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      {hasApiKey && !isConnected && (
                        <div className="w-6 h-6 bg-[#5D5FEF] rounded-full flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {models.length} {models.length === 1 ? 'model' : 'models'} available
                      {isConnected && <span className="ml-2 text-emerald-500 font-bold">• Connected</span>}
                    </p>
                  </div>
                </div>

                {/* Connect Button */}
                <button
                  onClick={() => handleConnect(provider)}
                  disabled={!hasApiKey || isConnecting}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[12px] transition-all ${
                    isConnecting
                      ? 'bg-gray-100 text-gray-400 cursor-wait'
                      : isConnected
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-200'
                      : hasApiKey
                      ? 'bg-[#5D5FEF] text-white hover:bg-[#4B4DDC] shadow-lg shadow-[#5D5FEF]/30'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {isConnecting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>Testing...</span></>
                  ) : isConnected ? (
                    <><Plug className="w-4 h-4" /><span>Connected</span></>
                  ) : (
                    <><Plug className="w-4 h-4" /><span>Connect</span></>
                  )}
                </button>
              </div>

              {/* API Key Input */}
              <div className="mb-6">
                <label className="text-[11px] font-black text-gray-300 uppercase tracking-widest mb-3 block">API Key</label>
                <div className="relative">
                  <input
                    type={isVisible ? 'text' : 'password'}
                    value={providerKey}
                    onChange={(e) => handleKeyChange(provider, e.target.value)}
                    placeholder={`Enter ${provider} API key`}
                    className="w-full px-4 py-3.5 bg-white rounded-2xl border-2 border-gray-100 focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] outline-none placeholder:text-gray-400 font-mono pr-36"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {hasApiKey && (
                      <>
                        <button onClick={() => toggleVisibility(provider)} className="p-2 rounded-lg hover:bg-gray-50 transition-all" title={isVisible ? 'Hide key' : 'Show key'}>
                          {isVisible ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button onClick={() => copyToClipboard(providerKey)} className="p-2 rounded-lg hover:bg-gray-50 transition-all" title="Copy to clipboard">
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                      </>
                    )}
                    {hasUnsaved && (
                      <button onClick={() => handleSave(provider)} disabled={isSaving} className="p-2 rounded-lg bg-[#5D5FEF] hover:bg-[#4B4DDC] transition-all" title="Save key">
                        {isSaving ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Save className="w-4 h-4 text-white" />}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">This API key will work for all {provider} models listed below</p>
              </div>

              {/* Models List */}
              <div className="pt-6 border-t border-gray-100">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4">Available Models</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {models.map((model) => (
                    <div key={model.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className={`w-8 h-8 rounded-lg ${model.bg} flex items-center justify-center p-1.5 flex-shrink-0`}>
                        <img src={model.icon || '/assets/models/gemini-color.svg'} alt={model.provider} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-gray-900 truncate">{model.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default APIKeysView;
