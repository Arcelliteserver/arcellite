import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Copy, ExternalLink, Loader2, ChevronDown, ChevronUp, RefreshCw, Check, AlertTriangle, X } from 'lucide-react';

// Icons from assets/icons (inline SVG paths)
const AutomationIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" className={className}>
    <path d="M296-270q-42 35-87.5 32T129-269q-34-28-46.5-73.5T99-436l75-124q-25-22-39.5-53T120-680q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47q-9 0-18-1t-17-3l-77 130q-11 18-7 35.5t17 28.5q13 11 31 12.5t35-12.5l420-361q42-35 88-31.5t80 31.5q34 28 46 73.5T861-524l-75 124q25 22 39.5 53t14.5 67q0 66-47 113t-113 47q-66 0-113-47t-47-113q0-66 47-113t113-47q9 0 17.5 1t16.5 3l78-130q11-18 7-35.5T782-630q-13-11-31-12.5T716-630L296-270Zm40.5-353.5Q360-647 360-680t-23.5-56.5Q313-760 280-760t-56.5 23.5Q200-713 200-680t23.5 56.5Q247-600 280-600t56.5-23.5Zm400 400Q760-247 760-280t-23.5-56.5Q713-360 680-360t-56.5 23.5Q600-313 600-280t23.5 56.5Q647-200 680-200t56.5-23.5ZM280-680Zm400 400Z" />
  </svg>
);

const RocketIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" className={className}>
    <path d="m240-198 79-32q-10-29-18.5-59T287-349l-47 32v119Zm160-42h160q18-40 29-97.5T600-455q0-99-33-187.5T480-779q-54 48-87 136.5T360-455q0 60 11 117.5t29 97.5Zm23.5-223.5Q400-487 400-520t23.5-56.5Q447-600 480-600t56.5 23.5Q560-553 560-520t-23.5 56.5Q513-440 480-440t-56.5-23.5ZM720-198v-119l-47-32q-5 30-13.5 60T641-230l79 32ZM480-881q99 72 149.5 183T680-440l84 56q17 11 26.5 29t9.5 38v237l-199-80H359L160-80v-237q0-20 9.5-38t26.5-29l84-56q0-147 50.5-258T480-881Z" />
  </svg>
);

const WebhookIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" className={className}>
    <path d="M280-120q-83 0-141.5-58.5T80-320q0-73 45.5-127.5T240-516v83q-35 12-57.5 43T160-320q0 50 35 85t85 35q50 0 85-35t35-85v-40h235q8-9 19.5-14.5T680-380q25 0 42.5 17.5T740-320q0 25-17.5 42.5T680-260q-14 0-25.5-5.5T635-280H476q-14 69-68.5 114.5T280-120Zm400 0q-56 0-101.5-27.5T507-220h107q14 10 31 15t35 5q50 0 85-35t35-85q0-50-35-85t-85-35q-20 0-37 5.5T611-418L489-621q-21-4-35-20t-14-39q0-25 17.5-42.5T500-740q25 0 42.5 17.5T560-680v8.5q0 3.5-2 8.5l87 146q8-2 17-2.5t18-.5q83 0 141.5 58.5T880-320q0 83-58.5 141.5T680-120ZM280-260q-25 0-42.5-17.5T220-320q0-22 14-38t34-21l94-156q-29-27-45.5-64.5T300-680q0-83 58.5-141.5T500-880q83 0 141.5 58.5T700-680h-80q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 43 26 75.5t66 41.5L337-338q2 5 2.5 9t.5 9q0 25-17.5 42.5T280-260Z" />
  </svg>
);

const PasswordIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" className={className}>
    <path d="M80-200v-80h800v80H80Zm46-242-52-30 34-60H40v-60h68l-34-58 52-30 34 58 34-58 52 30-34 58h68v60h-68l34 60-52 30-34-60-34 60Zm320 0-52-30 34-60h-68v-60h68l-34-58 52-30 34 58 34-58 52 30-34 58h68v60h-68l34 60-52 30-34-60-34 60Zm320 0-52-30 34-60h-68v-60h68l-34-58 52-30 34 58 34-58 52 30-34 58h68v60h-68l34 60-52 30-34-60-34 60Z" />
  </svg>
);

const DeployedCodeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" className={className}>
    <path d="M440-183v-274L200-596v274l240 139Zm80 0 240-139v-274L520-457v274Zm-40-343 237-137-237-137-237 137 237 137ZM160-252q-19-11-29.5-29T120-321v-318q0-22 10.5-40t29.5-29l280-161q19-11 40-11t40 11l280 161q19 11 29.5 29t10.5 40v318q0 22-10.5 40T800-252L520-91q-19 11-40 11t-40-11L160-252Zm320-228Z" />
  </svg>
);

const StacksIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" className={className}>
    <path d="M480-400 40-640l440-240 440 240-440 240Zm0 160L63-467l84-46 333 182 333-182 84 46-417 227Zm0 160L63-307l84-46 333 182 333-182 84 46L480-80Zm0-411 273-149-273-149-273 149 273 149Zm0-149Z" />
  </svg>
);

const HandshakeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" className={className}>
    <path d="M475-160q4 0 8-2t6-4l328-328q12-12 17.5-27t5.5-30q0-16-5.5-30.5T817-607L647-777q-11-12-25.5-17.5T591-800q-15 0-30 5.5T534-777l-11 11 74 75q15 14 22 32t7 38q0 42-28.5 70.5T527-522q-20 0-38.5-7T456-550l-75-74-175 175q-3 3-4.5 6.5T200-435q0 8 6 14.5t14 6.5q4 0 8-2t6-4l136-136 56 56-135 136q-3 3-4.5 6.5T285-350q0 8 6 14t14 6q4 0 8-2t6-4l136-135 56 56-135 136q-3 2-4.5 6t-1.5 8q0 8 6 14t14 6q4 0 7.5-1.5t6.5-4.5l136-135 56 56-136 136q-3 3-4.5 6.5T454-180q0 8 6.5 14t14.5 6Zm-1 80q-37 0-65.5-24.5T375-166q-34-5-57-28t-28-57q-34-5-56.5-28.5T206-336q-38-5-62-33t-24-66q0-20 7.5-38.5T149-506l232-231 131 131q2 3 6 4.5t8 1.5q9 0 15-5.5t6-14.5q0-4-1.5-8t-4.5-6L398-777q-11-12-25.5-17.5T342-800q-15 0-30 5.5T285-777L144-635q-9 9-15 21t-8 24q-2 12 0 24.5t8 23.5l-58 58q-17-23-25-50.5T40-590q2-28 14-54.5T87-692l141-141q24-23 53.5-35t60.5-12q31 0 60.5 12t52.5 35l11 11 11-11q24-23 53.5-35t60.5-12q31 0 60.5 12t52.5 35l169 169q23 23 35 53t12 61q0 31-12 60.5T873-437L545-110q-14 14-32.5 22T474-80Zm-99-560Z" />
  </svg>
);

const CodeBlocksIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" className={className}>
    <path d="m384-336 56-57-87-87 87-87-56-57-144 144 144 144Zm192 0 144-144-144-144-56 57 87 87-87 87 56 57ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z" />
  </svg>
);

const EcoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" className={className}>
    <path d="M216-176q-45-45-70.5-104T120-402q0-63 24-124.5T222-642q35-35 86.5-60t122-39.5Q501-756 591.5-759t202.5 7q8 106 5 195t-16.5 160.5q-13.5 71.5-38 125T684-182q-53 53-112.5 77.5T450-80q-65 0-127-25.5T216-176Zm112-16q29 17 59.5 24.5T450-160q46 0 91-18.5t86-59.5q18-18 36.5-50.5t32-85Q709-426 716-500.5t2-177.5q-49-2-110.5-1.5T485-670q-61 9-116 29t-90 55q-45 45-62 89t-17 85q0 59 22.5 103.5T262-246q42-80 111-153.5T534-520q-72 63-125.5 142.5T328-192Zm0 0Zm0 0Z" />
  </svg>
);

interface DomainSetupProps {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;
}

interface DomainStatus {
  cloudflaredInstalled: boolean;
  cloudflaredVersion: string | null;
  tunnelRunning: boolean;
  tunnelName: string | null;
  customDomain: string | null;
  tunnelToken: string | null;
  serviceInstalled: boolean;
}

