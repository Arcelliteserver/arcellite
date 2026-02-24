import React, { useState } from 'react';
import {
  Download, CheckCircle2, AlertCircle, Loader2, ExternalLink, Zap, X,
  MessageSquare, Tv2, FolderOpen, Home, Cloud, PlugZap,
} from 'lucide-react';

// ─── Workflow catalogue ───────────────────────────────────────────────────────

interface Workflow {
  file: string;
  name: string;
  description: string;
  tags: string[];
  Icon: React.FC<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  integrations: string[];
}

const WORKFLOWS: Workflow[] = [
  {
    file: 'AI to Discord - Send Messages via Webhook.json',
    name: 'AI to Discord',
    description: 'Let Arcellite AI send messages to any Discord channel via webhook. Supports text, embeds, and file links.',
    tags: ['AI', 'Communication'],
    Icon: MessageSquare,
    iconBg: '',
    iconColor: '',
    integrations: ['Discord', 'AI'],
  },
  {
    file: 'Chromecast Webhook - Cast from Website (Multi-Device).json',
    name: 'Chromecast Cast',
    description: 'Cast media from Arcellite directly to any Chromecast device on your home network via Home Assistant.',
    tags: ['Smart Home', 'Media'],
    Icon: Tv2,
    iconBg: '',
    iconColor: '',
    integrations: ['Home Assistant'],
  },
  {
    file: 'Google Drive File Manager.json',
    name: 'Google Drive Sync',
    description: 'Manage Google Drive files — upload, list, and download without leaving Arcellite.',
    tags: ['Cloud Storage'],
    Icon: FolderOpen,
    iconBg: '',
    iconColor: '',
    integrations: ['Google Drive'],
  },
  {
    file: 'Home LAB.json',
    name: 'Home Lab AI',
    description: 'Full home lab assistant powered by DeepSeek AI. Manages tasks via Discord with structured outputs.',
    tags: ['AI', 'Home Lab', 'Discord'],
    Icon: Home,
    iconBg: '',
    iconColor: '',
    integrations: ['Discord', 'DeepSeek'],
  },
  {
    file: 'OneDrive File Manager.json',
    name: 'OneDrive Sync',
    description: 'Manage OneDrive files directly from Arcellite — browse, upload, and download seamlessly.',
    tags: ['Cloud Storage'],
    Icon: Cloud,
    iconBg: '',
    iconColor: '',
    integrations: ['OneDrive'],
  },
];

// ─── Helper: read connected n8n/MCP credentials from ConnectAppsSection ───────

interface N8nCredentials {
  apiUrl: string;
  apiKey: string;
  name: string;
}

function getConnectedN8n(): N8nCredentials | null {
  try {
    const stateRaw = localStorage.getItem('connectAppsV2');
    const instancesRaw = localStorage.getItem('mcpInstances');
    if (!stateRaw) return null;

    const state = JSON.parse(stateRaw) as Record<
      string,
      { connected: boolean; fields: Record<string, string>; statusMessage?: string }
    >;

    // Check MCP instances (n8n is connected via MCP)
    if (instancesRaw) {
      const instances = JSON.parse(instancesRaw) as Array<{ id: string }>;
      for (const { id } of instances) {
        const conn = state[id];
        if (conn?.connected && conn.fields?.apiUrl && conn.fields?.apiKey) {
          return {
            apiUrl: conn.fields.apiUrl,
            apiKey: conn.fields.apiKey,
            name: conn.fields.name || 'n8n',
          };
        }
      }
    }
  } catch {}
  return null;
}

// ─── Not-connected modal ──────────────────────────────────────────────────────

interface NotConnectedModalProps {
  workflow: Workflow;
  onClose: () => void;
}

