import { useState, useCallback, useEffect, useRef } from 'react';
import type { RemovableDeviceInfo } from '@/types';
import type { ToastData } from '@/components/common/Toast';
import { AI_MODELS } from '@/constants';
import { getSessionToken } from '@/services/api.client';

export function useLayout() {
  const [detailsWidth, setDetailsWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isMobileDevice] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android.*Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1280);
  const [mountedDevice, setMountedDevice] = useState<RemovableDeviceInfo | null>(() => {
    try { return localStorage.getItem('mountedDevice') ? JSON.parse(localStorage.getItem('mountedDevice')!) : null; } catch { return null; }
  });
  const [showBanner, setShowBanner] = useState(true);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => {
    try { const saved = localStorage.getItem('arcellite_selected_model'); if (saved) return saved; } catch {}
    return AI_MODELS[0].id;
  });

  // Persist mounted device
  useEffect(() => {
    if (mountedDevice) {
      localStorage.setItem('mountedDevice', JSON.stringify(mountedDevice));
    } else {
      localStorage.removeItem('mountedDevice');
    }
  }, [mountedDevice]);

  // Column resize handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 280 && newWidth <= 600) setDetailsWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stopResizing); };
  }, [resize, stopResizing]);

  // Mobile viewport detection
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mql);
    mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
    return () => mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
  }, []);

  const showToast = useCallback((message: string, type: ToastData['type'] = 'success', icon?: ToastData['icon']) => {
    setToast({ message, type, icon });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    try { localStorage.setItem('arcellite_selected_model', model); } catch {}
    // Persist to server so it syncs across devices
    const token = getSessionToken();
    if (token) {
      fetch('/api/auth/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ preferredModel: model }),
      }).catch(() => {});
    }
  }, []);

  // Sync model preference from server, then validate against configured providers
  useEffect(() => {
    let cancelled = false;

    async function syncModel() {
      // Step 1: Fetch server-saved preference
      const token = getSessionToken();
      let serverModel = '';
      if (token) {
        try {
          const settingsRes = await fetch('/api/auth/settings', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const settingsData = await settingsRes.json();
          serverModel = settingsData.settings?.preferredModel || '';
        } catch {}
      }

      if (cancelled) return;

      // Apply server model if valid
      if (serverModel && AI_MODELS.some(m => m.id === serverModel)) {
        setSelectedModel(serverModel);
        try { localStorage.setItem('arcellite_selected_model', serverModel); } catch {}
      }

      // Step 2: Validate against configured providers (only override if current model has no key)
      try {
        const providersRes = await fetch('/api/ai/configured-providers');
        const providersData = await providersRes.json();
        if (cancelled) return;
        if (providersData.ok && providersData.providers?.length > 0) {
          setSelectedModel(prev => {
            const currentModel = AI_MODELS.find(m => m.id === prev);
            if (!currentModel || !providersData.providers.includes(currentModel.provider)) {
              const firstConfigured = AI_MODELS.find(m => providersData.providers.includes(m.provider));
              if (firstConfigured) {
                try { localStorage.setItem('arcellite_selected_model', firstConfigured.id); } catch {}
                return firstConfigured.id;
              }
            }
            return prev;
          });
        }
      } catch {}
    }

    syncModel();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    detailsWidth,
    isResizing,
    isMobile,
    isMobileDevice,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    mountedDevice,
    setMountedDevice,
    showBanner,
    setShowBanner,
    toast,
    setToast,
    selectedModel,
    startResizing,
    showToast,
    handleModelChange,
  };
}