const INSTALL_COMMANDS = {
  debian: `# Add Cloudflare GPG key
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null

# Add this repo to your apt repositories
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Install cloudflared
sudo apt-get update && sudo apt-get install cloudflared`,

  redhat: `# Add cloudflared.repo to /etc/yum.repos.d/
curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | sudo tee /etc/yum.repos.d/cloudflared.repo

# Update repo
sudo yum update

# Install cloudflared
sudo yum install cloudflared`,

  docker: `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token YOUR_TOKEN`,
};

const UPDATE_COMMANDS = {
  debian: `# Update cloudflared
sudo apt-get update && sudo apt-get upgrade cloudflared`,

  redhat: `# Update cloudflared
sudo yum update cloudflared`,

  docker: `# Pull latest and restart
docker pull cloudflare/cloudflared:latest
docker stop cloudflared && docker rm cloudflared
docker run -d --name cloudflared --restart unless-stopped cloudflare/cloudflared:latest tunnel --no-autoupdate run --token YOUR_TOKEN`,
};

const DomainSetupView: React.FC<DomainSetupProps> = ({ showToast }) => {
  const [status, setStatus] = useState<DomainStatus>({
    cloudflaredInstalled: false,
    cloudflaredVersion: null,
    tunnelRunning: false,
    tunnelName: null,
    customDomain: null,
    tunnelToken: null,
    serviceInstalled: false,
  });
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [runningTunnel, setRunningTunnel] = useState(false);
  const [tunnelToken, setTunnelToken] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [selectedOS, setSelectedOS] = useState<'debian' | 'redhat' | 'docker'>('debian');
  const [showManualInstall, setShowManualInstall] = useState(false);
  const [showUpdateGuide, setShowUpdateGuide] = useState(false);
  const [installLog, setInstallLog] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const [stoppingTunnel, setStoppingTunnel] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('sessionToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/domain/status', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.customDomain) setCustomDomain(data.customDomain);
        if (data.tunnelToken) setTunnelToken(data.tunnelToken);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleInstallCloudflared = async () => {
    setInstalling(true);
    setInstallLog('Installing cloudflared...\n');
    try {
      const res = await fetch('/api/domain/install-cloudflared', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setInstallLog(prev => prev + (data.log || 'Installation completed successfully.\n'));
        showToast('cloudflared installed successfully', 'success');
        await fetchStatus();
      } else {
        setInstallLog(prev => prev + (data.error || 'Installation failed.\n'));
        showToast(data.error || 'Installation failed', 'error');
      }
    } catch (e) {
      setInstallLog(prev => prev + `Error: ${(e as Error).message}\n`);
      showToast('Installation failed', 'error');
    } finally {
      setInstalling(false);
    }
  };

  const handleSaveTokenAndRun = async () => {
    if (!tunnelToken.trim()) {
      showToast('Please enter your tunnel token', 'warning');
      return;
    }
    setRunningTunnel(true);
    try {
      const res = await fetch('/api/domain/run-tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ token: tunnelToken.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Tunnel service started successfully', 'success');
        await fetchStatus();
      } else {
        showToast(data.error || 'Failed to start tunnel', 'error');
      }
    } catch {
      showToast('Failed to start tunnel', 'error');
    } finally {
      setRunningTunnel(false);
    }
  };

  const handleStopTunnel = async () => {
    setStoppingTunnel(true);
    try {
      const res = await fetch('/api/domain/stop-tunnel', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Tunnel service stopped', 'info');
        await fetchStatus();
      } else {
        showToast(data.error || 'Failed to stop tunnel', 'error');
      }
    } catch {
      showToast('Failed to stop tunnel', 'error');
    } finally {
      setStoppingTunnel(false);
    }
  };

  const handleSaveDomain = async () => {
    if (!customDomain.trim()) {
      showToast('Please enter your domain', 'warning');
      return;
    }
    setSavingDomain(true);
    try {
      const res = await fetch('/api/domain/save-domain', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ domain: customDomain.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Domain saved successfully', 'success');
        await fetchStatus();
      } else {
        showToast(data.error || 'Failed to save domain', 'error');
      }
    } catch {
      showToast('Failed to save domain', 'error');
    } finally {
      setSavingDomain(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    showToast('Copied to clipboard', 'success', 'copy');
  };

  // Determine current step
  const currentStep = !status.cloudflaredInstalled ? 1
    : (!status.tunnelRunning && !status.serviceInstalled) ? 2
    : !status.customDomain ? 3
    : 4;

  if (loading) {
    return (
      <div className="pb-12 animate-pulse">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-200" />
              <div>
                <div className="h-6 w-44 bg-gray-200 rounded-lg mb-2" />
                <div className="h-3.5 w-80 bg-gray-100 rounded-md" />
              </div>
            </div>
            <div className="h-9 w-24 bg-gray-100 rounded-xl" />
          </div>
        </div>

        {/* How It Works skeleton */}
        <div className="mb-8">
          <div className="h-3 w-28 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-gray-100 mb-3" />
                <div className="h-3 w-20 bg-gray-200 rounded mb-1.5" />
                <div className="h-2.5 w-28 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Step progress bar skeleton */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(step => (
              <React.Fragment key={step}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-200" />
                  <div className="h-3 w-14 bg-gray-100 rounded hidden sm:block" />
                </div>
                {step < 3 && <div className="flex-1 h-0.5 rounded-full bg-gray-200" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step cards skeleton */}
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border border-gray-100 mb-5 px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-52 bg-gray-200 rounded-lg mb-2" />
                <div className="h-3 w-64 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pb-12">

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] flex items-center justify-center shadow-lg shadow-[#5D5FEF]/20">
              <WebhookIcon className="fill-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900">Custom Domain</h2>
              <p className="text-sm text-gray-400 mt-0.5">Connect your own domain via Cloudflare Tunnel — secure, fast, no port forwarding required</p>
            </div>
          </div>
          <button
            onClick={() => { setLoading(true); fetchStatus(); }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-500 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Status Banner (when fully configured) */}
      {currentStep === 4 && (
        <div className="bg-gradient-to-r from-[#5D5FEF]/5 to-[#5D5FEF]/[0.02] border border-[#5D5FEF]/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#5D5FEF] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <p className="text-base font-black text-gray-900">Your custom domain is live!</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-[#5D5FEF]/10">
              <div className="flex items-center gap-2 mb-2">
                <WebhookIcon className="fill-gray-400 w-4 h-4" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Domain</p>
              </div>
              <a href={`https://${status.customDomain}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#5D5FEF] hover:underline flex items-center gap-1">
                {status.customDomain}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#5D5FEF]/10">
              <div className="flex items-center gap-2 mb-2">
                <AutomationIcon className="fill-gray-400 w-4 h-4" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tunnel Status</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#5D5FEF] animate-pulse" />
                <p className="text-sm font-bold text-[#5D5FEF]">Connected</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#5D5FEF]/10">
              <div className="flex items-center gap-2 mb-2">
                <DeployedCodeIcon className="fill-gray-400 w-4 h-4" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Cloudflared</p>
              </div>
              <p className="text-sm font-bold text-gray-700">{status.cloudflaredVersion || 'Installed'}</p>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="mb-8">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">How It Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { icon: <EcoIcon className="fill-emerald-500 w-5 h-5" />, title: 'Purchase Domain', desc: 'Buy a domain from any registrar' },
            { icon: <HandshakeIcon className="fill-blue-500 w-5 h-5" />, title: 'Add to Cloudflare', desc: 'Transfer DNS to Cloudflare' },
            { icon: <AutomationIcon className="fill-orange-500 w-5 h-5" />, title: 'Create Tunnel', desc: 'Set up a Cloudflare Tunnel' },
            { icon: <RocketIcon className="fill-purple-500 w-5 h-5" />, title: 'Go Live', desc: 'Access Arcellite from anywhere' },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 text-center relative">
              {i < 3 && (
                <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                  <svg className="w-4 h-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center">
                {item.icon}
              </div>
              <p className="text-xs font-black text-gray-800 mb-0.5">{item.title}</p>
              <p className="text-[10px] text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Step Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(step => (
            <React.Fragment key={step}>
              <div className={`flex items-center gap-2 ${step <= currentStep ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                  step < currentStep ? 'bg-[#5D5FEF] text-white' :
                  step === currentStep ? 'bg-[#5D5FEF] text-white' :
                  'bg-gray-200 text-gray-400'
                }`}>
                  {step < currentStep ? <Check className="w-3.5 h-3.5" /> : step}
                </div>
                <span className="text-xs font-bold text-gray-600 hidden sm:inline">
                  {step === 1 ? 'Install' : step === 2 ? 'Connect' : 'Configure'}
                </span>
              </div>
              {step < 3 && (
                <div className={`flex-1 h-0.5 rounded-full ${step < currentStep ? 'bg-[#5D5FEF]/60' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* STEP 1 — Install Cloudflared */}
      <div className={`rounded-2xl border mb-5 overflow-hidden transition-all ${
        currentStep === 1 ? 'border-[#5D5FEF]/20 shadow-md shadow-[#5D5FEF]/5' : 'border-gray-100'
      }`}>
        <div className={`px-6 py-5 flex items-start gap-4 ${currentStep === 1 ? 'bg-gradient-to-r from-[#5D5FEF]/[0.03] to-transparent' : ''}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            status.cloudflaredInstalled ? 'bg-[#5D5FEF]/10' : 'bg-orange-50'
          }`}>
            {status.cloudflaredInstalled ? (
              <CheckCircle2 className="w-5 h-5 text-[#5D5FEF]" />
            ) : (
              <DeployedCodeIcon className="fill-orange-500 w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  Step 1 — Install Cloudflared
                  {status.cloudflaredInstalled && (
                    <span className="px-2.5 py-0.5 bg-[#5D5FEF]/10 text-[#5D5FEF] text-[10px] font-black rounded-full uppercase">Installed</span>
                  )}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {status.cloudflaredInstalled
                    ? `cloudflared ${status.cloudflaredVersion || ''} is installed and ready`
                    : 'Install the Cloudflare tunnel connector on your server'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {currentStep === 1 && (
          <div className="px-6 pb-6 space-y-5">
            <div className="border-t border-gray-100 pt-5" />

            {/* Auto Install */}
            <div className="bg-[#F5F5F7] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <RocketIcon className="fill-[#5D5FEF] w-5 h-5" />
                <p className="text-sm font-black text-gray-800">Automatic Installation</p>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Click the button below to automatically install cloudflared on this server. This requires sudo access and works on Debian/Ubuntu systems.
              </p>
              <button
                onClick={handleInstallCloudflared}
                disabled={installing}
                className="w-full px-5 py-3.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-sm font-black uppercase tracking-wider hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5D5FEF]/20"
              >
                {installing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <DeployedCodeIcon className="fill-white w-5 h-5" />
                    Auto Install Cloudflared
                  </>
                )}
              </button>
            </div>

            {/* Install log */}
            {installLog && (
              <div className="bg-[#0d1117] rounded-2xl p-5 font-mono text-[12px] text-green-400 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-gray-800">
                <div className="flex items-center gap-2 mb-3 text-gray-500 text-[10px] font-sans font-bold uppercase tracking-wider">
                  <StacksIcon className="fill-gray-500 w-3.5 h-3.5" />
                  Installation Output
                </div>
                {installLog}
              </div>
            )}

            {/* Manual Install */}
            <div>
              <button
                onClick={() => setShowManualInstall(!showManualInstall)}
                className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-[#5D5FEF] transition-colors w-full justify-between bg-white rounded-xl border border-gray-100 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <CodeBlocksIcon className="fill-gray-400 w-4 h-4" />
                  <span>Manual Installation Commands</span>
                </div>
                {showManualInstall ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showManualInstall && (
                <div className="mt-3 space-y-4 bg-white rounded-2xl border border-gray-100 p-5">
                  {/* OS Tabs */}
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    {(['debian', 'redhat', 'docker'] as const).map(os => (
                      <button
                        key={os}
                        onClick={() => setSelectedOS(os)}
                        className={`flex-1 px-3 py-2.5 rounded-lg text-[11px] font-bold transition-all ${
                          selectedOS === os
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {os === 'debian' ? 'Debian / Ubuntu' : os === 'redhat' ? 'Red Hat / CentOS' : 'Docker'}
                      </button>
                    ))}
                  </div>

                  {/* Command Block */}
                  <div className="relative group">
                    <div className="bg-[#0d1117] rounded-xl p-4 font-mono text-[12px] text-green-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      <span className="text-gray-500 select-none">$ </span>
                      {INSTALL_COMMANDS[selectedOS]}
                    </div>
                    <button
                      onClick={() => copyToClipboard(INSTALL_COMMANDS[selectedOS], `install-${selectedOS}`)}
                      className="absolute top-3 right-3 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy"
                    >
                      {copiedField === `install-${selectedOS}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    After installing manually, click <strong className="text-gray-600">Refresh</strong> at the top to update status.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed state for completed step */}
        {status.cloudflaredInstalled && currentStep !== 1 && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[#5D5FEF] font-bold">✓ cloudflared {status.cloudflaredVersion || ''} installed</span>
              <button
                onClick={() => setShowUpdateGuide(!showUpdateGuide)}
                className="text-gray-400 hover:text-[#5D5FEF] font-bold transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Update Guide
              </button>
            </div>

            {/* Update guide */}
            {showUpdateGuide && (
              <div className="mt-4 bg-[#F5F5F7] rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-black text-gray-800">Update Cloudflared</p>
                </div>
                <p className="text-xs text-gray-500">
                  Updates will cause cloudflared to restart which will briefly impact traffic. For zero-downtime upgrades, 
                  use Cloudflare Load Balancer or multiple cloudflared instances.
                </p>

                {/* OS Tabs */}
                <div className="flex gap-1 bg-white rounded-xl p-1">
                  {(['debian', 'redhat', 'docker'] as const).map(os => (
                    <button
                      key={os}
                      onClick={() => setSelectedOS(os)}
                      className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                        selectedOS === os
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {os === 'debian' ? 'Debian / Ubuntu' : os === 'redhat' ? 'Red Hat' : 'Docker'}
                    </button>
                  ))}
                </div>

                <div className="relative group">
                  <div className="bg-[#0d1117] rounded-xl p-4 font-mono text-[12px] text-green-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    <span className="text-gray-500 select-none">$ </span>
                    {UPDATE_COMMANDS[selectedOS]}
                  </div>
                  <button
                    onClick={() => copyToClipboard(UPDATE_COMMANDS[selectedOS], `update-${selectedOS}`)}
                    className="absolute top-3 right-3 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {copiedField === `update-${selectedOS}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber-700">
                      <p className="font-bold text-amber-800 mb-1">Zero-downtime upgrades</p>
                      <p>Use Cloudflare Load Balancer or run multiple cloudflared instances to avoid traffic interruption during updates.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* STEP 2 — Connect Tunnel */}
      <div className={`rounded-2xl border mb-5 overflow-hidden transition-all ${
        currentStep === 2 ? 'border-[#5D5FEF]/20 shadow-md shadow-[#5D5FEF]/5' : 'border-gray-100'
      } ${currentStep < 2 ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className={`px-6 py-5 flex items-start gap-4 ${currentStep === 2 ? 'bg-gradient-to-r from-[#5D5FEF]/[0.03] to-transparent' : ''}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            status.tunnelRunning || status.serviceInstalled ? 'bg-[#5D5FEF]/10' : 'bg-blue-50'
          }`}>
            {status.tunnelRunning || status.serviceInstalled ? (
              <CheckCircle2 className="w-5 h-5 text-[#5D5FEF]" />
            ) : (
              <AutomationIcon className="fill-blue-500 w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              Step 2 — Connect Tunnel
              {(status.tunnelRunning || status.serviceInstalled) && (
                <span className="px-2.5 py-0.5 bg-[#5D5FEF]/10 text-[#5D5FEF] text-[10px] font-black rounded-full uppercase">Active</span>
              )}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {status.tunnelRunning ? 'Tunnel is active and connected to Cloudflare' : 'Enter your Cloudflare tunnel token to connect'}
            </p>
          </div>
        </div>

        {currentStep >= 2 && (
          <div className="px-6 pb-6 space-y-5">
            <div className="border-t border-gray-100 pt-5" />

            {/* How to get token */}
            <div className="bg-[#F5F5F7] border border-gray-200 rounded-2xl p-5">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
                  <PasswordIcon className="fill-[#5D5FEF] w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-gray-800 mb-2">How to get your tunnel token</p>
                  <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                    <li>Go to <a href="https://one.dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="underline font-bold text-[#5D5FEF] hover:text-[#4D4FCF]">Cloudflare Zero Trust Dashboard</a></li>
                    <li>Navigate to <strong className="text-gray-800">Networks → Tunnels</strong></li>
                    <li>Click <strong className="text-gray-800">Create a tunnel</strong> → Name it (e.g. "arcellite") → Save</li>
                    <li>Copy the token from the install connector page (starts with <code className="bg-gray-200 px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-700">eyJ...</code>)</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Token warning */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-600">
                <strong>Store your token carefully.</strong> This token allows the connector to run. Anyone with access to this token will be able to run the tunnel.
              </p>
            </div>

            {/* Token Input */}
            <div className="bg-[#F5F5F7] rounded-2xl p-5">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-2.5">
                Tunnel Token
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={tunnelToken}
                  onChange={e => setTunnelToken(e.target.value)}
                  placeholder="eyJhIjoiZD..."
                  className="w-full px-4 py-3.5 bg-white rounded-xl border border-gray-200 focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 transition-all text-sm font-mono outline-none"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                <PasswordIcon className="w-3 h-3 fill-gray-400" />
                Your token is stored securely on your server and never shared
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSaveTokenAndRun}
                disabled={runningTunnel || !tunnelToken.trim()}
                className="flex-1 px-5 py-3.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-sm font-black uppercase tracking-wider hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5D5FEF]/20"
              >
                {runningTunnel ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <RocketIcon className="fill-white w-5 h-5" />
                    Install &amp; Start Service
                  </>
                )}
              </button>
              {(status.tunnelRunning || status.serviceInstalled) && (
                <button
                  onClick={handleStopTunnel}
                  disabled={stoppingTunnel}
                  className="px-5 py-3.5 bg-red-500 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-red-600 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-red-500/20"
                >
                  <X className="w-4 h-4" />
                  {stoppingTunnel ? 'Stopping...' : 'Stop'}
                </button>
              )}
            </div>

            {/* Manual run commands */}
            {status.cloudflaredInstalled && tunnelToken && tunnelToken !== '••••••••' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CodeBlocksIcon className="fill-gray-400 w-4 h-4" />
                  <p className="text-xs font-black text-gray-600">Manual Commands</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Install as persistent service (auto-starts on boot)</p>
                  <div className="relative group">
                    <div className="bg-[#0d1117] rounded-xl p-3.5 font-mono text-[12px] text-green-400">
                      <span className="text-gray-500 select-none">$ </span>sudo cloudflared service install {tunnelToken.slice(0, 10)}...
                    </div>
                    <button
                      onClick={() => copyToClipboard(`sudo cloudflared service install ${tunnelToken}`, 'svc-install')}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {copiedField === 'svc-install' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Or run in current terminal session only</p>
                  <div className="relative group">
                    <div className="bg-[#0d1117] rounded-xl p-3.5 font-mono text-[12px] text-green-400">
                      <span className="text-gray-500 select-none">$ </span>cloudflared tunnel run --token {tunnelToken.slice(0, 10)}...
                    </div>
                    <button
                      onClick={() => copyToClipboard(`cloudflared tunnel run --token ${tunnelToken}`, 'tunnel-run')}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {copiedField === 'tunnel-run' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* STEP 3 — Configure Domain */}
      <div className={`rounded-2xl border mb-5 overflow-hidden transition-all ${
        currentStep === 3 || currentStep === 4 ? 'border-[#5D5FEF]/20 shadow-md shadow-[#5D5FEF]/5' : 'border-gray-100'
      } ${currentStep < 3 ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className={`px-6 py-5 flex items-start gap-4 ${currentStep >= 3 ? 'bg-gradient-to-r from-[#5D5FEF]/[0.03] to-transparent' : ''}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            status.customDomain ? 'bg-[#5D5FEF]/10' : 'bg-purple-50'
          }`}>
            {status.customDomain ? (
              <CheckCircle2 className="w-5 h-5 text-[#5D5FEF]" />
            ) : (
              <WebhookIcon className="fill-purple-500 w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              Step 3 — Configure Domain
              {status.customDomain && (
                <span className="px-2.5 py-0.5 bg-[#5D5FEF]/10 text-[#5D5FEF] text-[10px] font-black rounded-full uppercase">Active</span>
              )}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {status.customDomain ? `Configured: ${status.customDomain}` : 'Set up your public hostname and save your domain'}
            </p>
          </div>
        </div>

        {currentStep >= 3 && (
          <div className="px-6 pb-6 space-y-5">
            <div className="border-t border-gray-100 pt-5" />

            {/* Cloudflare routing instructions */}
            <div className="bg-[#F5F5F7] border border-gray-200 rounded-2xl p-5">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
                  <HandshakeIcon className="fill-[#5D5FEF] w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-gray-800 mb-2">Route traffic to Arcellite</p>
                  <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                    <li>In your <a href="https://one.dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="underline font-bold text-[#5D5FEF] hover:text-[#4D4FCF]">Cloudflare Tunnel settings</a>, go to the <strong>Public Hostname</strong> tab</li>
                    <li>Click <strong>Add a public hostname</strong></li>
                    <li>Set your <strong>Subdomain</strong> (e.g. <code className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-mono">cloud</code>) and <strong>Domain</strong></li>
                    <li>Set Service Type to <strong>HTTP</strong> and URL to <code className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-mono">localhost:3000</code></li>
                    <li>Save hostname</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Domain Input */}
            <div className="bg-[#F5F5F7] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <WebhookIcon className="fill-[#5D5FEF] w-5 h-5" />
                <label className="text-sm font-black text-gray-800">Your Custom Domain</label>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">https://</span>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    placeholder="cloud.yourdomain.com"
                    className="w-full pl-[72px] pr-4 py-3.5 bg-white rounded-xl border border-gray-200 focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 transition-all text-sm font-medium outline-none"
                  />
                </div>
                <button
                  onClick={handleSaveDomain}
                  disabled={savingDomain || !customDomain.trim()}
                  className="px-6 py-3.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-sm font-black uppercase tracking-wider hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-[#5D5FEF]/20"
                >
                  {savingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resources & Help */}
      <div className="mt-8">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Resources</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-[#5D5FEF]/30 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-50 group-hover:bg-[#5D5FEF]/5 flex items-center justify-center transition-colors">
                <CodeBlocksIcon className="fill-gray-400 group-hover:fill-[#5D5FEF] w-5 h-5 transition-colors" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700 group-hover:text-[#5D5FEF]">Cloudflare Tunnel Docs</p>
                <p className="text-[10px] text-gray-400">Official documentation</p>
              </div>
            </div>
          </a>
          <a
            href="https://one.dash.cloudflare.com"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-[#5D5FEF]/30 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-50 group-hover:bg-[#5D5FEF]/5 flex items-center justify-center transition-colors">
                <DeployedCodeIcon className="fill-gray-400 group-hover:fill-[#5D5FEF] w-5 h-5 transition-colors" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700 group-hover:text-[#5D5FEF]">Zero Trust Dashboard</p>
                <p className="text-[10px] text-gray-400">Manage tunnels & hostnames</p>
              </div>
            </div>
          </a>
          <a
            href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-[#5D5FEF]/30 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-50 group-hover:bg-[#5D5FEF]/5 flex items-center justify-center transition-colors">
                <RocketIcon className="fill-gray-400 group-hover:fill-[#5D5FEF] w-5 h-5 transition-colors" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700 group-hover:text-[#5D5FEF]">Getting Started Guide</p>
                <p className="text-[10px] text-gray-400">Create your first tunnel</p>
              </div>
            </div>
          </a>
        </div>
      </div>

      {/* Version requirement note */}
      <div className="mt-6 bg-gray-50 rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
        <StacksIcon className="fill-gray-400 w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-gray-600">Remotely managed tunnels require cloudflared 2022.03.04 or later.</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            If you installed cloudflared during the Arcellite setup wizard, you're already on the latest version.
            You can also install or configure your tunnel later at any time from this page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DomainSetupView;
