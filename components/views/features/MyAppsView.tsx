import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertCircle, Check, X, ExternalLink, ArrowRight, CheckCircle2, XCircle, Plus, ChevronRight, ChevronDown } from 'lucide-react';

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

interface AppConnection {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  statusMessage?: string;
  children?: AppChild[];
  files?: GoogleFile[];
  webhookUrl?: string;
}

// Define all available apps with their webhooks
const AVAILABLE_APPS: AppConnection[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '/assets/apps/google-drive.svg',
    status: 'disconnected',
    webhookUrl: 'https://n8n.arcelliteserver.com/webhook/google-files',
    children: [
      {
        name: 'Google Docs',
        icon: '/assets/apps/google-docs.svg',
        status: 'disconnected',
      },
      {
        name: 'Google Sheets',
        icon: '/assets/apps/google-sheets.svg',
        status: 'disconnected',
      },
      {
        name: 'Google Slides',
        icon: '/assets/apps/google-slides.svg',
        status: 'disconnected',
      },
    ],
  },
  {
    id: 'microsoft-onedrive',
    name: 'Microsoft OneDrive',
    icon: '/assets/apps/microsoft-onedrive.svg',
    status: 'disconnected',
    webhookUrl: 'https://n8n.arcelliteserver.com/webhook/onedrive-files',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '/assets/apps/slack.svg',
    status: 'disconnected',
    webhookUrl: 'https://n8n.arcelliteserver.com/webhook/slack-files',
  },
];

