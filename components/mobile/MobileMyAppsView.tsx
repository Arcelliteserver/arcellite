import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, RefreshCw, AlertCircle, Check, X, ExternalLink, ArrowRight, CheckCircle2, XCircle, Plus, ChevronRight, ArrowLeft } from 'lucide-react';

/* ────────────────────────────────────────────────────────
   Types & constants — IDENTICAL to desktop MyAppsView
   ──────────────────────────────────────────────────────── */

interface GoogleFile {
  id?: string;
  name?: string;
  type?: 'doc' | 'sheet' | 'slide';
  mimeType?: string;
  url?: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  modified?: string;
  size?: number | string;
  created?: string;
  [key: string]: any;
}

interface AppChild {
  name: string;
  icon: string;
  status: 'connected' | 'disconnected';
}

interface DiscordChannel {
  id: string;
  name: string;
  type?: string;
}

interface DiscordWebhooks {
  channelsUrl: string;
  sendUrl: string;
}

interface AppConnection {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  statusMessage?: string;
  children?: AppChild[];
  files?: GoogleFile[];
  webhookUrl?: string;
  discordWebhooks?: DiscordWebhooks;
  discordChannels?: DiscordChannel[];
}

// No pre-filled apps — user must configure each app manually

const ALL_POSSIBLE_APPS = [
  {
    id: 'google-drive', name: 'Google Drive', icon: '/assets/apps/google-drive.svg',
    children: [
      { name: 'Google Docs', icon: '/assets/apps/google-docs.svg', status: 'disconnected' as const },
      { name: 'Google Sheets', icon: '/assets/apps/google-sheets.svg', status: 'disconnected' as const },
      { name: 'Google Slides', icon: '/assets/apps/google-slides.svg', status: 'disconnected' as const },
    ],
  },
  { id: 'microsoft-onedrive', name: 'Microsoft OneDrive', icon: '/assets/apps/microsoft-onedrive.svg' },
  { id: 'dropbox', name: 'Dropbox', icon: '/assets/apps/dropbox.svg' },
  { id: 'slack', name: 'Slack', icon: '/assets/apps/slack.svg' },
  { id: 'discord', name: 'Discord', icon: '/assets/apps/discord.svg' },
  { id: 'azure', name: 'Azure', icon: '/assets/apps/azure.svg' },
  { id: 'postgresql', name: 'PostgreSQL', icon: '/assets/apps/postgresql.svg' },
  { id: 'mysql', name: 'MySQL', icon: '/assets/apps/mysql.svg' },
  { id: 'n8n', name: 'n8n', icon: '/assets/apps/n8n.svg' },
  { id: 'mcp', name: 'MCP', icon: '/assets/apps/mcp.svg' },
];

/* ────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────── */