const NotConnectedModal: React.FC<NotConnectedModalProps> = ({ workflow, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-150">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-bold text-[#5D5FEF] uppercase tracking-widest mb-1">Install Workflow</p>
          <h3 className="text-sm font-bold text-gray-900">{workflow.name}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-5">
        <PlugZap className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[12px] font-bold text-amber-800 mb-1">n8n not connected</p>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            To install this workflow, connect your n8n instance first. Go to{' '}
            <span className="font-bold">My Apps → Connect</span>, add an MCP Server, and enter your n8n URL and API key.
          </p>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full py-2.5 rounded-xl bg-[#5D5FEF] text-white text-xs font-bold hover:bg-[#4B4DD4] transition-all active:scale-95"
      >
        Got it
      </button>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const MarketSection: React.FC = () => {
  const [notConnectedFor, setNotConnectedFor] = useState<Workflow | null>(null);
  // Per-card state — so installing/errors on one card never affect another
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInstall = async (wf: Workflow) => {
    const n8n = getConnectedN8n();
    if (!n8n) {
      setNotConnectedFor(wf);
      return;
    }

    setInstalling(prev => new Set([...prev, wf.file]));
    setErrors(prev => { const n = { ...prev }; delete n[wf.file]; return n; });
    try {
      const wfRes = await fetch(`/json/${encodeURIComponent(wf.file)}`);
      if (!wfRes.ok) throw new Error('Could not load workflow file');
      const wfJson = await wfRes.json();

      // Use backend proxy to avoid browser CSP blocking direct calls to n8n
      const res = await fetch('/api/apps/n8n/install-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: n8n.apiUrl, apiKey: n8n.apiKey, workflowJson: wfJson }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      }
      setInstalled(prev => new Set([...prev, wf.file]));
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [wf.file]: e.message || String(e) }));
    } finally {
      setInstalling(prev => { const n = new Set(prev); n.delete(wf.file); return n; });
    }
  };

  return (
    <>
      {/* Header hint */}
      <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl bg-[#5D5FEF]/5 border border-[#5D5FEF]/10">
        <div className="w-8 h-8 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-[#5D5FEF]" />
        </div>
        <p className="text-[12px] text-gray-600 leading-relaxed">
          <span className="font-bold text-gray-800">Automation workflows</span> — Connect your n8n in{' '}
          <span className="font-bold text-gray-800">My Apps → Connect</span>, then install workflows directly with one click.
        </p>
      </div>

      {/* Workflow cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-300">
        {WORKFLOWS.map(wf => {
          const isInstalled = installed.has(wf.file);
          const isInstalling = installing.has(wf.file);
          const err = errors[wf.file] ?? null;

          return (
            <div
              key={wf.file}
              className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:border-[#5D5FEF]/20 hover:shadow-md transition-all duration-300"
            >
              <div className="flex-1 flex flex-col min-w-0 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 leading-tight">{wf.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {wf.tags.map(tag => (
                        <span key={tag} className="text-[11px] font-semibold px-1.5 py-px rounded bg-[#5D5FEF]/10 text-[#5D5FEF]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isInstalled && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Installed
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {wf.integrations.map(int => (
                    <span key={int} className="text-[10px] font-semibold px-1.5 py-px rounded bg-gray-100 text-gray-500">
                      {int}
                    </span>
                  ))}
                </div>

                <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2 flex-1">{wf.description}</p>

                {isInstalled && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-700 mt-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Installed to n8n
                  </div>
                )}

                {err && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-100 mt-3">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-600 font-medium">{err}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <a
                    href={`/json/${encodeURIComponent(wf.file)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#5D5FEF] hover:border-[#5D5FEF]/30 transition-all"
                    title="View JSON"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => handleInstall(wf)}
                    disabled={isInstalling}
                    className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-60 ${
                      isInstalled
                        ? 'border border-gray-200 text-gray-600 hover:border-[#5D5FEF]/30 hover:text-[#5D5FEF]'
                        : 'bg-[#5D5FEF] text-white hover:bg-[#4B4DD4] shadow-sm shadow-[#5D5FEF]/15'
                    }`}
                  >
                    {isInstalling
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />}
                    {isInstalling ? 'Installing\u2026' : isInstalled ? 'Reinstall' : 'Install to n8n'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Not connected modal */}
      {notConnectedFor && (
        <NotConnectedModal
          workflow={notConnectedFor}
          onClose={() => setNotConnectedFor(null)}
        />
      )}
    </>
  );
};

export default MarketSection;