// All possible apps that can be connected
const ALL_POSSIBLE_APPS = [
  { id: 'google-drive', name: 'Google Drive', icon: '/assets/apps/google-drive.svg' },
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

const MyAppsView: React.FC = () => {
  // Lazy-initialize apps from localStorage to prevent race condition
  const [apps, setApps] = useState<AppConnection[]>(() => {
    const saved = localStorage.getItem('connectedApps');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // Corrupted saved apps — fall through to defaults
      }
    }
    return AVAILABLE_APPS;
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Lazy-initialize connected app IDs from localStorage
  const [connectedAppIds, setConnectedAppIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('connectedAppIds');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      } catch (e) {
        // Corrupted data — return empty set
      }
    }
    return new Set();
  });
  const [showAddAppModal, setShowAddAppModal] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1); // Step 1: Select, Step 2: Configure, Step 3: Connect
  const [selectedNewApp, setSelectedNewApp] = useState<typeof ALL_POSSIBLE_APPS[0] | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [dbCredentials, setDbCredentials] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
    database: '',
  });
  const [apiCredentials, setApiCredentials] = useState({
    apiUrl: '',
    apiKey: '',
  });
  const [n8nWorkflows, setN8nWorkflows] = useState<any[]>([]);
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [expandedFileCategories, setExpandedFileCategories] = useState<Set<string>>(new Set());
  // Connected apps start COLLAPSED by default - click to expand
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

  // Helper: save state to server (PostgreSQL) so all devices stay in sync
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

  // On mount: load state from server (works across devices), fall back to localStorage
  useEffect(() => {
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
          setApps(data.apps);
          localStorage.setItem('connectedApps', JSON.stringify(data.apps));
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

    // Also sync apps state with connectedAppIds on mount
    setApps(prev => prev.map(app => {
      if (connectedAppIds.has(app.id) && app.status !== 'connected') {
        return { ...app, status: 'connected' };
      }
      return app;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save apps to localStorage + server whenever they change
  useEffect(() => {
    localStorage.setItem('connectedApps', JSON.stringify(apps));
    // Notify SharedView of updates
    window.dispatchEvent(new Event('apps-updated'));
    // Persist to server for cross-device sync
    saveToServer(apps, connectedAppIds);
  }, [apps]);

  // Save connected app IDs to localStorage + server
  useEffect(() => {
    localStorage.setItem('connectedAppIds', JSON.stringify(Array.from(connectedAppIds)));
    // Notify SharedView of updates
    window.dispatchEvent(new Event('apps-updated'));
    // Persist to server for cross-device sync
    saveToServer(apps, connectedAppIds);
  }, [connectedAppIds]);

  const fetchN8nWorkflows = async (apiUrl: string, apiKey: string, appId?: string) => {
    try {
      // Validate inputs
      if (!apiUrl || !apiKey) {
        throw new Error('API URL and API Key are required');
      }

      // Try to parse URL to validate format
      try {
        new URL(apiUrl);
      } catch {
        throw new Error(`Invalid API URL format. Please use full URL like "https://your-domain.com"`);
      }

      // Use backend proxy to avoid CORS issues
      const response = await fetch('/api/apps/n8n/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiUrl, apiKey, apiType: appId }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          // Handle both string and object error formats
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.error && typeof errorData.error === 'object') {
            errorMessage = errorData.error.message || JSON.stringify(errorData.error);
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {}

        if (response.status === 401) {
          throw new Error(`Unauthorized (401): Invalid Bearer token or API key. Please verify your credentials are correct.`);
        } else if (response.status === 406) {
          throw new Error(`Not Acceptable (406): Server configuration error. Please ensure your MCP URL and Bearer token are correct.`);
        } else if (response.status === 404) {
          throw new Error(`Not Found (404): The API URL or endpoint does not exist. Please check your URL is correct and includes the full path if needed.`);
        } else if (response.status === 403) {
          throw new Error(`Forbidden (403): Your credentials don't have permission to access this resource.`);
        } else if (response.status >= 500) {
          throw new Error(`Server Error (${response.status}): The server is experiencing issues. Please try again later.`);
        } else if (response.status === 400) {
          throw new Error(errorMessage || `Bad Request (400): ${appId === 'mcp' ? 'Please ensure MCP URL and Bearer token are provided correctly.' : 'Invalid request format.'}`);
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Handle both { data: [...] } and direct array formats
      const workflows = Array.isArray(data) ? data : (data.data || data || []);
      
      if (!Array.isArray(workflows)) {
        throw new Error(`Unexpected response format. Expected array but got ${typeof workflows}`);
      }
      
      return workflows;
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw err;
    }
  };

  const fetchDatabases = async (type: string, host: string, port: string, username: string, password: string, dbName: string) => {
    try {
      if (!type || !host || !port || !username) {
        throw new Error('Database type, host, port, and username are required');
      }

      const response = await fetch('/api/apps/database/databases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, host, port, username, password, database: dbName }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {}

        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication failed: Invalid username or password. Please check your credentials.`);
        } else if (response.status === 404) {
          throw new Error(`Cannot connect to ${type} server at ${host}:${port}. Please verify the host and port are correct.`);
        } else if (response.status >= 500) {
          throw new Error(`Server Error: ${errorMessage}`);
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.databases || !Array.isArray(data.databases)) {
        throw new Error('Unexpected response format from database server');
      }
      
      return data.databases as string[];
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw err;
    }
  };

  const connectApp = async (appId: string) => {
    const app = apps.find(a => a.id === appId);
    if (!app) return;

    setLoading(prev => ({ ...prev, [appId]: true }));
    setError(null);

    try {
      // Check if app has a webhook URL
      if (!app.webhookUrl) {
        throw new Error(`${app.name} webhook not configured`);
      }

      // Try to connect via server-side proxy (avoids CORS on phones)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch('/api/apps/webhook-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ webhookUrl: app.webhookUrl }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Successfully connected
        let data = await response.json();
        
        // Handle array-wrapped response (n8n returns [{success, count, files}])
        if (Array.isArray(data) && data.length > 0) {
          data = data[0];
        }
        
        // Handle different response formats
        let files: GoogleFile[] = [];
        
        if (data.files && Array.isArray(data.files)) {
          // N8n workflow format: { success, count, files: [...] }
          files = data.files;
        } else if (data.items && Array.isArray(data.items)) {
          files = data.items;
        } else if (data.data && Array.isArray(data.data)) {
          files = data.data;
        } else if (Array.isArray(data)) {
          files = data;
        }

        setConnectedAppIds(prev => new Set([...prev, appId]));
        // Start collapsed by default
        setCollapsedConnectedApps(prev => new Set([...prev, appId]));

        setApps(prevApps => prevApps.map(a => {
          if (a.id === appId) {
            return {
              ...a,
              status: 'connected',
              statusMessage: 'Successfully connected',
              files: files,
              children: a.children?.map(child => {
                // Determine child status based on files
                const fileType = child.name === 'Google Docs' ? 'doc' 
                               : child.name === 'Google Sheets' ? 'sheet'
                               : child.name === 'Google Slides' ? 'slide'
                               : null;
                const hasFiles = fileType && files.some(f => f.type === fileType);
                
                return {
                  ...child,
                  status: 'connected' as const,
                };
              }),
            };
          }
          return a;
        }));

        setError(null);
      } else {
        // Webhook returned error
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (err: any) {
      let errorMessage = 'Connection failed';
      if (err.name === 'AbortError') {
        errorMessage = 'Connection timeout - webhook not responding';
      } else if (err.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot reach webhook - check if n8n is running';
      } else {
        errorMessage = err.message || 'Unknown error';
      }

      setApps(prevApps => prevApps.map(a => {
        if (a.id === appId) {
          return {
            ...a,
            status: 'error',
            statusMessage: errorMessage,
            files: [],
          };
        }
        return a;
      }));

      setError(`${app.name}: ${errorMessage}`);
    } finally {
      setLoading(prev => ({ ...prev, [appId]: false }));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);

    // Refresh all connected apps
    const refreshPromises = Array.from(connectedAppIds).map(async (appId) => {
      const app = apps.find(a => a.id === appId);
      if (!app || !app.webhookUrl) return;

      try {
        const response = await fetch('/api/apps/webhook-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl: app.webhookUrl }),
        });

        if (response.ok) {
          let data = await response.json();
                    // Handle array-wrapped response (n8n returns [{success, count, files}])
          if (Array.isArray(data) && data.length > 0) {
            data = data[0];
          }
                    // Handle different response formats
          let files: GoogleFile[] = [];
          if (data.files && Array.isArray(data.files)) {
            files = data.files;
          } else if (data.items && Array.isArray(data.items)) {
            files = data.items;
          } else if (data.data && Array.isArray(data.data)) {
            files = data.data;
          } else if (Array.isArray(data)) {
            files = data;
          }

          setApps(prevApps => prevApps.map(a => {
            if (a.id === appId && a.status === 'connected') {
              return {
                ...a,
                files: files,
              };
            }
            return a;
          }));
        }
      } catch (err) {
        // Silent — refresh failures are non-critical
      }
    });

    await Promise.all(refreshPromises);
    setRefreshing(false);
  };

  const handleConnect = (appId: string) => {
    connectApp(appId);
  };

  const handleDisconnect = (appId: string) => {
    setConnectedAppIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(appId);
      return newSet;
    });
    setCollapsedConnectedApps(prev => {
      const newSet = new Set(prev);
      newSet.delete(appId);
      return newSet;
    });
    setApps(prevApps => prevApps.map(app => {
      if (app.id === appId) {
        return {
          ...app,
          status: 'disconnected',
          statusMessage: undefined,
          files: [],
          children: app.children?.map(child => ({
            ...child,
            status: 'disconnected' as const,
          })),
        };
      }
      return app;
    }));
    setError(null);
  };

  const handleAddApp = async () => {
    if (!selectedNewApp) return;

    setError(null); // Clear any previous errors before attempting connection

    // Database apps need credentials
    if (['postgresql', 'mysql'].includes(selectedNewApp.id)) {
      if (!dbCredentials.host || !dbCredentials.port || !dbCredentials.username || !dbCredentials.database) {
        setError('Please fill in all required database credentials');
        return;
      }
    } else if (['n8n', 'mcp'].includes(selectedNewApp.id)) {
      // n8n and MCP need API URL and API Key
      if (!apiCredentials.apiUrl.trim() || !apiCredentials.apiKey.trim()) {
        setError(`Please enter both ${selectedNewApp.name} API URL and API Key`);
        return;
      }
    } else {
      // Other apps need webhook URL
      if (!webhookUrl.trim()) {
        setError('Please enter a webhook URL');
        return;
      }
    }

    // Check if app already exists (for non-main apps and not api/mcp apps which can have multiples)
    const mainApps = ['google-drive', 'microsoft-onedrive', 'slack'];
    const allowMultiple = ['n8n', 'mcp']; // Allow multiple instances of these
    if (!mainApps.includes(selectedNewApp.id) && !allowMultiple.includes(selectedNewApp.id) && apps.some(a => a.id === selectedNewApp.id)) {
      setError(`${selectedNewApp.name} is already in your apps list`);
      return;
    }

    // Generate unique ID for apps that allow multiple instances
    let appId = selectedNewApp.id;
    let displayName = selectedNewApp.name;
    if (allowMultiple.includes(selectedNewApp.id)) {
      // Count existing instances of this app type
      const existingCount = apps.filter(a => a.id.startsWith(`${selectedNewApp.id}-`) || a.id === selectedNewApp.id).length;
      if (existingCount > 0) {
        appId = `${selectedNewApp.id}-${existingCount + 1}`;
        displayName = `${selectedNewApp.name} ${existingCount + 1}`;
      }
    }

    // Add new app
    const newApp: AppConnection = {
      id: appId,
      name: displayName,
      icon: selectedNewApp.icon,
      status: 'disconnected',
      webhookUrl: !['postgresql', 'mysql', 'n8n'].includes(selectedNewApp.id) 
        ? webhookUrl.trim()
        : undefined,
    };

    // Store credentials for database or API apps if needed
    if (['postgresql', 'mysql'].includes(selectedNewApp.id)) {
      (newApp as any).credentials = dbCredentials;
    } else if (['n8n', 'mcp'].includes(selectedNewApp.id)) {
      (newApp as any).apiCredentials = apiCredentials;
    }

    setApps(prev => [...prev, newApp]);
    
    // For n8n and MCP, automatically attempt to connect and fetch workflows
    if (['n8n', 'mcp'].includes(selectedNewApp.id)) {
      setLoading(prev => ({ ...prev, [appId]: true }));
      try {
        const workflows = await fetchN8nWorkflows(apiCredentials.apiUrl, apiCredentials.apiKey, selectedNewApp.id);
        
        setConnectedAppIds(prev => new Set([...prev, appId]));
        // Start collapsed by default
        setCollapsedConnectedApps(prev => new Set([...prev, appId]));
        
        setApps(prevApps => prevApps.map(app => {
          if (app.id === appId) {
            const isMcp = selectedNewApp.id === 'mcp';
            return {
              ...app,
              status: 'connected',
              statusMessage: isMcp 
                ? 'MCP Server Connected'
                : `${workflows.length} workflow(s) found`,
              files: !isMcp ? workflows.map((w: any) => ({
                id: w.id,
                name: w.name,
                type: 'workflow',
                created: w.createdAt,
                modified: w.updatedAt,
              })) : [],
            };
          }
          return app;
        }));
        setError(null);
      } catch (err: any) {
        setApps(prevApps => prevApps.map(app => {
          if (app.id === appId) {
            return {
              ...app,
              status: 'error',
              statusMessage: `Failed to connect: ${err.message}`,
            };
          }
          return app;
        }));
        setError(`${selectedNewApp.name}: ${err.message}`);
      } finally {
        setLoading(prev => ({ ...prev, [appId]: false }));
      }
    }
    
    // For PostgreSQL and MySQL, automatically attempt to connect and fetch databases
    if (['postgresql', 'mysql'].includes(selectedNewApp.id)) {
      setLoading(prev => ({ ...prev, [appId]: true }));
      try {
        const databases = await fetchDatabases(
          selectedNewApp.id,
          dbCredentials.host,
          dbCredentials.port,
          dbCredentials.username,
          dbCredentials.password,
          dbCredentials.database
        );
        
        setConnectedAppIds(prev => new Set([...prev, appId]));
        // Start collapsed by default
        setCollapsedConnectedApps(prev => new Set([...prev, appId]));
        
        setApps(prevApps => prevApps.map(app => {
          if (app.id === appId) {
            return {
              ...app,
              status: 'connected',
              statusMessage: `${databases.length} database(s) found`,
              files: databases.map((dbName: string) => ({
                id: dbName,
                name: dbName,
                type: 'database',
              })),
            };
          }
          return app;
        }));
        setError(null);
      } catch (err: any) {
        setApps(prevApps => prevApps.map(app => {
          if (app.id === appId) {
            return {
              ...app,
              status: 'error',
              statusMessage: `Failed to connect: ${err.message}`,
            };
          }
          return app;
        }));
        setError(`${selectedNewApp.name}: ${err.message}`);
      } finally {
        setLoading(prev => ({ ...prev, [appId]: false }));
      }
    }
    
    // Reset form but keep modal open
    setSelectedNewApp(null);
    setWebhookUrl('');
    setDbCredentials({ host: '', port: '', username: '', password: '', database: '' });
    setApiCredentials({ apiUrl: '', apiKey: '' });
    setError(null);
  };

  const isDatabaseApp = (appId?: string) => {
    return appId && ['postgresql', 'mysql'].includes(appId);
  };

  const isApiApp = (appId?: string) => {
    return appId && ['n8n', 'mcp'].includes(appId);
  };

  const getAvailableAppsForModal = () => {
    // Always show the main 3 apps (Google Drive, OneDrive, Slack)
    const mainApps = ['google-drive', 'microsoft-onedrive', 'slack'];
    const filtered = ALL_POSSIBLE_APPS.filter(app => {
      // Always include main apps
      if (mainApps.includes(app.id)) return true;
      // For other apps, only show if not already connected
      return !apps.some(a => a.id === app.id);
    });
    return filtered;
  };

  const hasCredentials = (app: AppConnection) => {
    return !!(
      (app as any).webhookUrl ||
      (app as any).credentials ||
      (app as any).apiCredentials
    );
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${kb.toFixed(2)} KB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  const getFileIcon = (fileType?: string): string => {
    switch (fileType) {
      case 'doc':
        return '/assets/apps/google-docs.svg';
      case 'sheet':
        return '/assets/apps/google-sheets.svg';
      case 'slide':
        return '/assets/apps/google-slides.svg';
      default:
        return '/assets/apps/google-drive.svg';
    }
  };

  const groupFilesByType = (files: GoogleFile[]): Record<string, GoogleFile[]> => {
    const docs: GoogleFile[] = [];
    const sheets: GoogleFile[] = [];
    const slides: GoogleFile[] = [];
    
    files.forEach(f => {
      // Check type field first
      if (f.type === 'doc' || f.mimeType === 'application/vnd.google-apps.document') {
        docs.push(f);
      } else if (f.type === 'sheet' || f.mimeType === 'application/vnd.google-apps.spreadsheet') {
        sheets.push(f);
      } else if (f.type === 'slide' || f.mimeType === 'application/vnd.google-apps.presentation') {
        slides.push(f);
      }
    });
    
    return { docs, sheets, slides };
  };

  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
        <div className="relative">
          <div className="absolute -left-2 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 capitalize pl-4 md:pl-6 relative">
            My Apps
            <span className="absolute -top-2 -right-8 md:-right-12 w-16 h-16 md:w-20 md:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || connectedAppIds.size === 0}
          className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-white text-gray-600 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-gray-100 hover:bg-gray-50 hover:border-[#5D5FEF]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
        >
          <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-gradient-to-br from-red-50 to-red-50/50 border-2 border-red-100 rounded-2xl p-5 mb-6 shadow-lg animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black text-red-900 mb-1">Connection Error</h3>
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4 md:space-y-6">
        {apps.map((app) => (
          <div
            key={app.id}
            className={`bg-white rounded-2xl md:rounded-[2.5rem] border transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-gray-100/50 relative overflow-hidden group ${
              app.status === 'connected'
                ? 'border-green-200 ring-2 ring-green-100'
                : app.status === 'error'
                  ? 'border-red-200 ring-2 ring-red-100'
                  : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            {/* Background Gradient Effect */}
            {app.status === 'connected' && (
              <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-gradient-to-br from-green-500/5 to-transparent rounded-full blur-3xl opacity-50" />
            )}
            {app.status === 'error' && (
              <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-gradient-to-br from-red-500/5 to-transparent rounded-full blur-3xl opacity-50" />
            )}

            <div className="relative z-10 p-5 md:p-6 lg:p-8">
              {/* App Header - Clickable for connected apps */}
              <div
                onClick={() => {
                  if (app.status === 'connected') {
                    setCollapsedConnectedApps(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(app.id)) {
                        newSet.delete(app.id);
                      } else {
                        newSet.add(app.id);
                      }
                      return newSet;
                    });
                  }
                }}
                className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  app.status === 'connected' && !collapsedConnectedApps.has(app.id) ? 'mb-4 md:mb-6' : ''
                } ${
                  app.status === 'connected' ? 'cursor-pointer select-none' : ''
                }`}
              >
                <div className="flex items-center gap-3 md:gap-5">
                  {/* Collapse/Expand chevron on the left for connected apps */}
                  {app.status === 'connected' && (
                    <ChevronRight className={`w-5 h-5 md:w-6 md:h-6 text-gray-400 transition-transform duration-300 flex-shrink-0 ${collapsedConnectedApps.has(app.id) ? '' : 'rotate-90'}`} />
                  )}
                  <div className={`relative transition-all duration-300 ${
                    app.status === 'connected'
                      ? 'scale-105'
                      : 'group-hover:scale-105'
                  }`}>
                    <div className={`w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-xl md:rounded-[1.5rem] flex items-center justify-center shadow-lg transition-all duration-300 ${
                      app.status === 'connected'
                        ? 'bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200'
                        : app.status === 'error'
                          ? 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200'
                          : 'bg-gray-50 border-2 border-gray-100 group-hover:border-gray-200'
                    }`}>
                      <img
                        src={app.icon}
                        alt={app.name}
                        className="w-7 h-7 md:w-9 md:h-9 lg:w-10 lg:h-10 object-contain"
                      />
                    </div>
                    {app.status === 'connected' && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />
                      </div>
                    )}
                    {app.status === 'error' && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                        <XCircle className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-1 md:mb-1.5">{app.name}</h3>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                        app.status === 'connected'
                          ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse'
                          : app.status === 'error'
                            ? 'bg-red-500 shadow-lg shadow-red-500/50'
                            : 'bg-gray-300'
                      }`} />
                      <span className={`text-[11px] font-black uppercase tracking-widest ${
                        app.status === 'connected'
                          ? 'text-green-600'
                          : app.status === 'error'
                            ? 'text-red-600'
                            : 'text-gray-400'
                      }`}>
                        {app.status === 'connected' ? 'Connected' : app.status === 'error' ? 'Connection Failed' : 'Not Connected'}
                      </span>
                    </div>
                    {app.statusMessage && (
                      <p className={`text-[10px] font-medium mt-1 ${
                        app.status === 'error' ? 'text-red-500' : 'text-gray-500'
                      }`}>
                        {app.statusMessage}
                      </p>
                    )}
                    {app.webhookUrl && app.status !== 'connected' && (
                      <p className="text-[9px] text-gray-400 mt-0.5 font-mono truncate max-w-xs">
                        {app.webhookUrl.split('/').slice(0, 3).join('/')} • ••••••
                      </p>
                    )}
                    {app.status === 'connected' && app.files && app.files.length > 0 && (
                      <p className="text-[10px] text-gray-500 mt-1 font-medium">
                        {app.files.length} {app.files.length === 1 ? 'file' : 'files'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2 md:gap-3" onClick={(e) => e.stopPropagation()}>
                  {app.status === 'connected' ? (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleDisconnect(app.id)}
                        className="w-full px-4 md:px-6 py-2.5 md:py-3 bg-red-500 text-white rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/30 active:scale-95"
                      >
                        <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span>Disconnect</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedNewApp({ id: app.id, name: app.name, icon: app.icon });
                          setWebhookUrl((app as any).webhookUrl || '');
                          if ((app as any).credentials) {
                            setDbCredentials((app as any).credentials);
                          }
                          if ((app as any).apiCredentials) {
                            setApiCredentials((app as any).apiCredentials);
                          }
                          setModalStep(2);
                          setShowAddAppModal(true);
                        }}
                        className="w-full px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-[#5D5FEF]/80 to-[#4D4FCF]/80 text-white rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest hover:from-[#5D5FEF] hover:to-[#4D4FCF] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#5D5FEF]/15 hover:shadow-xl hover:shadow-[#5D5FEF]/25 active:scale-95"
                      >
                        <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span>Modify</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col gap-2">
                      <button
                        onClick={() => handleConnect(app.id)}
                        disabled={loading[app.id]}
                        className="w-full px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#5D5FEF]/20 hover:shadow-xl hover:shadow-[#5D5FEF]/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading[app.id] ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            <span>Connect</span>
                          </>
                        )}
                      </button>
                      {hasCredentials(app) && (
                        <button
                          onClick={() => {
                            setSelectedNewApp({ id: app.id, name: app.name, icon: app.icon });
                            setWebhookUrl((app as any).webhookUrl || '');
                            if ((app as any).credentials) {
                              setDbCredentials((app as any).credentials);
                            }
                            if ((app as any).apiCredentials) {
                              setApiCredentials((app as any).apiCredentials);
                            }
                            setModalStep(2);
                            setShowAddAppModal(true);
                          }}
                          className="w-full px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-[#5D5FEF]/80 to-[#4D4FCF]/80 text-white rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest hover:from-[#5D5FEF] hover:to-[#4D4FCF] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#5D5FEF]/15 hover:shadow-xl hover:shadow-[#5D5FEF]/25 active:scale-95"
                        >
                          <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <span>Modify</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Children Apps - Only show when not collapsed */}
              {app.children && app.children.length > 0 && app.status === 'connected' && !collapsedConnectedApps.has(app.id) && (
                <div className="mb-4 md:mb-6 pl-4 md:pl-6 border-l-2 border-gray-100 relative">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500/20 to-transparent" />
                  <p className="text-[9px] md:text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                    <span>Connected Services</span>
                    <span className="px-2 py-0.5 bg-green-100 rounded-full text-[8px] md:text-[9px] text-green-600">
                      {app.children.length}
                    </span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    {app.children.map((child, childIndex) => (
                      <div
                        key={childIndex}
                        className="group/child flex items-center gap-4 p-4 rounded-xl border bg-gradient-to-br from-green-50/50 to-transparent border-green-200 hover:border-green-300 transition-all duration-300"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white border-2 border-green-200 shadow-md group-hover/child:scale-110 transition-all duration-300">
                          <img
                            src={child.icon}
                            alt={child.name}
                            className="w-7 h-7 object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-black truncate mb-1 text-gray-900">
                            {child.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">
                              Active
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files/Workflows List - Only show when not collapsed */}
              {app.status === 'connected' && app.files && app.files.length > 0 && !collapsedConnectedApps.has(app.id) && (
                <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-300 uppercase tracking-widest flex items-center gap-2">
                      <span>{app.id.startsWith('n8n') || app.id.startsWith('mcp') ? 'Workflows' : 'Recent Files'}</span>
                      <span className="px-2 md:px-2.5 py-0.5 md:py-1 bg-green-100 text-green-600 rounded-full text-[8px] md:text-[9px] font-black">
                        {app.files.length}
                      </span>
                    </p>
                  </div>

                  {/* n8n/MCP Workflows */}
                  {(app.id.startsWith('n8n') || app.id.startsWith('mcp')) && (
                    <div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {app.files.slice(0, expandedApps.has(app.id) ? app.files.length : 9).map((workflow, index) => (
                          <div
                            key={workflow.id || index}
                            className="group/workflow flex items-center gap-3 p-4 md:p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 hover:border-[#5D5FEF]/30 hover:bg-gradient-to-br hover:from-[#5D5FEF]/5 hover:to-white transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                          >
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-[#5D5FEF]/10 to-[#4D4FCF]/10 border-2 border-[#5D5FEF]/20 flex items-center justify-center flex-shrink-0 group-hover/workflow:scale-110 transition-all duration-300">
                              <img
                                src={app.icon}
                                alt="Workflow"
                                className="w-5 h-5 md:w-6 md:h-6 object-contain"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] md:text-[14px] font-bold text-gray-900 truncate group-hover/workflow:text-[#5D5FEF] transition-colors mb-1">
                                {workflow.name || 'Untitled Workflow'}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {workflow.created && (
                                  <span className="text-[9px] md:text-[10px] font-bold text-gray-400">
                                    Created {formatDate(workflow.created)}
                                  </span>
                                )}
                                {workflow.modified && (
                                  <span className="text-[9px] md:text-[10px] font-bold text-gray-400">
                                    Updated {formatDate(workflow.modified)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Check className="w-4 h-4 text-[#5D5FEF] group-hover/workflow:text-[#5D5FEF] transition-colors flex-shrink-0 opacity-0 group-hover/workflow:opacity-100" />
                          </div>
                        ))}
                      </div>
                      {app.files.length > 9 && (
                        <button 
                          onClick={() => {
                            setExpandedApps(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(app.id)) {
                                newSet.delete(app.id);
                              } else {
                                newSet.add(app.id);
                              }
                              return newSet;
                            });
                          }}
                          className="mt-3 text-[9px] md:text-[10px] font-black text-[#5D5FEF] uppercase tracking-widest hover:opacity-70 transition-opacity flex items-center gap-1 ml-1"
                        >
                          <span>
                            {expandedApps.has(app.id) 
                              ? 'Show less' 
                              : `View ${app.files.length - 9} more workflow${app.files.length - 9 !== 1 ? 's' : ''}`
                            }
                          </span>
                          <ArrowRight className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Google Drive Files */}
                  {!app.id.startsWith('n8n') && !app.id.startsWith('mcp') && (
                    <div className="space-y-6 md:space-y-8">
                      {(() => {
                        const grouped = groupFilesByType(app.files);
                        const fileTypeInfo = [
                          { key: 'docs', label: 'Google Docs', icon: '/assets/apps/google-docs.svg', count: grouped.docs.length },
                          { key: 'sheets', label: 'Google Sheets', icon: '/assets/apps/google-sheets.svg', count: grouped.sheets.length },
                          { key: 'slides', label: 'Google Slides', icon: '/assets/apps/google-slides.svg', count: grouped.slides.length },
                        ];

                        return fileTypeInfo.map(({ key, label, icon, count }) => {
                          const files = grouped[key as keyof typeof grouped];
                          if (files.length === 0) return null;

                          return (
                            <div key={key}>
                              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                                <img src={icon} alt={label} className="w-5 h-5 md:w-6 md:h-6 object-contain" />
                                <p className="text-[11px] md:text-[12px] font-black text-gray-600 uppercase tracking-wider">
                                  {label}
                                </p>
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[8px] md:text-[9px] font-black">
                                  {count}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                              {files.slice(0, expandedFileCategories.has(`${app.id}-${key}`) ? files.length : 6).map((file, fileIndex) => (
                                <a
                                  key={file.id || fileIndex}
                                  href={file.url || file.webViewLink || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group/file flex items-center gap-3 p-4 md:p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 hover:border-[#5D5FEF]/30 hover:bg-gradient-to-br hover:from-[#5D5FEF]/5 hover:to-white transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                >
                                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white border-2 border-gray-100 flex items-center justify-center flex-shrink-0 shadow-sm group-hover/file:border-[#5D5FEF]/20 group-hover/file:scale-110 transition-all duration-300">
                                    <img
                                      src={getFileIcon(file.type)}
                                      alt={file.name || 'File'}
                                      className="w-5 h-5 md:w-7 md:h-7 object-contain"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] md:text-[14px] font-bold text-gray-900 truncate group-hover/file:text-[#5D5FEF] transition-colors mb-1">
                                      {file.name || 'Untitled'}
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {file.size && parseInt(String(file.size)) > 0 && (
                                        <span className="text-[9px] md:text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                                          {formatFileSize(typeof file.size === 'string' ? parseInt(file.size) : Number(file.size))}
                                        </span>
                                      )}
                                      {(file.modified || file.modifiedTime) && (
                                        <span className="text-[9px] md:text-[10px] font-bold text-gray-400">
                                          {formatDate(file.modified || file.modifiedTime)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <ExternalLink className="w-4 h-4 text-gray-300 group-hover/file:text-[#5D5FEF] transition-colors flex-shrink-0 opacity-0 group-hover/file:opacity-100" />
                                </a>
                              ))}
                            </div>
                            {files.length > 6 && (
                              <button 
                                onClick={() => {
                                  setExpandedFileCategories(prev => {
                                    const newSet = new Set(prev);
                                    const categoryKey = `${app.id}-${key}`;
                                    if (newSet.has(categoryKey)) {
                                      newSet.delete(categoryKey);
                                    } else {
                                      newSet.add(categoryKey);
                                    }
                                    return newSet;
                                  });
                                }}
                                className="mt-3 text-[9px] md:text-[10px] font-black text-[#5D5FEF] uppercase tracking-widest hover:opacity-70 transition-opacity flex items-center gap-1 ml-1"
                              >
                                <span>
                                  {expandedFileCategories.has(`${app.id}-${key}`) 
                                    ? 'Show less' 
                                    : `View ${files.length - 6} more ${label.split(' ').pop()?.toLowerCase()}`
                                  }
                                </span>
                                <ArrowRight className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              </button>
                            )}
                          </div>
                        );
                      });
                    })()}
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {app.status === 'connected' && (!app.files || app.files.length === 0) && !app.id.startsWith('mcp') && (
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 flex items-center justify-center mb-6">
                      <img
                        src={app.icon}
                        alt={app.name}
                        className="w-12 h-12 object-contain opacity-50"
                      />
                    </div>
                    <p className="text-gray-400 font-black text-sm mb-1">No files found</p>
                    <p className="text-gray-300 text-xs">Files will appear here once synced</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add More Apps Section */}
        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 p-10 text-center hover:border-[#5D5FEF]/30 transition-all duration-300 group/add">
          <div className="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-gray-200 flex items-center justify-center mx-auto mb-4 group-hover/add:border-[#5D5FEF]/30 group-hover/add:bg-[#5D5FEF]/5 transition-all">
            <span className="text-3xl text-gray-300 group-hover/add:text-[#5D5FEF] transition-colors">+</span>
          </div>
          <p className="text-gray-500 font-black text-sm mb-3">Want to connect more apps?</p>
          <button 
            onClick={() => setShowAddAppModal(true)}
            className="px-8 py-3.5 bg-white text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-gray-100 hover:border-[#5D5FEF]/30 hover:bg-[#5D5FEF]/5 hover:text-[#5D5FEF] transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            + Connect App
          </button>
        </div>
      </div>

      {/* Add App Modal */}
      {showAddAppModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
            onClick={() => {
              setShowAddAppModal(false);
              setModalStep(1);
              setSelectedNewApp(null);
              setWebhookUrl('');
              setDbCredentials({ host: '', port: '', username: '', password: '', database: '' });
              setApiCredentials({ apiUrl: '', apiKey: '' });
            }}
          />
          <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg">
              {/* Modal Header with Step Indicator */}
              <div className="bg-gradient-to-r from-[#5D5FEF]/10 to-[#5D5FEF]/5 px-6 md:px-8 py-6 md:py-8 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-gray-900">
                      {modalStep === 1 && 'Select App'}
                      {modalStep === 2 && 'Configure Credentials'}
                      {modalStep === 3 && selectedNewApp?.name && `Connecting ${selectedNewApp.name}...`}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-500 mt-1">
                      {modalStep === 1 && 'Choose an application to connect'}
                      {modalStep === 2 && selectedNewApp?.name && `Set up ${selectedNewApp.name}`}
                      {modalStep === 3 && 'Please wait while we establish the connection'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddAppModal(false);
                      setModalStep(1);
                      setSelectedNewApp(null);
                      setWebhookUrl('');
                      setDbCredentials({ host: '', port: '', username: '', password: '', database: '' });
                      setApiCredentials({ apiUrl: '', apiKey: '' });
                    }}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                
                {/* Step Indicator */}
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    modalStep >= 1 ? 'bg-[#5D5FEF] text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {modalStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                  </div>
                  <div className={`flex-1 h-1 rounded-full transition-all ${modalStep > 1 ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`} />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    modalStep >= 2 ? 'bg-[#5D5FEF] text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {modalStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                  </div>
                  <div className={`flex-1 h-1 rounded-full transition-all ${modalStep > 2 ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`} />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    modalStep >= 3 ? 'bg-[#5D5FEF] text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    3
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 md:p-8">
                {/* STEP 1: Select App */}
                {modalStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto">
                      {getAvailableAppsForModal().map(app => {
                        const isConnected = connectedAppIds.has(app.id);
                        return (
                          <button
                            key={app.id}
                            onClick={() => {
                              setSelectedNewApp(app);
                              setModalStep(2);
                            }}
                            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all relative ${
                              'border-gray-100 bg-white hover:border-[#5D5FEF]/30 hover:bg-[#5D5FEF]/5'
                            }`}
                          >
                            <img src={app.icon} alt={app.name} className="w-8 h-8 object-contain" />
                            <span className="text-[10px] font-bold text-gray-700 text-center line-clamp-2">
                              {app.name}
                            </span>
                            {isConnected && (
                              <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {getAvailableAppsForModal().length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-400">All apps connected!</p>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 2: Configure Credentials */}
                {modalStep === 2 && selectedNewApp && (
                  <div className="space-y-4 max-h-[55vh] overflow-y-auto">
                    {/* Selected App Display */}
                    <div className="bg-gradient-to-br from-[#5D5FEF]/5 to-[#5D5FEF]/10 rounded-xl p-4 border border-[#5D5FEF]/20 flex items-center gap-3">
                      <img src={selectedNewApp.icon} alt={selectedNewApp.name} className="w-10 h-10 object-contain" />
                      <div>
                        <p className="font-bold text-gray-900">{selectedNewApp.name}</p>
                        <p className="text-[10px] text-gray-500">
                          {isDatabaseApp(selectedNewApp.id) 
                            ? 'Enter database credentials' 
                            : isApiApp(selectedNewApp.id)
                            ? 'Enter API credentials'
                            : 'Configure webhook'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Webhook URL Input */}
                    {!isDatabaseApp(selectedNewApp.id) && !isApiApp(selectedNewApp.id) && (
                      <div>
                        <label className="text-[9px] md:text-[10px] font-black text-gray-700 uppercase tracking-widest mb-2 block">
                          Webhook URL
                        </label>
                        <input
                          type="text"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          placeholder="https://n8n.example.com/webhook/your-workflow"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 font-mono text-sm"
                        />
                        <p className="text-[9px] text-gray-400 mt-2">
                          Enter the webhook URL from your n8n workflow or integration service
                        </p>
                      </div>
                    )}

                    {/* API Credentials Input (for n8n, MCP) */}
                    {isApiApp(selectedNewApp.id) && (
                      <div className="space-y-4">
                        <p className="text-[9px] text-gray-500">
                          Enter your {selectedNewApp.name} instance credentials:
                        </p>
                        <div>
                          <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest mb-2 block">
                            {selectedNewApp.name} API URL
                          </label>
                          <input
                            type="text"
                            value={apiCredentials.apiUrl}
                            onChange={(e) => setApiCredentials(prev => ({ ...prev, apiUrl: e.target.value }))}
                            placeholder="http://192.168.5.0:5678"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm font-mono"
                          />
                          <p className="text-[9px] text-gray-400 mt-1">
                            Your {selectedNewApp.name} instance URL (including http:// or https://)
                          </p>
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest mb-2 block">
                            API Key
                          </label>
                          <input
                            type="password"
                            value={apiCredentials.apiKey}
                            onChange={(e) => setApiCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm font-mono"
                          />
                          <p className="text-[9px] text-gray-400 mt-1">
                            Your API key from {selectedNewApp.name} settings
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Database Credentials Input */}
                    {isDatabaseApp(selectedNewApp.id) && (
                      <div className="space-y-4">
                        <p className="text-[9px] text-gray-500 mb-4">
                          Enter your database connection details:
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest mb-2 block">
                              Host
                            </label>
                            <input
                              type="text"
                              value={dbCredentials.host}
                              onChange={(e) => setDbCredentials(prev => ({ ...prev, host: e.target.value }))}
                              placeholder="localhost"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest mb-2 block">
                              Port
                            </label>
                            <input
                              type="text"
                              value={dbCredentials.port}
                              onChange={(e) => setDbCredentials(prev => ({ ...prev, port: e.target.value }))}
                              placeholder={selectedNewApp.id === 'postgresql' ? '5432' : '3306'}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest mb-2 block">
                              Username
                            </label>
                            <input
                              type="text"
                              value={dbCredentials.username}
                              onChange={(e) => setDbCredentials(prev => ({ ...prev, username: e.target.value }))}
                              placeholder="admin"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest mb-2 block">
                              Password (Optional)
                            </label>
                            <input
                              type="password"
                              value={dbCredentials.password}
                              onChange={(e) => setDbCredentials(prev => ({ ...prev, password: e.target.value }))}
                              placeholder="••••••••"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest mb-2 block">
                              Database Name
                            </label>
                            <input
                              type="text"
                              value={dbCredentials.database}
                              onChange={(e) => setDbCredentials(prev => ({ ...prev, database: e.target.value }))}
                              placeholder="mydb"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Show error if any */}
                    {error && (
                      <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[9px] text-red-600">{error}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: Connecting */}
                {modalStep === 3 && selectedNewApp && (
                  <div className="space-y-4 py-8 text-center">
                    {loading[selectedNewApp.id] ? (
                      <>
                        <div className="flex justify-center mb-4">
                          <Loader2 className="w-12 h-12 text-[#5D5FEF] animate-spin" />
                        </div>
                        <p className="text-sm font-bold text-gray-700">Connecting to {selectedNewApp.name}...</p>
                        <p className="text-xs text-gray-500">Please wait while we establish the connection</p>
                      </>
                    ) : apps.find(a => a.id === selectedNewApp.id)?.status === 'connected' ? (
                      <>
                        <div className="flex justify-center mb-4">
                          <CheckCircle2 className="w-12 h-12 text-green-500" />
                        </div>
                        <p className="text-sm font-bold text-gray-700">{selectedNewApp.name} Connected!</p>
                        <p className="text-xs text-gray-500">{apps.find(a => a.id === selectedNewApp.id)?.statusMessage}</p>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-center mb-4">
                          <XCircle className="w-12 h-12 text-red-500" />
                        </div>
                        <p className="text-sm font-bold text-gray-700">Connection Failed</p>
                        <p className="text-xs text-gray-500">{apps.find(a => a.id === selectedNewApp.id)?.statusMessage}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 md:px-8 py-4 border-t border-gray-100 flex items-center gap-3">
                {modalStep === 1 && (
                  <button
                    onClick={() => {
                      setShowAddAppModal(false);
                      setModalStep(1);
                      setSelectedNewApp(null);
                      setWebhookUrl('');
                      setDbCredentials({ host: '', port: '', username: '', password: '', database: '' });
                      setApiCredentials({ apiUrl: '', apiKey: '' });
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Close
                  </button>
                )}
                {modalStep === 2 && (
                  <>
                    <button
                      onClick={() => setModalStep(1)}
                      className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        setModalStep(3);
                        handleAddApp();
                      }}
                      disabled={loading[selectedNewApp.id] || (
                        isDatabaseApp(selectedNewApp.id) 
                          ? !dbCredentials.host || !dbCredentials.port || !dbCredentials.username || !dbCredentials.database
                          : isApiApp(selectedNewApp.id)
                          ? !apiCredentials.apiUrl.trim() || !apiCredentials.apiKey.trim()
                          : !webhookUrl.trim()
                      )}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Connect
                    </button>
                  </>
                )}
                {modalStep === 3 && (
                  <>
                    <button
                      onClick={() => {
                        setModalStep(1);
                        setSelectedNewApp(null);
                        setWebhookUrl('');
                        setDbCredentials({ host: '', port: '', username: '', password: '', database: '' });
                        setApiCredentials({ apiUrl: '', apiKey: '' });
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                      Add Another
                    </button>
                    <button
                      onClick={() => {
                        setShowAddAppModal(false);
                        setModalStep(1);
                        setSelectedNewApp(null);
                        setWebhookUrl('');
                        setDbCredentials({ host: '', port: '', username: '', password: '', database: '' });
                        setApiCredentials({ apiUrl: '', apiKey: '' });
                      }}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all"
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MyAppsView;