const MobileMyAppsView: React.FC = () => {
  // Force-clear stale data on version bump — clears localStorage AND server
  const justMigrated = React.useRef(false);
  if (localStorage.getItem('myapps_version') !== 'v3') {
    localStorage.removeItem('connectedApps');
    localStorage.removeItem('connectedAppIds');
    localStorage.setItem('myapps_version', 'v3');
    justMigrated.current = true;
    const token = localStorage.getItem('sessionToken');
    if (token) {
      fetch('/api/apps/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apps: [], connectedAppIds: [] }),
      }).catch(() => {});
    }
  }

  /* ═══════ State — IDENTICAL to desktop ═══════ */
  const [apps, setApps] = useState<AppConnection[]>(() => {
    const saved = localStorage.getItem('connectedApps');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0)
          return parsed.map((a: any) => a.status === 'error' ? { ...a, status: 'disconnected', statusMessage: undefined } : a);
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connectedAppIds, setConnectedAppIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('connectedAppIds');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      } catch {}
    }
    return new Set();
  });
  const [selectedNewApp, setSelectedNewApp] = useState<typeof ALL_POSSIBLE_APPS[0] | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [dbCredentials, setDbCredentials] = useState({ host: '', port: '', username: '', password: '', database: '' });
  const [apiCredentials, setApiCredentials] = useState({ apiUrl: '', apiKey: '' });
  const [discordWebhooks, setDiscordWebhooks] = useState<DiscordWebhooks>({ channelsUrl: '', sendUrl: '' });
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [expandedFileCategories, setExpandedFileCategories] = useState<Set<string>>(new Set());
  const [collapsedConnectedApps, setCollapsedConnectedApps] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('connectedAppIds');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      } catch {}
    }
    return new Set();
  });

  // Full-page connect flow: null = main list, 'select' = pick app, 'configure' = enter creds, 'status' = result
  const [connectPage, setConnectPage] = useState<null | 'select' | 'configure' | 'status'>(null);
  // Track whether we're modifying an existing app (vs adding new)
  const [modifyingAppId, setModifyingAppId] = useState<string | null>(null);
  // Deferred auto-connect: set an appId here, and a useEffect will call connectApp once the apps state is updated
  const [pendingConnectId, setPendingConnectId] = useState<string | null>(null);

  /* ═══════ Helpers: server persistence ═══════ */
  const saveToServer = async (appsData: AppConnection[], idsData: Set<string>) => {
    try {
      const token = localStorage.getItem('sessionToken');
      if (!token) return;
      await fetch('/api/apps/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apps: appsData, connectedAppIds: Array.from(idsData) }),
      });
    } catch {}
  };

  /* ═══════ Effects ═══════ */
  // On mount: load from server (cross-device sync), fall back to localStorage
  useEffect(() => {
    // Skip loading from server if we just cleared everything in this session
    if (!justMigrated.current) {
      const loadFromServer = async () => {
        try {
          const token = localStorage.getItem('sessionToken');
          if (!token) return;
          const resp = await fetch('/api/apps/connections', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!resp.ok) return;
          const data = await resp.json();
          if (data.apps && Array.isArray(data.apps) && data.apps.length > 0) {
            const cleaned = data.apps.map((a: any) => a.status === 'error' ? { ...a, status: 'disconnected', statusMessage: undefined } : a);
            setApps(cleaned);
            localStorage.setItem('connectedApps', JSON.stringify(cleaned));
          }
          if (data.connectedAppIds && Array.isArray(data.connectedAppIds)) {
            const ids = new Set<string>(data.connectedAppIds);
            setConnectedAppIds(ids);
            localStorage.setItem('connectedAppIds', JSON.stringify(data.connectedAppIds));
            setCollapsedConnectedApps(ids);
          }
        } catch {}
      };
      loadFromServer();
    }

    // Sync apps state with connectedAppIds on mount
    setApps(prev => prev.map(app => {
      if (connectedAppIds.has(app.id) && app.status !== 'connected') {
        return { ...app, status: 'connected' };
      }
      return app;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save apps to localStorage + server
  useEffect(() => {
    localStorage.setItem('connectedApps', JSON.stringify(apps));
    window.dispatchEvent(new Event('apps-updated'));
    saveToServer(apps, connectedAppIds);
  }, [apps]);

  // Save connected app IDs to localStorage + server
  useEffect(() => {
    localStorage.setItem('connectedAppIds', JSON.stringify(Array.from(connectedAppIds)));
    window.dispatchEvent(new Event('apps-updated'));
    saveToServer(apps, connectedAppIds);
  }, [connectedAppIds]);

  // Auto-connect a pending app after it's been added to state
  useEffect(() => {
    if (pendingConnectId && apps.some(a => a.id === pendingConnectId)) {
      connectApp(pendingConnectId);
      setPendingConnectId(null);
    }
  }, [apps, pendingConnectId]);

  /* ═══════ Handlers — IDENTICAL to desktop ═══════ */
  const fetchN8nWorkflows = async (apiUrl: string, apiKey: string, appId?: string) => {
    if (!apiUrl || !apiKey) throw new Error('API URL and API Key are required');
    try { new URL(apiUrl); } catch { throw new Error('Invalid API URL format.'); }
    const response = await fetch('/api/apps/n8n/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiUrl, apiKey, apiType: appId }),
    });
    if (!response.ok) {
      let msg = `HTTP ${response.status}`;
      try {
        const d = await response.json();
        msg = typeof d.error === 'string' ? d.error : d.message || msg;
      } catch {}
      if (response.status === 401) throw new Error('Unauthorized (401): Invalid Bearer token or API key.');
      if (response.status === 406) throw new Error('Not Acceptable (406): Server configuration error.');
      if (response.status === 404) throw new Error('Not Found (404): API URL or endpoint does not exist.');
      if (response.status === 403) throw new Error("Forbidden (403): Credentials don't have permission.");
      if (response.status >= 500) throw new Error(`Server Error (${response.status}): Try again later.`);
      if (response.status === 400) throw new Error(msg || 'Bad Request (400).');
      throw new Error(msg);
    }
    const data = await response.json();
    const workflows = Array.isArray(data) ? data : (data.data || data || []);
    if (!Array.isArray(workflows)) throw new Error('Unexpected response format');
    return workflows;
  };

  const fetchDatabases = async (type: string, host: string, port: string, username: string, password: string, dbName: string) => {
    if (!type || !host || !port || !username) throw new Error('Database credentials required');
    const response = await fetch('/api/apps/database/databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, host, port, username, password, database: dbName }),
    });
    if (!response.ok) {
      let msg = `HTTP ${response.status}`;
      try {
        const d = await response.json();
        msg = typeof d.error === 'string' ? d.error : d.message || msg;
      } catch {}
      if (response.status === 401 || response.status === 403) throw new Error('Authentication failed: Invalid username or password.');
      if (response.status === 404) throw new Error(`Cannot connect to ${type} server at ${host}:${port}.`);
      if (response.status >= 500) throw new Error(`Server Error: ${msg}`);
      throw new Error(msg);
    }
    const data = await response.json();
    if (!data.databases || !Array.isArray(data.databases)) throw new Error('Unexpected response');
    return data.databases as string[];
  };

  const isDatabaseApp = (id?: string) => id && (id === 'postgresql' || id === 'mysql' || id.startsWith('postgresql-') || id.startsWith('mysql-'));
  const isApiApp = (id?: string) => id && (id === 'n8n' || id === 'mcp' || id.startsWith('n8n-') || id.startsWith('mcp-'));
  const isDiscordApp = (id?: string) => id === 'discord';

  const connectApp = async (appId: string) => {
    const app = apps.find(a => a.id === appId);
    if (!app) return;
    setLoading(prev => ({ ...prev, [appId]: true }));
    setError(null);
    try {
      // Database apps: connect via fetchDatabases
      if (isDatabaseApp(appId) && (app as any).credentials) {
        const creds = (app as any).credentials;
        const databases = await fetchDatabases(appId, creds.host, creds.port, creds.username, creds.password, creds.database);
        setConnectedAppIds(prev => new Set([...prev, appId]));
        setCollapsedConnectedApps(prev => new Set([...prev, appId]));
        setApps(prevApps => prevApps.map(a => a.id === appId ? {
          ...a, status: 'connected', statusMessage: `${databases.length} database(s) found`,
          files: databases.map((n: string) => ({ id: n, name: n, type: 'database' })),
        } : a));
        setError(null);
        setLoading(prev => ({ ...prev, [appId]: false }));
        return;
      }
      // API apps (n8n, MCP): connect via fetchN8nWorkflows
      if (isApiApp(appId) && (app as any).apiCredentials) {
        const apiCreds = (app as any).apiCredentials;
        const workflows = await fetchN8nWorkflows(apiCreds.apiUrl, apiCreds.apiKey, appId);
        const isMcp = appId === 'mcp' || appId.startsWith('mcp-');
        setConnectedAppIds(prev => new Set([...prev, appId]));
        setCollapsedConnectedApps(prev => new Set([...prev, appId]));
        setApps(prevApps => prevApps.map(a => a.id === appId ? {
          ...a, status: 'connected',
          statusMessage: isMcp ? 'MCP Server Connected' : `${workflows.length} workflow(s) found`,
          files: !isMcp ? workflows.map((w: any) => ({ id: w.id, name: w.name, type: 'workflow', created: w.createdAt, modified: w.updatedAt })) : [],
        } : a));
        setError(null);
        setLoading(prev => ({ ...prev, [appId]: false }));
        return;
      }
      // Discord apps: connect via channels webhook
      if (isDiscordApp(appId) && app.discordWebhooks) {
        const { channelsUrl, sendUrl } = app.discordWebhooks;
        if (!channelsUrl) throw new Error('Discord Channels URL not configured');
        if (!sendUrl) throw new Error('Discord Send URL not configured');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch('/api/apps/webhook-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl: channelsUrl }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
        let data: any = {};
        const responseText = await response.text();
        if (responseText && responseText.trim()) { try { data = JSON.parse(responseText); } catch { data = {}; } }
        if (Array.isArray(data) && data.length > 0) data = data[0];
        let channels: DiscordChannel[] = [];
        if (data.channels && Array.isArray(data.channels)) {
          channels = data.channels.map((ch: any) => ({ id: ch.id || ch.channelId || '', name: ch.name || ch.channelName || 'Unknown', type: ch.type || 'text' }));
        } else if (Array.isArray(data)) {
          channels = data.map((ch: any) => ({ id: ch.id || ch.channelId || '', name: ch.name || ch.channelName || 'Unknown', type: ch.type || 'text' }));
        }
        setConnectedAppIds(prev => new Set([...prev, appId]));
        setCollapsedConnectedApps(prev => new Set([...prev, appId]));
        setApps(prevApps => prevApps.map(a => a.id === appId ? {
          ...a, status: 'connected',
          statusMessage: channels.length > 0 ? `${channels.length} channel(s) found` : 'Connected to Discord',
          discordChannels: channels,
        } : a));
        setError(null);
        setLoading(prev => ({ ...prev, [appId]: false }));
        return;
      }
      // Webhook apps
      if (!app.webhookUrl && !app.discordWebhooks) throw new Error(`${app.name} webhook not configured`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch('/api/apps/webhook-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: app.webhookUrl }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        let data: any = {};
        const responseText = await response.text();
        if (responseText && responseText.trim()) {
          try {
            data = JSON.parse(responseText);
          } catch {
            data = {};
          }
        }
        if (Array.isArray(data) && data.length > 0) data = data[0];
        let files: GoogleFile[] = [];
        if (data.files && Array.isArray(data.files)) files = data.files;
        else if (data.items && Array.isArray(data.items)) files = data.items;
        else if (data.data && Array.isArray(data.data)) files = data.data;
        else if (Array.isArray(data)) files = data;
        setConnectedAppIds(prev => new Set([...prev, appId]));
        setCollapsedConnectedApps(prev => new Set([...prev, appId]));
        setApps(prevApps => prevApps.map(a => {
          if (a.id === appId) {
            return {
              ...a, status: 'connected', statusMessage: 'Successfully connected', files,
              children: a.children?.map(child => ({ ...child, status: 'connected' as const })),
            };
          }
          return a;
        }));
        setError(null);
      } else {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (err: any) {
      let errorMessage = 'Connection failed';
      if (err.name === 'AbortError') errorMessage = 'Connection timeout';
      else if (err.message.includes('Failed to fetch')) errorMessage = 'Cannot reach webhook';
      else errorMessage = err.message || 'Unknown error';
      setApps(prevApps => prevApps.map(a => a.id === appId ? { ...a, status: 'error', statusMessage: errorMessage, files: [] } : a));
      setError(`${app.name}: ${errorMessage}`);
    } finally {
      setLoading(prev => ({ ...prev, [appId]: false }));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    const appsToRefresh = apps.filter(a => a.status === 'connected' || a.status === 'error');
    const refreshPromises = appsToRefresh.map(async (app) => {
      const appId = app.id;
      try {
        // Database apps
        if (isDatabaseApp(appId) && (app as any).credentials) {
          const creds = (app as any).credentials;
          const databases = await fetchDatabases(appId, creds.host, creds.port, creds.username, creds.password, creds.database);
          setConnectedAppIds(prev => new Set([...prev, appId]));
          setApps(prevApps => prevApps.map(a => a.id === appId ? { ...a, status: 'connected' as const, statusMessage: `${databases.length} database(s) found`, files: databases.map((dbName: string) => ({ id: dbName, name: dbName, type: 'database' })) } : a));
          return;
        }
        // API apps (n8n, MCP)
        if (isApiApp(appId) && (app as any).apiCredentials) {
          const apiCreds = (app as any).apiCredentials;
          const workflows = await fetchN8nWorkflows(apiCreds.apiUrl, apiCreds.apiKey, appId);
          const isMcp = appId === 'mcp' || appId.startsWith('mcp-');
          setConnectedAppIds(prev => new Set([...prev, appId]));
          setApps(prevApps => prevApps.map(a => a.id === appId ? { ...a, status: 'connected' as const, statusMessage: isMcp ? 'MCP Server Connected' : `${workflows.length} workflow(s) found`, files: !isMcp ? workflows.map((w: any) => ({ id: w.id, name: w.name, type: 'workflow', created: w.createdAt, modified: w.updatedAt })) : [] } : a));
          return;
        }
        // Discord apps: refresh channels
        if (isDiscordApp(appId) && (app as any).discordWebhooks?.channelsUrl) {
          const response = await fetch('/api/apps/webhook-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookUrl: (app as any).discordWebhooks.channelsUrl }),
          });
          if (response.ok) {
            let data: any = {};
            const responseText = await response.text();
            if (responseText && responseText.trim()) { try { data = JSON.parse(responseText); } catch { data = {}; } }
            if (Array.isArray(data) && data.length > 0) data = data[0];
            let channels: DiscordChannel[] = [];
            if (data.channels && Array.isArray(data.channels)) {
              channels = data.channels.map((ch: any) => ({ id: ch.id || ch.channelId || '', name: ch.name || ch.channelName || 'Unknown', type: ch.type || 'text' }));
            } else if (Array.isArray(data)) {
              channels = data.map((ch: any) => ({ id: ch.id || ch.channelId || '', name: ch.name || ch.channelName || 'Unknown', type: ch.type || 'text' }));
            }
            setConnectedAppIds(prev => new Set([...prev, appId]));
            setApps(prevApps => prevApps.map(a => a.id === appId ? { ...a, status: 'connected' as const, statusMessage: channels.length > 0 ? `${channels.length} channel(s) found` : 'Connected to Discord', discordChannels: channels } : a));
          }
          return;
        }
        // Webhook apps
        if (!app.webhookUrl) return;
        const response = await fetch('/api/apps/webhook-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl: app.webhookUrl }),
        });
        if (response.ok) {
          let data: any = {};
          const responseText = await response.text();
          if (responseText && responseText.trim()) {
            try { data = JSON.parse(responseText); } catch { data = {}; }
          }
          if (Array.isArray(data) && data.length > 0) data = data[0];
          let files: GoogleFile[] = [];
          if (data.files && Array.isArray(data.files)) files = data.files;
          else if (data.items && Array.isArray(data.items)) files = data.items;
          else if (data.data && Array.isArray(data.data)) files = data.data;
          else if (Array.isArray(data)) files = data;
          setConnectedAppIds(prev => new Set([...prev, appId]));
          setApps(prevApps => prevApps.map(a => a.id === appId ? { ...a, status: 'connected' as const, statusMessage: 'Successfully connected', files } : a));
        }
      } catch {}
    });
    await Promise.all(refreshPromises);
    setRefreshing(false);
  };

  const handleConnect = (appId: string) => connectApp(appId);

  const handleDisconnect = (appId: string) => {
    setConnectedAppIds(prev => { const s = new Set(prev); s.delete(appId); return s; });
    setCollapsedConnectedApps(prev => { const s = new Set(prev); s.delete(appId); return s; });
    setApps(prevApps => prevApps.map(app => app.id === appId
      ? { ...app, status: 'disconnected', statusMessage: undefined, files: [], children: app.children?.map(c => ({ ...c, status: 'disconnected' as const })) }
      : app
    ));
    setError(null);
  };

  const handleAddApp = async () => {
    if (!selectedNewApp) return;
    setError(null);

    // Determine the base app type for validation (handles multi-instance IDs like n8n-2)
    const baseId = selectedNewApp.id.replace(/-\d+$/, '');

    if (isDatabaseApp(selectedNewApp.id)) {
      if (!dbCredentials.host || !dbCredentials.port || !dbCredentials.username || !dbCredentials.database) { setError('Please fill in all required database credentials'); return; }
    } else if (isApiApp(selectedNewApp.id)) {
      if (!apiCredentials.apiUrl.trim() || !apiCredentials.apiKey.trim()) { setError(`Please enter both ${selectedNewApp.name} API URL and API Key`); return; }
    } else if (isDiscordApp(selectedNewApp.id)) {
      if (!discordWebhooks.channelsUrl.trim() || !discordWebhooks.sendUrl.trim()) { setError('Please enter both the Channels URL and Send Message URL'); return; }
    } else {
      if (!webhookUrl.trim()) { setError('Please enter a webhook URL'); return; }
    }

    // When modifying, update the existing app in-place
    if (modifyingAppId) {
      const appId = modifyingAppId;
      const appExistsInState = apps.some(a => a.id === appId);

      if (!appExistsInState) {
        // App not in state yet (e.g. pressed Connect/Modify on an unconnected app from ALL_POSSIBLE_APPS).
        // Create it as a new app, then auto-connect.
        const meta = ALL_POSSIBLE_APPS.find(m => m.id === appId || m.id === baseId);
        const newApp: AppConnection = {
          id: appId,
          name: meta?.name || selectedNewApp.name,
          icon: meta?.icon || selectedNewApp.icon,
          status: 'disconnected',
          children: (meta as any)?.children,
          webhookUrl: !isDatabaseApp(appId) && !isApiApp(appId) && !isDiscordApp(appId) ? webhookUrl.trim() : undefined,
        };
        if (isDatabaseApp(appId)) (newApp as any).credentials = { ...dbCredentials };
        else if (isApiApp(appId)) (newApp as any).apiCredentials = { ...apiCredentials };
        else if (isDiscordApp(appId)) newApp.discordWebhooks = { ...discordWebhooks };
        setApps(prev => [...prev, newApp]);
        // Clear modifyingAppId so status page works correctly
        setModifyingAppId(null);
        // Set loading immediately so status page shows "Connecting..." not "Failed" briefly
        setLoading(prev => ({ ...prev, [appId]: true }));
        // Trigger auto-connect after state update via useEffect
        setPendingConnectId(appId);
        return;
      }

      // Update credentials on the existing app
      setApps(prev => prev.map(app => {
        if (app.id !== appId) return app;
        const updated = { ...app };
        if (isDatabaseApp(appId)) (updated as any).credentials = { ...dbCredentials };
        else if (isApiApp(appId)) (updated as any).apiCredentials = { ...apiCredentials };
        else if (isDiscordApp(appId)) updated.discordWebhooks = { ...discordWebhooks };
        else updated.webhookUrl = webhookUrl.trim();
        return updated;
      }));

      // Re-connect with new credentials
      if (isApiApp(appId)) {
        setLoading(prev => ({ ...prev, [appId]: true }));
        try {
          const workflows = await fetchN8nWorkflows(apiCredentials.apiUrl, apiCredentials.apiKey, baseId);
          setConnectedAppIds(prev => new Set([...prev, appId]));
          const isMcp = baseId === 'mcp';
          setApps(prevApps => prevApps.map(app => app.id === appId ? {
            ...app, status: 'connected',
            statusMessage: isMcp ? 'MCP Server Connected' : `${workflows.length} workflow(s) found`,
            files: !isMcp ? workflows.map((w: any) => ({ id: w.id, name: w.name, type: 'workflow', created: w.createdAt, modified: w.updatedAt })) : [],
          } : app));
        } catch (err: any) {
          setApps(prevApps => prevApps.map(app => app.id === appId ? { ...app, status: 'error', statusMessage: `Failed: ${err.message}` } : app));
          setError(`${selectedNewApp.name}: ${err.message}`);
        } finally { setLoading(prev => ({ ...prev, [appId]: false })); }
      } else if (isDatabaseApp(appId)) {
        setLoading(prev => ({ ...prev, [appId]: true }));
        try {
          const databases = await fetchDatabases(baseId, dbCredentials.host, dbCredentials.port, dbCredentials.username, dbCredentials.password, dbCredentials.database);
          setConnectedAppIds(prev => new Set([...prev, appId]));
          setApps(prevApps => prevApps.map(app => app.id === appId ? {
            ...app, status: 'connected', statusMessage: `${databases.length} database(s) found`,
            files: databases.map((dbName: string) => ({ id: dbName, name: dbName, type: 'database' })),
          } : app));
        } catch (err: any) {
          setApps(prevApps => prevApps.map(app => app.id === appId ? { ...app, status: 'error', statusMessage: `Failed: ${err.message}` } : app));
          setError(`${selectedNewApp.name}: ${err.message}`);
        } finally { setLoading(prev => ({ ...prev, [appId]: false })); }
      } else if (isDiscordApp(appId)) {
        setLoading(prev => ({ ...prev, [appId]: true }));
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          const response = await fetch('/api/apps/webhook-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookUrl: discordWebhooks.channelsUrl }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
          let data: any = {};
          const responseText = await response.text();
          if (responseText && responseText.trim()) { try { data = JSON.parse(responseText); } catch { data = {}; } }
          if (Array.isArray(data) && data.length > 0) data = data[0];
          let channels: DiscordChannel[] = [];
          if (data.channels && Array.isArray(data.channels)) {
            channels = data.channels.map((ch: any) => ({ id: ch.id || ch.channelId || '', name: ch.name || ch.channelName || 'Unknown', type: ch.type || 'text' }));
          } else if (Array.isArray(data)) {
            channels = data.map((ch: any) => ({ id: ch.id || ch.channelId || '', name: ch.name || ch.channelName || 'Unknown', type: ch.type || 'text' }));
          }
          setConnectedAppIds(prev => new Set([...prev, appId]));
          setApps(prevApps => prevApps.map(app => app.id === appId ? {
            ...app, status: 'connected',
            statusMessage: channels.length > 0 ? `${channels.length} channel(s) found` : 'Connected to Discord',
            discordChannels: channels,
          } : app));
        } catch (err: any) {
          const errorMessage = err.name === 'AbortError' ? 'Connection timeout' : (err.message || 'Unknown error');
          setApps(prevApps => prevApps.map(app => app.id === appId ? { ...app, status: 'error', statusMessage: errorMessage } : app));
          setError(`Discord: ${errorMessage}`);
        } finally { setLoading(prev => ({ ...prev, [appId]: false })); }
      } else {
        // Plain webhook app — just reconnect
        connectApp(appId);
      }
      return;
    }

    // ── Adding a new app ──
    const mainApps = ['google-drive', 'microsoft-onedrive', 'slack'];
    const allowMultiple = ['n8n', 'mcp'];
    if (!mainApps.includes(selectedNewApp.id) && !allowMultiple.includes(selectedNewApp.id) && apps.some(a => a.id === selectedNewApp.id)) {
      setError(`${selectedNewApp.name} is already in your apps list`);
      return;
    }
    let appId = selectedNewApp.id;
    let displayName = selectedNewApp.name;
    if (allowMultiple.includes(selectedNewApp.id)) {
      const existingCount = apps.filter(a => a.id.startsWith(`${selectedNewApp.id}-`) || a.id === selectedNewApp.id).length;
      if (existingCount > 0) { appId = `${selectedNewApp.id}-${existingCount + 1}`; displayName = `${selectedNewApp.name} ${existingCount + 1}`; }
    }
    const newApp: AppConnection = { id: appId, name: displayName, icon: selectedNewApp.icon, status: 'disconnected', webhookUrl: !isDatabaseApp(selectedNewApp.id) && !isApiApp(selectedNewApp.id) && !isDiscordApp(selectedNewApp.id) ? webhookUrl.trim() : undefined };
    if (isDatabaseApp(selectedNewApp.id)) (newApp as any).credentials = dbCredentials;
    else if (isApiApp(selectedNewApp.id)) (newApp as any).apiCredentials = apiCredentials;
    else if (isDiscordApp(selectedNewApp.id)) newApp.discordWebhooks = { ...discordWebhooks };
    setApps(prev => [...prev, newApp]);

    // Auto-connect n8n/MCP
    if (isApiApp(selectedNewApp.id)) {
      setLoading(prev => ({ ...prev, [appId]: true }));
      try {
        const workflows = await fetchN8nWorkflows(apiCredentials.apiUrl, apiCredentials.apiKey, selectedNewApp.id);
        setConnectedAppIds(prev => new Set([...prev, appId]));
        setCollapsedConnectedApps(prev => new Set([...prev, appId]));
        const isMcp = baseId === 'mcp';
        setApps(prevApps => prevApps.map(app => app.id === appId ? {
          ...app, status: 'connected',
          statusMessage: isMcp ? 'MCP Server Connected' : `${workflows.length} workflow(s) found`,
          files: !isMcp ? workflows.map((w: any) => ({ id: w.id, name: w.name, type: 'workflow', created: w.createdAt, modified: w.updatedAt })) : [],
        } : app));
        setError(null);
      } catch (err: any) {
        setApps(prevApps => prevApps.map(app => app.id === appId ? { ...app, status: 'error', statusMessage: `Failed: ${err.message}` } : app));
        setError(`${selectedNewApp.name}: ${err.message}`);
      } finally { setLoading(prev => ({ ...prev, [appId]: false })); }
    }
    // Auto-connect databases
    if (isDatabaseApp(selectedNewApp.id)) {
      setLoading(prev => ({ ...prev, [appId]: true }));
      try {
        const databases = await fetchDatabases(selectedNewApp.id, dbCredentials.host, dbCredentials.port, dbCredentials.username, dbCredentials.password, dbCredentials.database);
        setConnectedAppIds(prev => new Set([...prev, appId]));
        setCollapsedConnectedApps(prev => new Set([...prev, appId]));
        setApps(prevApps => prevApps.map(app => app.id === appId ? {
          ...app, status: 'connected', statusMessage: `${databases.length} database(s) found`,
          files: databases.map((dbName: string) => ({ id: dbName, name: dbName, type: 'database' })),
        } : app));
        setError(null);
      } catch (err: any) {
        setApps(prevApps => prevApps.map(app => app.id === appId ? { ...app, status: 'error', statusMessage: `Failed: ${err.message}` } : app));
        setError(`${selectedNewApp.name}: ${err.message}`);
      } finally { setLoading(prev => ({ ...prev, [appId]: false })); }
    }
    // Auto-connect Discord
    if (isDiscordApp(selectedNewApp.id)) {
      setLoading(prev => ({ ...prev, [appId]: true }));
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch('/api/apps/webhook-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl: discordWebhooks.channelsUrl }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
        let data: any = {};
        const responseText = await response.text();
        if (responseText && responseText.trim()) { try { data = JSON.parse(responseText); } catch { data = {}; } }
        if (Array.isArray(data) && data.length > 0) data = data[0];
        let channels: DiscordChannel[] = [];
        if (data.channels && Array.isArray(data.channels)) {
          channels = data.channels.map((ch: any) => ({ id: ch.id || ch.channelId || '', name: ch.name || ch.channelName || 'Unknown', type: ch.type || 'text' }));
        } else if (Array.isArray(data)) {
          channels = data.map((ch: any) => ({ id: ch.id || ch.channelId || '', name: ch.name || ch.channelName || 'Unknown', type: ch.type || 'text' }));
        }
        setConnectedAppIds(prev => new Set([...prev, appId]));
        setCollapsedConnectedApps(prev => new Set([...prev, appId]));
        setApps(prevApps => prevApps.map(app => app.id === appId ? {
          ...app, status: 'connected',
          statusMessage: channels.length > 0 ? `${channels.length} channel(s) found` : 'Connected to Discord',
          discordChannels: channels,
        } : app));
        setError(null);
      } catch (err: any) {
        const errorMessage = err.name === 'AbortError' ? 'Connection timeout' : (err.message || 'Unknown error');
        setApps(prevApps => prevApps.map(app => app.id === appId ? { ...app, status: 'error', statusMessage: errorMessage } : app));
        setError(`Discord: ${errorMessage}`);
      } finally { setLoading(prev => ({ ...prev, [appId]: false })); }
    }

    // Only reset form if no auto-connect happened (plain webhook apps)
    const isAutoConnect = isDatabaseApp(selectedNewApp.id) || isApiApp(selectedNewApp.id) || isDiscordApp(selectedNewApp.id);
    if (!isAutoConnect) {
      setSelectedNewApp(null);
      setWebhookUrl('');
      setDbCredentials({ host: '', port: '', username: '', password: '', database: '' });
      setApiCredentials({ apiUrl: '', apiKey: '' });
      setDiscordWebhooks({ channelsUrl: '', sendUrl: '' });
    }
  };

  /* ═══════ Helpers — identical to desktop ═══════ */
  const getAvailableAppsForModal = () => {
    const mainApps = ['google-drive', 'microsoft-onedrive', 'slack'];
    return ALL_POSSIBLE_APPS.filter(app => mainApps.includes(app.id) || !apps.some(a => a.id === app.id));
  };
  const hasCredentials = (app: AppConnection) => !!((app as any).webhookUrl || (app as any).credentials || (app as any).apiCredentials || (app as any).discordWebhooks?.channelsUrl);
  const formatFileSize = (bytes: number) => { if (!bytes) return 'Unknown'; const mb = bytes / 1024 / 1024; return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`; };
  const formatDate = (dateString?: string) => { if (!dateString) return ''; try { return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return ''; } };
  const getFileIcon = (fileType?: string): string => {
    switch (fileType) { case 'doc': return '/assets/apps/google-docs.svg'; case 'sheet': return '/assets/apps/google-sheets.svg'; case 'slide': return '/assets/apps/google-slides.svg'; default: return '/assets/apps/google-drive.svg'; }
  };
  const groupFilesByType = (files: GoogleFile[]) => {
    const docs: GoogleFile[] = [], sheets: GoogleFile[] = [], slides: GoogleFile[] = [];
    files.forEach(f => {
      if (f.type === 'doc' || f.mimeType === 'application/vnd.google-apps.document') docs.push(f);
      else if (f.type === 'sheet' || f.mimeType === 'application/vnd.google-apps.spreadsheet') sheets.push(f);
      else if (f.type === 'slide' || f.mimeType === 'application/vnd.google-apps.presentation') slides.push(f);
    });
    return { docs, sheets, slides };
  };

  const resetConnectPage = () => {
    setConnectPage(null);
    setSelectedNewApp(null);
    setModifyingAppId(null);
    setWebhookUrl('');
    setDbCredentials({ host: '', port: '', username: '', password: '', database: '' });
    setApiCredentials({ apiUrl: '', apiKey: '' });
    setDiscordWebhooks({ channelsUrl: '', sendUrl: '' });
    setError(null);
  };

  /* ═══════════════════════════════════════════════════════
     FULL-PAGE CONNECT FLOW (replaces modal)
     ═══════════════════════════════════════════════════════ */
  if (connectPage) {
    return (
      <div className="w-full">
        {/* ── Connect page header ── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              if (connectPage === 'configure' && modifyingAppId) { resetConnectPage(); }
              else if (connectPage === 'configure') { setConnectPage('select'); setSelectedNewApp(null); setError(null); }
              else if (connectPage === 'status') resetConnectPage();
              else resetConnectPage();
            }}
            className="p-2 -ml-2 active:bg-gray-100 rounded-xl transition-colors touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-[20px] font-extrabold text-gray-900">
              {connectPage === 'select' && 'Connect App'}
              {connectPage === 'configure' && (modifyingAppId ? 'Modify' : 'Configure')}
              {connectPage === 'status' && 'Connection Status'}
            </h2>
            <p className="text-[11px] text-gray-400 font-medium">
              {connectPage === 'select' && 'Choose an application'}
              {connectPage === 'configure' && selectedNewApp && `${modifyingAppId ? 'Update' : 'Set up'} ${selectedNewApp.name}`}
              {connectPage === 'status' && 'Connection result'}
            </p>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-1.5 mb-6">
          {[1, 2, 3].map((step) => {
            const current = connectPage === 'select' ? 1 : connectPage === 'configure' ? 2 : 3;
            return (
              <div key={step} className={`h-1 flex-1 rounded-full transition-all duration-300 ${current >= step ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`} />
            );
          })}
        </div>

        {/* ── STEP 1: Select App ── */}
        {connectPage === 'select' && (
          <div className="grid grid-cols-3 gap-3">
            {getAvailableAppsForModal().map(app => {
              const isConnected = connectedAppIds.has(app.id);
              return (
                <button
                  key={app.id}
                  onClick={() => { setSelectedNewApp(app); setConnectPage('configure'); }}
                  className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border border-gray-100 bg-white active:scale-95 active:bg-[#5D5FEF]/5 transition-all relative touch-manipulation shadow-sm"
                >
                  <img src={app.icon} alt={app.name} className="w-10 h-10 object-contain" />
                  <span className="text-[11px] font-bold text-gray-700 text-center line-clamp-1">{app.name}</span>
                  {isConnected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
            {getAvailableAppsForModal().length === 0 && (
              <div className="col-span-full text-center py-12"><p className="text-sm text-gray-400 font-medium">All apps connected!</p></div>
            )}
          </div>
        )}

        {/* ── STEP 2: Configure ── */}
        {connectPage === 'configure' && selectedNewApp && (
          <div className="space-y-5">
            {/* Selected app card */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                <img src={selectedNewApp.icon} alt={selectedNewApp.name} className="w-7 h-7 object-contain" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-gray-900">{selectedNewApp.name}</p>
                <p className="text-[11px] text-gray-400 font-medium">
                  {isDatabaseApp(selectedNewApp.id) ? 'Database credentials' : isApiApp(selectedNewApp.id) ? 'API credentials' : isDiscordApp(selectedNewApp.id) ? 'Webhook configuration' : 'Webhook configuration'}
                </p>
              </div>
            </div>

            {/* Discord Webhook URLs */}
            {isDiscordApp(selectedNewApp.id) && (
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-bold text-gray-600 mb-2 block">Channels URL</label>
                  <input type="text" value={discordWebhooks.channelsUrl} onChange={(e) => setDiscordWebhooks(prev => ({ ...prev, channelsUrl: e.target.value }))} placeholder="https://n8n.example.com/webhook/discord-channels"
                    className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 font-mono text-[13px] shadow-sm" autoFocus />
                  <p className="text-[10px] text-gray-400 mt-1.5">GET endpoint that returns your Discord server channels</p>
                </div>
                <div>
                  <label className="text-[12px] font-bold text-gray-600 mb-2 block">Send Message URL</label>
                  <input type="text" value={discordWebhooks.sendUrl} onChange={(e) => setDiscordWebhooks(prev => ({ ...prev, sendUrl: e.target.value }))} placeholder="https://n8n.example.com/webhook/discord-send"
                    className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 font-mono text-[13px] shadow-sm" />
                  <p className="text-[10px] text-gray-400 mt-1.5">POST endpoint to send messages to a Discord channel</p>
                </div>
              </div>
            )}

            {/* Webhook URL */}
            {!isDatabaseApp(selectedNewApp.id) && !isApiApp(selectedNewApp.id) && !isDiscordApp(selectedNewApp.id) && (
              <div>
                <label className="text-[12px] font-bold text-gray-600 mb-2 block">Webhook URL</label>
                <input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://n8n.example.com/webhook/..."
                  className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 font-mono text-[13px] shadow-sm" autoFocus />
              </div>
            )}

            {/* API Credentials */}
            {isApiApp(selectedNewApp.id) && (
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-bold text-gray-600 mb-2 block">{selectedNewApp.name} URL</label>
                  <input type="text" value={apiCredentials.apiUrl} onChange={(e) => setApiCredentials(prev => ({ ...prev, apiUrl: e.target.value }))} placeholder="http://192.168.5.0:5678"
                    className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-[13px] font-mono shadow-sm" autoFocus />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-gray-600 mb-2 block">API Key</label>
                  <input type="password" value={apiCredentials.apiKey} onChange={(e) => setApiCredentials(prev => ({ ...prev, apiKey: e.target.value }))} placeholder="eyJhbGci..."
                    className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-[13px] font-mono shadow-sm" />
                </div>
              </div>
            )}

            {/* Database Credentials */}
            {isDatabaseApp(selectedNewApp.id) && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] font-bold text-gray-600 mb-2 block">Host</label>
                    <input type="text" value={dbCredentials.host} onChange={(e) => setDbCredentials(prev => ({ ...prev, host: e.target.value }))} placeholder="localhost"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-[13px] shadow-sm" autoFocus />
                  </div>
                  <div>
                    <label className="text-[12px] font-bold text-gray-600 mb-2 block">Port</label>
                    <input type="text" value={dbCredentials.port} onChange={(e) => setDbCredentials(prev => ({ ...prev, port: e.target.value }))} placeholder={selectedNewApp.id === 'postgresql' ? '5432' : '3306'}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-[13px] shadow-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-bold text-gray-600 mb-2 block">Username</label>
                  <input type="text" value={dbCredentials.username} onChange={(e) => setDbCredentials(prev => ({ ...prev, username: e.target.value }))} placeholder="admin"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-[13px] shadow-sm" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-gray-600 mb-2 block">Password</label>
                  <input type="password" value={dbCredentials.password} onChange={(e) => setDbCredentials(prev => ({ ...prev, password: e.target.value }))} placeholder="••••••••"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-[13px] shadow-sm" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-gray-600 mb-2 block">Database Name</label>
                  <input type="text" value={dbCredentials.database} onChange={(e) => setDbCredentials(prev => ({ ...prev, database: e.target.value }))} placeholder="mydb"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-[13px] shadow-sm" />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-600 font-medium">{error}</p>
              </div>
            )}

            {/* Connect button */}
            <button
              onClick={() => { setConnectPage('status'); handleAddApp(); }}
              disabled={
                isDatabaseApp(selectedNewApp?.id) ? !dbCredentials.host || !dbCredentials.port || !dbCredentials.username || !dbCredentials.database
                : isApiApp(selectedNewApp?.id) ? !apiCredentials.apiUrl.trim() || !apiCredentials.apiKey.trim()
                : isDiscordApp(selectedNewApp?.id) ? !discordWebhooks.channelsUrl.trim() || !discordWebhooks.sendUrl.trim()
                : !webhookUrl.trim()
              }
              className="w-full py-3.5 bg-[#5D5FEF] text-white rounded-2xl text-[14px] font-bold shadow-lg shadow-[#5D5FEF]/25 disabled:opacity-40 active:scale-[0.98] transition-all touch-manipulation flex items-center justify-center gap-2"
            >
              {modifyingAppId ? 'Save & Reconnect' : 'Connect'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 3: Status ── */}
        {connectPage === 'status' && selectedNewApp && (
          <div className="py-12 text-center">
            {loading[selectedNewApp.id] ? (
              <>
                <div className="w-20 h-20 rounded-full bg-[#5D5FEF]/10 flex items-center justify-center mx-auto mb-5">
                  <Loader2 className="w-10 h-10 text-[#5D5FEF] animate-spin" />
                </div>
                <p className="text-[16px] font-bold text-gray-900">Connecting...</p>
                <p className="text-[13px] text-gray-400 mt-1">Setting up {selectedNewApp.name}</p>
              </>
            ) : apps.find(a => a.id === selectedNewApp.id)?.status === 'connected' ? (
              <>
                <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <p className="text-[16px] font-bold text-gray-900">Connected!</p>
                <p className="text-[13px] text-gray-400 mt-1">{apps.find(a => a.id === selectedNewApp.id)?.statusMessage}</p>
                <button onClick={resetConnectPage} className="mt-6 px-8 py-3 bg-[#5D5FEF] text-white rounded-2xl text-[13px] font-bold shadow-lg shadow-[#5D5FEF]/25 active:scale-[0.98] transition-all touch-manipulation">
                  Done
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
                <p className="text-[16px] font-bold text-gray-900">Failed</p>
                <p className="text-[13px] text-red-400 mt-1">{apps.find(a => a.id === selectedNewApp.id)?.statusMessage || error}</p>
                <div className="flex items-center gap-3 mt-6 justify-center">
                  <button onClick={() => setConnectPage('configure')} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl text-[13px] font-bold active:scale-[0.98] transition-all touch-manipulation">
                    Try Again
                  </button>
                  <button onClick={resetConnectPage} className="px-6 py-3 bg-[#5D5FEF] text-white rounded-2xl text-[13px] font-bold shadow-lg shadow-[#5D5FEF]/25 active:scale-[0.98] transition-all touch-manipulation">
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Merge apps state with ALL_POSSIBLE_APPS (connected first, then disconnected)
  const unifiedApps = useMemo(() => {
    const connected: (AppConnection & { isInState: boolean })[] = [];
    const disconnected: (AppConnection & { isInState: boolean })[] = [];
    const processedIds = new Set<string>();

    for (const app of apps) {
      processedIds.add(app.id);
      const enriched = { ...app, isInState: true };
      if (app.status === 'connected' || connectedAppIds.has(app.id)) {
        connected.push(enriched);
      } else {
        disconnected.push(enriched);
      }
    }

    for (const meta of ALL_POSSIBLE_APPS) {
      if (!processedIds.has(meta.id)) {
        disconnected.push({
          id: meta.id,
          name: meta.name,
          icon: meta.icon,
          status: 'disconnected' as const,
          children: (meta as any).children,
          isInState: false,
        });
      }
    }

    return [...connected, ...disconnected];
  }, [apps, connectedAppIds]);

  /* ═══════════════════════════════════════════════════════
     MAIN APPS LIST (default view)
     ═══════════════════════════════════════════════════════ */
  return (
    <div className="w-full">
      {/* ── Header with accent bar ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="relative">
          <div className="absolute -left-2 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full" />
          <h2 className="text-[22px] font-extrabold tracking-tight text-gray-900 pl-4">My Apps</h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || apps.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-500 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-gray-200 active:scale-95 transition-all disabled:opacity-40 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-700 font-medium flex-1">{error}</p>
            <button onClick={() => setError(null)} className="p-1 active:bg-red-100 rounded-lg">
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        </div>
      )}

      {/* ── App Cards ── */}
      <div className="space-y-3">
        {unifiedApps.map((app) => (
          <div
            key={app.id}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
              app.status === 'connected' ? 'border-green-200' : app.status === 'error' ? 'border-red-200' : 'border-gray-100'
            }`}
          >
            <div className="p-4">
              {/* App header — clickable for connected apps */}
              <div
                onClick={() => {
                  if (app.status === 'connected') {
                    setCollapsedConnectedApps(prev => {
                      const s = new Set(prev);
                      s.has(app.id) ? s.delete(app.id) : s.add(app.id);
                      return s;
                    });
                  }
                }}
                className={`${app.status === 'connected' ? 'cursor-pointer select-none' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* Chevron for connected apps */}
                  {app.status === 'connected' && (
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${collapsedConnectedApps.has(app.id) ? '' : 'rotate-90'}`} />
                  )}

                  {/* App icon */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      app.status === 'connected' ? 'bg-green-50 border border-green-200' : app.status === 'error' ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-100'
                    }`}>
                      <img src={app.icon} alt={app.name} className="w-6 h-6 object-contain" />
                    </div>
                    {app.status === 'connected' && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    {app.status === 'error' && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                        <XCircle className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  {/* App info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-bold text-gray-900 truncate">{app.name}</h3>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        app.status === 'connected' ? 'bg-green-500' : app.status === 'error' ? 'bg-red-500' : 'bg-gray-300'
                      }`} />
                      <span className={`text-[11px] font-semibold ${
                        app.status === 'connected' ? 'text-green-600' : app.status === 'error' ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {app.status === 'connected' ? 'Connected' : app.status === 'error' ? 'Failed' : 'Not Connected'}
                      </span>
                      {app.status === 'connected' && app.files && app.files.length > 0 && (
                        <span className="text-[10px] text-gray-400 ml-1">
                          · {app.files.length} {app.files.length === 1 ? 'file' : 'files'}
                        </span>
                      )}
                    </div>
                    {app.statusMessage && (
                      <p className={`text-[10px] mt-0.5 truncate ${app.status === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
                        {app.statusMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                {app.status === 'connected' ? (
                  <>
                    <button
                      onClick={() => handleDisconnect(app.id)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[11px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-red-100"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                    <button
                      onClick={() => {
                        setModifyingAppId(app.id);
                        setSelectedNewApp({ id: app.id, name: app.name, icon: app.icon });
                        setWebhookUrl((app as any).webhookUrl || '');
                        if ((app as any).credentials) setDbCredentials((app as any).credentials);
                        if ((app as any).apiCredentials) setApiCredentials((app as any).apiCredentials);
                        if ((app as any).discordWebhooks) setDiscordWebhooks((app as any).discordWebhooks);
                        setError(null);
                        setConnectPage('configure');
                      }}
                      className="flex-1 px-3 py-2 bg-[#5D5FEF]/10 text-[#5D5FEF] rounded-xl text-[11px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-[#5D5FEF]/20"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Modify</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        // If app has no config yet, open configure page instead of attempting connection
                        const hasConfig = !!(
                          app.webhookUrl ||
                          (app as any).credentials ||
                          (app as any).apiCredentials ||
                          (app as any).discordWebhooks?.channelsUrl
                        );
                        if (hasConfig) {
                          handleConnect(app.id);
                        } else {
                          // Open configure page so user can enter config first
                          setModifyingAppId(app.id);
                          setSelectedNewApp({ id: app.id, name: app.name, icon: app.icon });
                          setWebhookUrl('');
                          setDbCredentials({ host: '', port: '', username: '', password: '', database: '' });
                          setApiCredentials({ apiUrl: '', apiKey: '' });
                          if ((app as any).discordWebhooks) setDiscordWebhooks((app as any).discordWebhooks);
                          setError(null);
                          setConnectPage('configure');
                        }
                      }}
                      disabled={loading[app.id]}
                      className="flex-1 px-4 py-2 bg-[#5D5FEF] text-white rounded-xl text-[11px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-[#5D5FEF]/20 disabled:opacity-50"
                    >
                      {loading[app.id] ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Connecting...</span></>
                      ) : (
                        <><Check className="w-3.5 h-3.5" /><span>Connect</span></>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setModifyingAppId(app.id);
                        setSelectedNewApp({ id: app.id, name: app.name, icon: app.icon });
                        setWebhookUrl((app as any).webhookUrl || '');
                        if ((app as any).credentials) setDbCredentials((app as any).credentials);
                        if ((app as any).apiCredentials) setApiCredentials((app as any).apiCredentials);
                        if ((app as any).discordWebhooks) setDiscordWebhooks((app as any).discordWebhooks);
                        setError(null);
                        setConnectPage('configure');
                      }}
                      className="px-3 py-2 bg-[#5D5FEF]/10 text-[#5D5FEF] rounded-xl text-[11px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-[#5D5FEF]/20"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Modify</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Children Apps (expanded only) ── */}
            {app.children && app.children.length > 0 && app.status === 'connected' && !collapsedConnectedApps.has(app.id) && (
              <div className="px-4 pb-3 border-t border-gray-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-3 mb-2">
                  Services ({app.children.length})
                </p>
                <div className="space-y-2">
                  {app.children.map((child, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-green-50/60 border border-green-100">
                      <div className="w-8 h-8 rounded-lg bg-white border border-green-200 flex items-center justify-center">
                        <img src={child.icon} alt={child.name} className="w-5 h-5 object-contain" />
                      </div>
                      <p className="text-[13px] font-bold text-gray-900 truncate flex-1">{child.name}</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Discord Channels (expanded only) ── */}
            {app.status === 'connected' && isDiscordApp(app.id) && (app as any).discordChannels && (app as any).discordChannels.length > 0 && !collapsedConnectedApps.has(app.id) && (
              <div className="px-4 pb-4 border-t border-gray-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-3 mb-2">
                  Channels ({(app as any).discordChannels.length})
                </p>
                <div className="space-y-2">
                  {(app as any).discordChannels.map((ch: any, i: number) => (
                    <div key={ch.id || i} className="flex items-center gap-3 p-3 bg-[#5865F2]/5 rounded-xl border border-[#5865F2]/10">
                      <div className="w-8 h-8 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[14px] font-bold text-[#5865F2]">#</span>
                      </div>
                      <p className="text-[13px] font-bold text-gray-900 truncate flex-1">{ch.name}</p>
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Files/Workflows (expanded only) ── */}
            {app.status === 'connected' && !isDiscordApp(app.id) && app.files && app.files.length > 0 && !collapsedConnectedApps.has(app.id) && (
              <div className="px-4 pb-4 border-t border-gray-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-3 mb-2">
                  {app.id.startsWith('n8n') || app.id.startsWith('mcp') ? 'Workflows' : 'Files'} ({app.files.length})
                </p>

                {/* n8n / MCP Workflows */}
                {(app.id.startsWith('n8n') || app.id.startsWith('mcp')) && (
                  <div className="space-y-2">
                    {app.files.slice(0, expandedApps.has(app.id) ? app.files.length : 6).map((workflow, index) => (
                      <div key={workflow.id || index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-8 h-8 rounded-lg bg-[#5D5FEF]/10 border border-[#5D5FEF]/20 flex items-center justify-center flex-shrink-0">
                          <img src={app.icon} alt="" className="w-4 h-4 object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-gray-900 truncate">{workflow.name || 'Untitled'}</p>
                          {(workflow.created || workflow.modified) && (
                            <p className="text-[10px] text-gray-400">
                              {workflow.modified ? `Updated ${formatDate(workflow.modified)}` : `Created ${formatDate(workflow.created)}`}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {app.files.length > 6 && (
                      <button
                        onClick={() => setExpandedApps(prev => { const s = new Set(prev); s.has(app.id) ? s.delete(app.id) : s.add(app.id); return s; })}
                        className="text-[11px] font-bold text-[#5D5FEF] active:opacity-60 flex items-center gap-1 mt-1"
                      >
                        {expandedApps.has(app.id) ? 'Show less' : `View ${app.files.length - 6} more`}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {/* Google Drive / Other files */}
                {!app.id.startsWith('n8n') && !app.id.startsWith('mcp') && (
                  <div className="space-y-4">
                    {(() => {
                      const grouped = groupFilesByType(app.files);
                      return [
                        { key: 'docs', label: 'Docs', icon: '/assets/apps/google-docs.svg', files: grouped.docs },
                        { key: 'sheets', label: 'Sheets', icon: '/assets/apps/google-sheets.svg', files: grouped.sheets },
                        { key: 'slides', label: 'Slides', icon: '/assets/apps/google-slides.svg', files: grouped.slides },
                      ].filter(g => g.files.length > 0).map(({ key, label, icon, files }) => (
                        <div key={key}>
                          <div className="flex items-center gap-2 mb-2">
                            <img src={icon} alt={label} className="w-4 h-4 object-contain" />
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[9px] font-bold">{files.length}</span>
                          </div>
                          <div className="space-y-2">
                            {files.slice(0, expandedFileCategories.has(`${app.id}-${key}`) ? files.length : 4).map((file, i) => (
                              <a
                                key={file.id || i}
                                href={file.url || file.webViewLink || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 active:bg-gray-100 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                                  <img src={getFileIcon(file.type)} alt="" className="w-5 h-5 object-contain" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-bold text-gray-900 truncate">{file.name || 'Untitled'}</p>
                                  <div className="flex items-center gap-2">
                                    {file.size && parseInt(String(file.size)) > 0 && (
                                      <span className="text-[10px] text-gray-400">{formatFileSize(typeof file.size === 'string' ? parseInt(file.size) : Number(file.size))}</span>
                                    )}
                                    {(file.modified || file.modifiedTime) && (
                                      <span className="text-[10px] text-gray-400">{formatDate(file.modified || file.modifiedTime)}</span>
                                    )}
                                  </div>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                          {files.length > 4 && (
                            <button
                              onClick={() => setExpandedFileCategories(prev => { const s = new Set(prev); const k = `${app.id}-${key}`; s.has(k) ? s.delete(k) : s.add(k); return s; })}
                              className="text-[11px] font-bold text-[#5D5FEF] active:opacity-60 flex items-center gap-1 mt-1"
                            >
                              {expandedFileCategories.has(`${app.id}-${key}`) ? 'Show less' : `View ${files.length - 4} more`}
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {app.status === 'connected' && !isDiscordApp(app.id) && (!app.files || app.files.length === 0) && !app.id.startsWith('mcp') && !collapsedConnectedApps.has(app.id) && (
              <div className="px-4 pb-4 border-t border-gray-50">
                <div className="flex flex-col items-center py-8">
                  <img src={app.icon} alt={app.name} className="w-10 h-10 object-contain opacity-30 mb-2" />
                  <p className="text-[12px] text-gray-400 font-medium">No files found</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ── Add App Button → goes to full page ── */}
        <button
          onClick={() => setConnectPage('select')}
          className="w-full bg-white rounded-2xl border border-dashed border-gray-200 p-4 flex items-center gap-3 active:scale-[0.98] transition-all touch-manipulation"
        >
          <div className="w-10 h-10 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
            <Plus className="w-5 h-5 text-[#5D5FEF]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-700 text-left">Connect App</p>
            <p className="text-[11px] text-gray-400 font-medium text-left">Add a new integration</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default MobileMyAppsView;
