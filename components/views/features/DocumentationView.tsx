import React, { useState, useRef, useEffect } from 'react';
import {
  Book,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Server,
  HardDrive,
  Cpu,
  Monitor,
  Cast,
  MessageSquare,
  Workflow,
  Download,
  Terminal,
  Shield,
  Database,
  Globe,
  Zap,
  ExternalLink,
  Search,
  FileText,
  Cloud,
  Tv,
  Settings,
  ArrowRight,
} from 'lucide-react';

// ─── Code Block with Copy ───────────────────────────────────────────
const CodeBlock: React.FC<{ code: string; language?: string; title?: string }> = ({ code, language = 'bash', title }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 bg-[#1a1a2e] my-4">
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#16162a] border-b border-white/5">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{title}</span>
          <span className="text-[9px] font-bold text-gray-600 uppercase">{language}</span>
        </div>
      )}
      <div className="relative group">
        <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono text-gray-300 scrollbar-thin">
          <code>{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
        </button>
      </div>
    </div>
  );
};

// ─── Step Card ──────────────────────────────────────────────────────
const StepCard: React.FC<{ number: number; title: string; children: React.ReactNode }> = ({ number, title, children }) => (
  <div className="flex gap-4 mb-6">
    <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#5D5FEF] text-white flex items-center justify-center font-black text-sm">{number}</div>
    <div className="flex-1 min-w-0">
      <h4 className="text-[15px] font-black text-gray-900 mb-2">{title}</h4>
      <div className="text-[13px] text-gray-600 leading-relaxed">{children}</div>
    </div>
  </div>
);

// ─── Info Badge ─────────────────────────────────────────────────────
const InfoBadge: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'purple' }) => {
  const colors: Record<string, string> = {
    purple: 'bg-[#5D5FEF]/5 text-[#5D5FEF] border-[#5D5FEF]/10',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider ${colors[color]}`}>
      <span className="text-gray-400 font-bold normal-case">{label}</span>
      {value}
    </div>
  );
};

// ─── Sidebar Navigation ─────────────────────────────────────────────
const SECTIONS = [
  { id: 'getting-started', label: 'Getting Started', icon: Zap },
  { id: 'requirements', label: 'System Requirements', icon: Server },
  { id: 'installation', label: 'Installation Guide', icon: Download },
  { id: 'chromecast', label: 'Chromecast Integration', icon: Cast },
  { id: 'discord', label: 'Discord Integration', icon: MessageSquare },
  { id: 'n8n', label: 'n8n Automation', icon: Workflow },
  { id: 'cloud-storage', label: 'Cloud Storage Sync', icon: Cloud },
  { id: 'database', label: 'Database Access', icon: Database },
  { id: 'domain', label: 'Custom Domain', icon: Globe },
  { id: 'ai', label: 'AI Configuration', icon: Cpu },
  { id: 'security', label: 'Security', icon: Shield },
];

const DocumentationView: React.FC = () => {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredSections = searchQuery
    ? SECTIONS.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : SECTIONS;

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    setSidebarOpen(false);
    const el = document.getElementById(`doc-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Track scroll position for active section highlighting
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      for (const section of SECTIONS) {
        const el = document.getElementById(`doc-${section.id}`);
        if (el) {
          const top = el.offsetTop - container.offsetTop - 100;
          const bottom = top + el.offsetHeight;
          if (scrollTop >= top && scrollTop < bottom) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Mobile section picker */}
      <div className="md:hidden fixed top-20 left-3 right-3 z-40">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-sm"
        >
          <span className="text-sm font-bold text-gray-700">{SECTIONS.find(s => s.id === activeSection)?.label}</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
        </button>
        {sidebarOpen && (
          <div className="mt-2 bg-white rounded-2xl border border-gray-100 shadow-lg p-2 space-y-1 max-h-[50vh] overflow-y-auto">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  activeSection === s.id ? 'bg-[#5D5FEF]/5 text-[#5D5FEF]' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <s.icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-bold">{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Sidebar — fixed full height */}
      <div className="hidden md:flex flex-col w-60 lg:w-[17rem] flex-shrink-0 h-full border-r border-gray-100 bg-white/80 backdrop-blur-xl">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Sidebar Header */}
          <div className="flex-shrink-0 px-5 pt-6 pb-4 border-b border-gray-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-[#5D5FEF] to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-[#5D5FEF]/20">
                <Book className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-[15px] font-black tracking-tight text-gray-900">Documentation</h1>
                <p className="text-[10px] font-bold text-gray-400">Guides & API Reference</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search docs..."
                className="w-full pl-9 pr-3 py-2.5 bg-[#F5F5F7] rounded-xl text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-[#5D5FEF]/20 transition-all border border-transparent placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Sidebar Nav — scrollable */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 custom-scrollbar">
            {filteredSections.map(s => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                  activeSection === s.id
                    ? 'bg-[#5D5FEF]/5 text-[#5D5FEF]'
                    : 'text-gray-500 hover:bg-[#F5F5F7] hover:text-gray-700'
                }`}
              >
                <s.icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-[12px] font-bold truncate">{s.label}</span>
              </button>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-50">
            <p className="text-[10px] font-bold text-gray-300 text-center uppercase tracking-widest">Arcellite v1.0.0</p>
          </div>
        </div>
      </div>

      {/* Content — stretches full width */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto scroll-smooth px-4 sm:px-6 md:px-8 lg:px-12 pt-16 md:pt-6 pb-20 custom-scrollbar"
      >
        <div className="max-w-7xl mx-auto space-y-12">

            {/* ═══ Getting Started ═══ */}
            <section id="doc-getting-started">
              <div className="bg-gradient-to-br from-[#5D5FEF] to-indigo-700 rounded-[2rem] p-8 md:p-10 text-white mb-8">
                <h2 className="text-2xl md:text-3xl font-heading font-bold mb-3">Welcome to Arcellite</h2>
                <p className="text-white/80 leading-relaxed mb-6">
                  Arcellite is a self-hosted personal cloud platform for file management, AI assistance, database tools,
                  and smart device integrations. This documentation will help you set up and configure all features.
                </p>
                <div className="flex flex-wrap gap-2">
                  <InfoBadge label="Version" value="1.0.0" color="purple" />
                  <InfoBadge label="License" value="MIT" color="green" />
                  <InfoBadge label="Author" value="Robera Desissa" color="blue" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Download, title: 'Installation', desc: 'Set up Arcellite on your server', section: 'installation' },
                  { icon: Cast, title: 'Chromecast', desc: 'Cast media to smart TVs', section: 'chromecast' },
                  { icon: MessageSquare, title: 'Discord', desc: 'Send files to Discord channels', section: 'discord' },
                  { icon: Workflow, title: 'n8n Automation', desc: 'Connect workflow automations', section: 'n8n' },
                  { icon: Cloud, title: 'Cloud Storage', desc: 'Google Drive & OneDrive sync', section: 'cloud-storage' },
                  { icon: Database, title: 'Database', desc: 'Remote database access', section: 'database' },
                ].map(item => (
                  <button
                    key={item.section}
                    onClick={() => scrollToSection(item.section)}
                    className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-[#5D5FEF]/20 hover:shadow-lg hover:shadow-[#5D5FEF]/5 transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-[#5D5FEF]/5 rounded-xl flex items-center justify-center group-hover:bg-[#5D5FEF]/10 transition-all">
                      <item.icon className="w-5 h-5 text-[#5D5FEF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-gray-900">{item.title}</p>
                      <p className="text-[11px] text-gray-400 font-medium">{item.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#5D5FEF] transition-colors" />
                  </button>
                ))}
              </div>
            </section>

            {/* ═══ System Requirements ═══ */}
            <section id="doc-requirements">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <Server className="w-6 h-6 text-[#5D5FEF]" />
                System Requirements
              </h2>
              <p className="text-sm text-gray-500 mb-6">Hardware and software specifications for running Arcellite.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">Minimum</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-2"><Cpu className="w-3.5 h-3.5" /> CPU</span>
                      <span className="text-xs font-bold text-gray-900">4 cores (ARM64 or x86_64)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-2"><Monitor className="w-3.5 h-3.5" /> RAM</span>
                      <span className="text-xs font-bold text-gray-900">4 GB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-2"><HardDrive className="w-3.5 h-3.5" /> Storage</span>
                      <span className="text-xs font-bold text-gray-900">64 GB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> OS</span>
                      <span className="text-xs font-bold text-gray-900">Ubuntu 22.04+ / Debian 12+</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border-2 border-[#5D5FEF]/20 p-5">
                  <p className="text-[10px] font-black text-[#5D5FEF] uppercase tracking-widest mb-3">Recommended</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-2"><Cpu className="w-3.5 h-3.5" /> CPU</span>
                      <span className="text-xs font-bold text-[#5D5FEF]">4+ cores</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-2"><Monitor className="w-3.5 h-3.5" /> RAM</span>
                      <span className="text-xs font-bold text-[#5D5FEF]">8+ GB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-2"><HardDrive className="w-3.5 h-3.5" /> Storage</span>
                      <span className="text-xs font-bold text-[#5D5FEF]">250+ GB (SSD)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> OS</span>
                      <span className="text-xs font-bold text-gray-900">Ubuntu 24.04 LTS</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#F5F5F7] rounded-2xl p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Software Prerequisites</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: 'Node.js', version: '≥ 18', required: true },
                    { name: 'PostgreSQL', version: '≥ 14', required: true },
                    { name: 'MySQL/MariaDB', version: 'Any', required: false },
                    { name: 'PM2', version: 'Latest', required: false },
                  ].map(s => (
                    <div key={s.name} className="bg-white rounded-xl p-3 text-center">
                      <p className="text-xs font-black text-gray-900">{s.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{s.version}</p>
                      <p className={`text-[9px] font-black uppercase mt-1 ${s.required ? 'text-[#5D5FEF]' : 'text-gray-300'}`}>{s.required ? 'Required' : 'Optional'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                <HardDrive className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-700">Storage Note</p>
                  <p className="text-xs text-amber-600 leading-relaxed mt-1">
                    64 GB is the minimum to get started — enough for the OS, Arcellite, and basic file storage.
                    We strongly recommend <strong>250 GB or more</strong> for a comfortable experience. This gives you room
                    for file uploads, media storage, database backups, and future growth. NVMe/SSD storage provides
                    significantly better performance for database operations and file serving.
                  </p>
                </div>
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                <Server className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-700">Supported Platforms</p>
                  <p className="text-xs text-blue-600 leading-relaxed mt-1">
                    Arcellite runs on <strong>Ubuntu 22.04/24.04</strong>, <strong>Debian 12</strong>, <strong>Raspberry Pi OS (64-bit)</strong>,
                    and any Linux distribution with Node.js ≥ 18 and PostgreSQL ≥ 14. ARM64 and x86_64 architectures are both supported.
                  </p>
                </div>
              </div>
            </section>

            {/* ═══ Installation Guide ═══ */}
            <section id="doc-installation">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <Download className="w-6 h-6 text-[#5D5FEF]" />
                Installation Guide
              </h2>
              <p className="text-sm text-gray-500 mb-6">Complete step-by-step guide to installing Arcellite on your server.</p>

              <StepCard number={1} title="Clone the Repository">
                <p className="mb-2">Clone the Arcellite repository from GitHub onto your server:</p>
                <CodeBlock
                  code={`git clone https://github.com/Arcelliteserver/arcellite.git\ncd arcellite`}
                  title="Clone Repository"
                />
              </StepCard>

              <StepCard number={2} title="Run the Installer">
                <p className="mb-2">
                  The automated installer handles everything — Node.js, PostgreSQL, MySQL/MariaDB, SQLite,
                  data directories, environment configuration, and PM2 setup.
                </p>
                <CodeBlock
                  code={`chmod +x install.sh\n./install.sh`}
                  title="Run Installer"
                />
                <p className="mt-2 text-gray-500">
                  The installer runs 10 steps automatically:
                </p>
                <div className="mt-3 space-y-2">
                  {[
                    'System dependencies (curl, build tools)',
                    'Node.js ≥ 18 installation',
                    'PostgreSQL setup & database creation',
                    'MySQL/MariaDB setup',
                    'SQLite support (pure JS — no system packages)',
                    'Data directories (~/arcellite-data/)',
                    'Environment configuration (.env)',
                    'npm dependency installation',
                    'Frontend build & server compile',
                    'PM2 process manager & auto-start on reboot',
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px]">
                      <div className="w-5 h-5 rounded-lg bg-[#5D5FEF]/5 flex items-center justify-center text-[9px] font-black text-[#5D5FEF]">{i + 1}</div>
                      <span className="text-gray-600">{step}</span>
                    </div>
                  ))}
                </div>
              </StepCard>

              <StepCard number={3} title="Access the Web UI">
                <p className="mb-2">Once installed, open your browser and navigate to:</p>
                <CodeBlock
                  code={`# Local access\nhttp://localhost:3000\n\n# LAN access (replace with your server IP)\nhttp://YOUR-SERVER-IP:3000`}
                  title="Access URL"
                />
                <p className="mt-2">Complete the setup wizard to create your admin account, then go to <strong>Settings → AI Models</strong> to add your API keys.</p>
              </StepCard>

              <StepCard number={4} title="Managing the Server">
                <p className="mb-2">Arcellite runs via PM2. Useful commands:</p>
                <CodeBlock
                  code={`# Check status\npm2 status\n\n# View logs\npm2 logs arcellite\n\n# Restart\npm2 restart arcellite\n\n# Stop\npm2 stop arcellite\n\n# Auto-starts on reboot (already configured by installer)`}
                  title="PM2 Commands"
                />
              </StepCard>

              <StepCard number={5} title="Data Directory Structure">
                <p className="mb-2">All user data is stored in <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[12px]">~/arcellite-data/</code>:</p>
                <CodeBlock
                  code={`~/arcellite-data/\n├── files/          # General files\n├── photos/         # Images & photos\n├── videos/         # Video files\n├── music/          # Music files\n├── shared/         # Shared files between users\n├── avatars/        # User profile pictures\n├── databases/      # User-created databases\n│   └── sqlite/     # SQLite database files\n└── ...`}
                  language="text"
                  title="Directory Layout"
                />
              </StepCard>

              <StepCard number={6} title="Cloudflare Tunnel (Optional)">
                <p className="mb-2">
                  The installer optionally installs <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[12px]">cloudflared</code> for
                  remote access via a custom domain — no port forwarding or static IP needed.
                </p>
                <CodeBlock
                  code={`# If you skipped during install, install later:\ncurl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null\necho 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list\nsudo apt-get update && sudo apt-get install -y cloudflared`}
                  title="Install Cloudflared"
                />
                <p className="mt-2">Then configure your tunnel in <strong>Settings → Domain</strong> in the web UI.</p>
              </StepCard>
            </section>

            {/* ═══ Chromecast Integration ═══ */}
            <section id="doc-chromecast">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <Cast className="w-6 h-6 text-[#5D5FEF]" />
                Chromecast Integration
              </h2>
              <p className="text-sm text-gray-500 mb-6">Cast photos and videos from Arcellite directly to your Chromecast, Google Home, or smart TV devices using n8n and Home Assistant.</p>

              <div className="bg-[#F5F5F7] rounded-2xl p-5 mb-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">How It Works</p>
                <div className="flex flex-col sm:flex-row items-center gap-3 text-center">
                  {['Arcellite', '→', 'n8n Webhook', '→', 'Home Assistant', '→', 'Chromecast'].map((item, i) => (
                    i % 2 === 0 ? (
                      <div key={i} className="bg-white rounded-xl px-4 py-2.5 border border-gray-100 shadow-sm">
                        <p className="text-xs font-black text-gray-900">{item}</p>
                      </div>
                    ) : (
                      <ArrowRight key={i} className="w-4 h-4 text-[#5D5FEF] rotate-90 sm:rotate-0" />
                    )
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 mb-6">
                <Settings className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-700">Prerequisites</p>
                  <p className="text-xs text-blue-600 leading-relaxed mt-1">
                    You need a running <strong>n8n instance</strong> and <strong>Home Assistant</strong> with your Chromecast devices
                    configured. The n8n workflow connects them to Arcellite via webhooks.
                  </p>
                </div>
              </div>

              <StepCard number={1} title="Import the n8n Workflow">
                <p className="mb-2">
                  Download the Chromecast workflow JSON and import it into your n8n instance:
                </p>
                <div className="mb-3">
                  <a
                    href="/json/Chromecast%20Webhook%20-%20Cast%20from%20Website%20(Multi-Device).json"
                    download
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#5D5FEF] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Chromecast Workflow
                  </a>
                </div>
                <p>In n8n: <strong>Workflows → Import from File</strong> → select the downloaded JSON.</p>
              </StepCard>

              <StepCard number={2} title="Configure Home Assistant Credentials">
                <p className="mb-2">
                  In the imported workflow, click the <strong>"Cast to Chromecast"</strong> node and add your Home Assistant credentials:
                </p>
                <CodeBlock
                  code={`# In n8n credentials, add a Home Assistant API credential:\n\nHost: http://YOUR-HOME-ASSISTANT-IP:8123\nAccess Token: YOUR_LONG_LIVED_ACCESS_TOKEN\n\n# Generate a token in Home Assistant:\n# Profile → Long-Lived Access Tokens → Create Token`}
                  title="Home Assistant Credentials"
                />
              </StepCard>

              <StepCard number={3} title="Update Device Mapping">
                <p className="mb-2">
                  In the <strong>"Format Media"</strong> code node, update the device entity IDs to match your Home Assistant setup:
                </p>
                <CodeBlock
                  code={`// Device mapping — update entity_ids to match your Home Assistant\nconst devices = {\n  'gaming_tv': {\n    name: 'Living Room TV',\n    entity_id: 'media_player.living_room_tv'  // ← Your entity ID\n  },\n  'smart_tv': {\n    name: 'Bedroom TV',\n    entity_id: 'media_player.bedroom_tv'      // ← Your entity ID\n  },\n  'my_room': {\n    name: 'Kitchen Display',\n    entity_id: 'media_player.kitchen_display'  // ← Your entity ID\n  },\n  'space_tv': {\n    name: 'Office Chromecast',\n    entity_id: 'media_player.office_cast'      // ← Your entity ID\n  }\n};`}
                  language="javascript"
                  title="Device Configuration (n8n Code Node)"
                />
                <p className="mt-2">Find your entity IDs in Home Assistant under <strong>Developer Tools → States</strong> — look for entities starting with <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[12px]">media_player.</code></p>
              </StepCard>

              <StepCard number={4} title="Activate & Get the Webhook URL">
                <p className="mb-2">
                  Activate the workflow in n8n. The webhook URL will be:
                </p>
                <CodeBlock
                  code={`# Your n8n webhook URL will be:\nhttps://YOUR-N8N-DOMAIN/webhook/castc35483a5\n\n# The webhook accepts POST requests with this payload:\n{\n  "fileName": "vacation.jpg",\n  "fileType": "image",\n  "fileUrl": "https://your-arcellite.com/api/files/serve?category=media&path=vacation.jpg",\n  "mimeType": "image/jpeg",\n  "device": "space_tv"\n}`}
                  language="json"
                  title="Webhook Endpoint"
                />
              </StepCard>

              <StepCard number={5} title="Using Chromecast in Arcellite">
                <p>
                  Once configured, open any image or video in Arcellite and tap the <strong>Cast</strong> icon in the
                  file viewer. Select your device and the media will start playing on your TV or display.
                  You can also ask the AI assistant: <em>"Cast vacation.jpg to the living room TV"</em>.
                </p>
              </StepCard>

              <div className="bg-[#5D5FEF]/5 border border-[#5D5FEF]/10 rounded-2xl p-5 mt-4">
                <p className="text-[10px] font-black text-[#5D5FEF] uppercase tracking-widest mb-2">Supported Media</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs font-bold text-gray-700">Images</p>
                    <p className="text-[10px] text-gray-400">JPG, PNG, GIF, WebP</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-gray-700">Videos</p>
                    <p className="text-[10px] text-gray-400">MP4, WebM, MKV</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-gray-700">YouTube</p>
                    <p className="text-[10px] text-gray-400">Auto-detected URLs</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ═══ Discord Integration ═══ */}
            <section id="doc-discord">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <MessageSquare className="w-6 h-6 text-[#5865F2]" />
                Discord Integration
              </h2>
              <p className="text-sm text-gray-500 mb-6">Send files and messages from Arcellite directly to your Discord server channels using n8n webhooks and a Discord bot.</p>

              <div className="bg-[#F5F5F7] rounded-2xl p-5 mb-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">How It Works</p>
                <div className="flex flex-col sm:flex-row items-center gap-3 text-center">
                  {['Arcellite', '→', 'n8n Webhook', '→', 'Discord Bot', '→', 'Your Server'].map((item, i) => (
                    i % 2 === 0 ? (
                      <div key={i} className="bg-white rounded-xl px-4 py-2.5 border border-gray-100 shadow-sm">
                        <p className="text-xs font-black text-gray-900">{item}</p>
                      </div>
                    ) : (
                      <ArrowRight key={i} className="w-4 h-4 text-[#5865F2] rotate-90 sm:rotate-0" />
                    )
                  ))}
                </div>
              </div>

              <StepCard number={1} title="Create a Discord Bot">
                <p className="mb-2">Go to the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-[#5D5FEF] font-bold underline">Discord Developer Portal</a> and create a bot:</p>
                <div className="space-y-1.5 mt-2">
                  {[
                    'Click "New Application" and give it a name',
                    'Go to "Bot" → click "Add Bot"',
                    'Copy the Bot Token (you\'ll need this in n8n)',
                    'Enable "Message Content Intent" under Privileged Gateway Intents',
                    'Go to OAuth2 → URL Generator → select "bot" scope',
                    'Select permissions: Send Messages, Read Message History, View Channels',
                    'Copy the generated URL and invite the bot to your server',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px]">
                      <div className="w-5 h-5 rounded-lg bg-[#5865F2]/10 flex items-center justify-center text-[9px] font-black text-[#5865F2] flex-shrink-0 mt-0.5">{i + 1}</div>
                      <span className="text-gray-600">{step}</span>
                    </div>
                  ))}
                </div>
              </StepCard>

              <StepCard number={2} title="Import the n8n Discord Workflow">
                <p className="mb-2">Download and import the Discord workflow into your n8n instance:</p>
                <div className="mb-3">
                  <a
                    href="/json/AI%20to%20Discord%20-%20Send%20Messages%20via%20Webhook.json"
                    download
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#5865F2] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#4752C4] transition-all shadow-lg shadow-[#5865F2]/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Discord Workflow
                  </a>
                </div>
                <p>This workflow provides <strong>two webhooks</strong>:</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100">
                    <code className="text-[11px] bg-gray-100 px-2 py-1 rounded-lg font-mono">GET /webhook/discord-channels</code>
                    <span className="text-[11px] text-gray-500">— Lists all channels in your Discord server</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100">
                    <code className="text-[11px] bg-gray-100 px-2 py-1 rounded-lg font-mono">POST /webhook/discord-send</code>
                    <span className="text-[11px] text-gray-500">— Sends messages &amp; files to a channel</span>
                  </div>
                </div>
              </StepCard>

              <StepCard number={3} title="Configure Discord Bot Credentials in n8n">
                <p className="mb-2">In n8n, add your Discord bot credentials:</p>
                <CodeBlock
                  code={`# In n8n → Credentials → Add Credential → Discord Bot\n\nBot Token: YOUR_DISCORD_BOT_TOKEN\n\n# Then update the "Get Server Channels" and "Send Discord Message"\n# nodes to use your credential and your Discord Guild (Server) ID.\n\n# Find your Guild ID:\n# Discord → Server Settings → Widget → Server ID\n# Or: Enable Developer Mode → Right-click server → Copy Server ID`}
                  title="Discord Bot Credential"
                />
              </StepCard>

              <StepCard number={4} title="Connect in Arcellite">
                <p className="mb-2">
                  Go to <strong>My Apps</strong> in Arcellite, find <strong>Discord</strong>, and enter your two n8n webhook URLs:
                </p>
                <CodeBlock
                  code={`# Channels URL (GET — fetches available channels)\nhttps://YOUR-N8N-DOMAIN/webhook/discord-channels\n\n# Send URL (POST — sends messages to channels)\nhttps://YOUR-N8N-DOMAIN/webhook/discord-send`}
                  title="Webhook URLs"
                />
                <p className="mt-2">Click <strong>Connect</strong> and Arcellite will fetch your Discord channels. You can now send files and messages from the AI assistant or directly from file actions.</p>
              </StepCard>

              <StepCard number={5} title="Sending Messages via AI">
                <p>Once connected, ask the AI assistant to send files to Discord. It will auto-select the best channel:</p>
                <CodeBlock
                  code={`# Example commands to the AI assistant:\n\n"Send vacation.jpg to Discord"\n→ AI auto-selects #images channel\n\n"Share the quarterly report to Discord #documents"\n→ Sends to #documents with file attachment\n\n"Post a message to #general saying Hello from Arcellite!"\n→ Sends text message to #general`}
                  language="text"
                  title="AI Assistant Examples"
                />
              </StepCard>

              <div className="bg-[#5865F2]/5 border border-[#5865F2]/10 rounded-2xl p-5 mt-4">
                <p className="text-[10px] font-black text-[#5865F2] uppercase tracking-widest mb-2">Send Payload Format</p>
                <CodeBlock
                  code={`// POST to /webhook/discord-send\n{\n  "channel": "images",       // Channel name (auto-matched)\n  "message": "Check this out!", // Message text\n  "fileUrl": "https://your-arcellite.com/api/files/serve?category=media&path=photo.jpg"  // Optional file\n}`}
                  language="json"
                  title="Request Body"
                />
              </div>
            </section>

            {/* ═══ n8n Automation ═══ */}
            <section id="doc-n8n">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <Workflow className="w-6 h-6 text-[#EA4B71]" />
                n8n Automation
              </h2>
              <p className="text-sm text-gray-500 mb-6">Connect Arcellite to n8n for powerful automation workflows — file processing, notifications, backups, and more.</p>

              <StepCard number={1} title="Install n8n with Docker Compose">
                <p className="mb-2">
                  Since Arcellite and n8n run on the <strong>same server</strong>, they can communicate over <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[12px]">localhost</code> — no
                  extra networking needed. We recommend running n8n via Docker Compose inside a dedicated directory:
                </p>
                <CodeBlock
                  code={`# SSH into your server\nssh your-username@your-server\n\n# Create a dedicated directory for n8n\nsudo mkdir -p /srv/n8n\ncd /srv/n8n`}
                  title="Step 1 — Create Directory"
                />
                <p className="mt-3 mb-2">Create the Docker Compose file:</p>
                <CodeBlock
                  code={`# Create the compose file\nsudo nano /srv/n8n/docker-compose.yml`}
                  title="Step 2 — Create Compose File"
                />
                <p className="mt-3 mb-2">Paste the following configuration:</p>
                <CodeBlock
                  code={`version: '3.8'\n\nservices:\n  n8n:\n    image: n8nio/n8n:latest\n    container_name: n8n\n    restart: always\n    ports:\n      - "5678:5678"\n    environment:\n      - N8N_HOST=0.0.0.0\n      - N8N_PORT=5678\n      - N8N_PROTOCOL=http\n      - WEBHOOK_URL=https://your-n8n-domain.com/   # Your public n8n URL\n      - GENERIC_TIMEZONE=America/New_York           # Your timezone\n    volumes:\n      - ./n8n_data:/home/node/.n8n                  # Persistent data\n      - ./files:/files                              # Shared files (optional)\n    networks:\n      - n8n-net\n\nnetworks:\n  n8n-net:\n    driver: bridge`}
                  language="yaml"
                  title="docker-compose.yml"
                />
                <p className="mt-3 mb-2">Start n8n:</p>
                <CodeBlock
                  code={`# Start n8n in the background\ncd /srv/n8n\nsudo docker compose up -d\n\n# Verify it's running\nsudo docker ps\n\n# View logs if needed\nsudo docker compose logs -f n8n`}
                  title="Step 3 — Start n8n"
                />
              </StepCard>

              <StepCard number={2} title="Access n8n & Create API Key">
                <p className="mb-2">Since both services run on the same machine, n8n is accessible locally:</p>
                <CodeBlock
                  code={`# Local access (from the server itself)\nhttp://localhost:5678\n\n# LAN / browser access\nhttp://YOUR-SERVER-IP:5678\n\n# If you set up a reverse proxy (Cloudflare Tunnel, Nginx, etc.)\nhttps://your-n8n-domain.com`}
                  title="Access n8n"
                />
                <p className="mt-2 mb-2">After creating your n8n account, generate an API key:</p>
                <div className="space-y-1.5 mt-2">
                  {[
                    'Go to n8n Settings (gear icon, bottom left)',
                    'Click "API" in the sidebar',
                    'Click "Create an API Key"',
                    'Copy the key — you\'ll need it in Arcellite',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px]">
                      <div className="w-5 h-5 rounded-lg bg-[#EA4B71]/10 flex items-center justify-center text-[9px] font-black text-[#EA4B71] flex-shrink-0 mt-0.5">{i + 1}</div>
                      <span className="text-gray-600">{step}</span>
                    </div>
                  ))}
                </div>
              </StepCard>

              <StepCard number={3} title="Connect n8n in Arcellite">
                <p className="mb-2">Go to <strong>My Apps → n8n</strong> and enter your n8n connection details:</p>
                <CodeBlock
                  code={`# n8n API URL (since both are on the same server, use localhost)\nhttp://localhost:5678\n\n# n8n API Key\nYOUR_N8N_API_KEY`}
                  title="n8n Connection"
                />
                <p className="mt-2">Because Arcellite and n8n are on the same server, requests go through <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[12px]">localhost</code> with zero latency — no firewall rules or port forwarding needed for this connection.</p>
              </StepCard>

              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-3 my-6">
                <Zap className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-700">Same Server Advantage</p>
                  <p className="text-xs text-emerald-600 leading-relaxed mt-1">
                    Because Arcellite and n8n are both running on <strong>your server</strong>, webhook calls between them
                    are instant (<code className="px-1 py-0.5 bg-emerald-100/50 rounded text-[11px]">localhost:5678</code>).
                    No external network hops, no API rate limits, and no cloud dependencies. Your automations stay
                    completely private and self-hosted.
                  </p>
                </div>
              </div>

              <StepCard number={4} title="Manage n8n">
                <p className="mb-2">Useful Docker commands to manage your n8n instance:</p>
                <CodeBlock
                  code={`# Check status\ncd /srv/n8n && sudo docker compose ps\n\n# View logs\nsudo docker compose logs -f n8n\n\n# Restart n8n\nsudo docker compose restart n8n\n\n# Update to latest version\nsudo docker compose pull\nsudo docker compose up -d\n\n# Stop n8n\nsudo docker compose down\n\n# Your data persists in:\n# /srv/n8n/n8n_data/    — n8n config, workflows, credentials\n# /srv/n8n/files/       — shared files`}
                  title="Docker Management"
                />
              </StepCard>

              <StepCard number={5} title="Import Pre-Built Workflows">
                <p className="mb-2">Arcellite provides ready-to-use n8n workflow templates:</p>
                <div className="space-y-2 mt-3">
                  {[
                    { name: 'Chromecast Webhook', desc: 'Cast media to smart TVs via Home Assistant', file: 'Chromecast Webhook - Cast from Website (Multi-Device).json' },
                    { name: 'Discord Send Messages', desc: 'Send files & messages to Discord channels', file: 'AI to Discord - Send Messages via Webhook.json' },
                    { name: 'Google Drive Sync', desc: 'Sync files between Arcellite and Google Drive', file: 'Google Drive File Manager.json' },
                    { name: 'OneDrive Sync', desc: 'Sync files between Arcellite and OneDrive', file: 'OneDrive File Manager.json' },
                  ].map(w => (
                    <a
                      key={w.name}
                      href={`/json/${encodeURIComponent(w.file)}`}
                      download
                      className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-[#5D5FEF]/20 hover:shadow-sm transition-all group"
                    >
                      <div className="w-8 h-8 bg-[#EA4B71]/10 rounded-lg flex items-center justify-center">
                        <Download className="w-4 h-4 text-[#EA4B71]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900">{w.name}</p>
                        <p className="text-[10px] text-gray-400">{w.desc}</p>
                      </div>
                      <Download className="w-4 h-4 text-gray-300 group-hover:text-[#5D5FEF] transition-colors" />
                    </a>
                  ))}
                </div>
              </StepCard>

              <StepCard number={6} title="Server-Side Webhook Proxy">
                <p className="mb-2">Arcellite includes a built-in webhook proxy to avoid CORS issues when calling n8n webhooks from the browser:</p>
                <CodeBlock
                  code={`// POST /api/apps/webhook-proxy\n// Proxies requests through the server to bypass CORS\n\n{\n  "webhookUrl": "https://your-n8n.com/webhook/your-webhook-id",\n  "method": "POST",   // optional, default GET\n  "payload": { ... }  // optional, forwarded body\n}`}
                  language="json"
                  title="Webhook Proxy API"
                />
              </StepCard>
            </section>

            {/* ═══ Server Monitoring Automation ═══ */}
            <section id="doc-server-monitor">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <Monitor className="w-6 h-6 text-emerald-600" />
                Home LAB Monitoring Automation
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Use n8n and the <b>Home LAB</b> workflow to monitor your Arcellite Home Lab: Docker containers, NAS storage, and more. This advanced automation leverages an AI agent to audit, report, and notify you of issues, with Discord/webhook integration for alerts.
              </p>

              <StepCard number={1} title="Download the Home LAB Workflow">
                <p className="mb-2">Download the full-featured n8n workflow JSON:</p>
                <div className="mb-3">
                  <a
                    href="/json/Home%20LAB.json"
                    download
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Home LAB Workflow
                  </a>
                </div>
                <p>Import this file into your n8n instance (Workflows → Import from File).</p>
              </StepCard>

              <StepCard number={2} title="How It Works">
                <ul className="list-disc ml-6 text-[13px] text-gray-700 space-y-1">
                  <li>Runs every 2 hours (or adjust the schedule in the <b>Schedule Trigger</b> node).</li>
                  <li>Uses an AI agent to check Docker containers and NAS health, following strict SRE rules.</li>
                  <li>Summarizes findings, takes corrective action if needed, and decides if a Discord/webhook alert is required.</li>
                  <li>Only sends notifications for critical issues, new failures, or when action is taken (see workflow logic for details).</li>
                </ul>
              </StepCard>

              <StepCard number={3} title="Configure & Customize">
                <ol className="list-decimal ml-6 text-[13px] text-gray-700 space-y-1">
                  <li>Open the <b>AI Agent</b> node to review and adjust the operational protocol, notification rules, and container/NAS list as needed.</li>
                  <li>Set your Discord webhook or other notification endpoint in the appropriate node (see workflow for details).</li>
                  <li>Optionally, expand the workflow to monitor additional services or send alerts to other platforms (Slack, Telegram, email, etc.).</li>
                </ol>
              </StepCard>

              <StepCard number={4} title="Notification Example">
                <div className="mt-3">
                  <CodeBlock
                    code={`// Example Discord message\n[GREEN] All services and NAS healthy\n[AMBER] Minor issue: watchtower exited\n[RED] Critical: plex container stopped, NAS > 95% full`}
                    language="text"
                    title="Discord/Webhook Notification"
                  />
                </div>
              </StepCard>
            </section>

            {/* ═══ Cloud Storage ═══ */}
            <section id="doc-cloud-storage">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <Cloud className="w-6 h-6 text-[#5D5FEF]" />
                Cloud Storage Sync
              </h2>
              <p className="text-sm text-gray-500 mb-6">Sync files between Arcellite and cloud storage providers using n8n workflows.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <img src="/assets/apps/google-drive.svg" alt="Google Drive" className="w-6 h-6" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <p className="text-sm font-black text-gray-900">Google Drive</p>
                  <p className="text-[11px] text-gray-400 mt-1">Two-way file sync</p>
                  <a
                    href="/json/Google%20Drive%20File%20Manager.json"
                    download
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-[#5D5FEF]/5 text-[#5D5FEF] rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#5D5FEF]/10 transition-all"
                  >
                    <Download className="w-3 h-3" /> Download Workflow
                  </a>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <img src="/assets/apps/microsoft-onedrive.svg" alt="OneDrive" className="w-6 h-6" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <p className="text-sm font-black text-gray-900">OneDrive</p>
                  <p className="text-[11px] text-gray-400 mt-1">Two-way file sync</p>
                  <a
                    href="/json/OneDrive%20File%20Manager.json"
                    download
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-[#5D5FEF]/5 text-[#5D5FEF] rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#5D5FEF]/10 transition-all"
                  >
                    <Download className="w-3 h-3" /> Download Workflow
                  </a>
                </div>
              </div>

              <StepCard number={1} title="Import the Workflow">
                <p>Download the Google Drive or OneDrive workflow JSON above and import it into n8n via <strong>Workflows → Import from File</strong>.</p>
              </StepCard>
              <StepCard number={2} title="Authenticate with Google/Microsoft">
                <p>In the imported n8n workflow, configure the OAuth2 credential for your Google or Microsoft account. Follow the n8n credential setup guide for each provider.</p>
              </StepCard>
              <StepCard number={3} title="Connect in My Apps">
                <p>Go to <strong>My Apps</strong> in Arcellite, connect the cloud storage integration, and enter your n8n webhook URLs. Files will sync automatically based on your workflow configuration.</p>
              </StepCard>
            </section>

            {/* ═══ Database Access ═══ */}
            <section id="doc-database">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <Database className="w-6 h-6 text-[#5D5FEF]" />
                Database Access
              </h2>
              <p className="text-sm text-gray-500 mb-6">Connect to your Arcellite databases remotely using tools like DataGrip, DBeaver, or pgAdmin.</p>

              <StepCard number={1} title="Remote PostgreSQL Connection">
                <p className="mb-2">The installer configures PostgreSQL for remote access. Connect from any SQL client:</p>
                <CodeBlock
                  code={`# Connection details (shown in Database → Info tab)\nHost:     YOUR-SERVER-IP\nPort:     5432\nDatabase: arcellite\nUser:     arcellite_user\nPassword: (from your .env file)\n\n# Or use a connection string:\npostgresql://arcellite_user:PASSWORD@YOUR-SERVER-IP:5432/arcellite`}
                  title="PostgreSQL Connection"
                />
              </StepCard>

              <StepCard number={2} title="Remote MySQL Connection">
                <p className="mb-2">For user-created MySQL databases:</p>
                <CodeBlock
                  code={`Host:     YOUR-SERVER-IP\nPort:     3306\nUser:     arcellite_user\nPassword: (from your .env file)`}
                  title="MySQL Connection"
                />
              </StepCard>

              <StepCard number={3} title="Firewall Configuration">
                <p className="mb-2">If you're connecting from outside your LAN, ensure the database port is open:</p>
                <CodeBlock
                  code={`# Open PostgreSQL port\nsudo ufw allow 5432/tcp\n\n# Open MySQL port (if needed)\nsudo ufw allow 3306/tcp`}
                  title="Firewall Rules"
                />
              </StepCard>
            </section>

            {/* ═══ Custom Domain ═══ */}
            <section id="doc-domain">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <Globe className="w-6 h-6 text-[#5D5FEF]" />
                Custom Domain
              </h2>
              <p className="text-sm text-gray-500 mb-6">Access Arcellite from a custom domain like cloud.yourdomain.com using Cloudflare Tunnel.</p>

              <StepCard number={1} title="Set Up Cloudflare Tunnel">
                <p className="mb-2">The easiest way — no port forwarding or static IP needed:</p>
                <CodeBlock
                  code={`# Install cloudflared (if not done during installation)\nsudo apt install cloudflared\n\n# Or configure from the Arcellite web UI:\n# Settings → Domain → Install Cloudflared`}
                  title="Install Cloudflared"
                />
              </StepCard>
              <StepCard number={2} title="Configure in Arcellite">
                <p>Go to <strong>Settings → Domain</strong> in the Arcellite web UI. Configure your Cloudflare account and run the tunnel. Your custom domain will be automatically provisioned.</p>
              </StepCard>
              <StepCard number={3} title="Alternative: Reverse Proxy">
                <p className="mb-2">Use Nginx or Caddy as a reverse proxy:</p>
                <CodeBlock
                  code={`# Caddy (automatic HTTPS)\ncloud.yourdomain.com {\n  reverse_proxy localhost:3000\n}\n\n# Nginx\nserver {\n  server_name cloud.yourdomain.com;\n  location / {\n    proxy_pass http://localhost:3000;\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header Upgrade $http_upgrade;\n    proxy_set_header Connection "upgrade";\n  }\n}`}
                  language="nginx"
                  title="Reverse Proxy Config"
                />
              </StepCard>
            </section>

            {/* ═══ AI Configuration ═══ */}
            <section id="doc-ai">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <Cpu className="w-6 h-6 text-[#5D5FEF]" />
                AI Configuration
              </h2>
              <p className="text-sm text-gray-500 mb-6">Configure AI models for the intelligent assistant. Arcellite supports multiple providers.</p>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Supported Providers</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { name: 'DeepSeek', icon: '/assets/models/deepseek-color.svg' },
                    { name: 'OpenAI (GPT-4)', icon: '/assets/models/openai.svg' },
                    { name: 'Anthropic (Claude)', icon: '/assets/models/anthropic.svg' },
                    { name: 'Google Gemini', icon: '/assets/models/gemini-color.svg' },
                    { name: 'Groq', icon: '/assets/models/grok.svg' },
                    { name: 'Meta (Llama)', icon: '/assets/models/meta-color.svg' },
                    { name: 'Qwen', icon: '/assets/models/qwen-color.svg' },
                    { name: 'Ollama (Local)', icon: '/assets/models/ollama.svg' },
                    { name: 'ElevenLabs (TTS)', icon: '/assets/models/elevenlabs.svg' },
                  ].map(p => (
                    <div key={p.name} className="bg-[#F5F5F7] rounded-xl px-3 py-3 flex items-center gap-2.5">
                      <img src={p.icon} alt={p.name} className="w-5 h-5 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <p className="text-xs font-bold text-gray-700">{p.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              <StepCard number={1} title="Add API Keys">
                <p>Go to <strong>Settings → AI Models</strong> in the Arcellite web UI. Select your preferred provider and paste your API key. No .env configuration needed — keys are managed through the UI.</p>
              </StepCard>
              <StepCard number={2} title="Select Active Model">
                <p>Choose which model to use as your default assistant. You can switch between providers at any time from the same settings page.</p>
              </StepCard>
            </section>

            {/* ═══ Security ═══ */}
            <section id="doc-security">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                <Shield className="w-6 h-6 text-[#5D5FEF]" />
                Security
              </h2>
              <p className="text-sm text-gray-500 mb-6">Arcellite includes built-in security features to protect your data.</p>

              <div className="space-y-4">
                {[
                  { title: 'Session-Based Authentication', desc: 'Secure Bearer token authentication with auto-expiring sessions. All API endpoints are protected.' },
                  { title: 'Two-Factor Authentication (2FA)', desc: 'Enable TOTP-based 2FA from Settings → Security for an additional layer of protection.' },
                  { title: 'IP Allowlisting', desc: 'Restrict access to specific IP addresses. Configure in Settings → Security → Strict Isolation.' },
                  { title: 'Traffic Masking', desc: 'Optional response header masking to disguise Arcellite traffic as standard web traffic.' },
                  { title: 'Ghost Folders', desc: 'Hide sensitive folders from the file browser. Only visible when vault lockdown is disabled.' },
                  { title: 'Secure File Uploads', desc: 'Path traversal protection, 10 GB file size limit, streaming to temp files (no RAM buffering).' },
                  { title: 'Rate Limiting', desc: 'Built-in rate limiting on authentication endpoints (10 requests per 60 seconds per IP).' },
                  { title: 'Family Isolation', desc: 'Family members have fully isolated storage directories. Each user only sees their own files.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-4 bg-white rounded-2xl border border-gray-100">
                    <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Footer */}
            <div className="pt-8 pb-12 border-t border-gray-100 text-center">
              <p className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">
                Arcellite Documentation · v1.0.0
              </p>
              <p className="text-[11px] text-gray-300 mt-1">
                Built by Robera Desissa · MIT License
              </p>
            </div>
          </div>
        </div>
    </div>
  );
};

export default DocumentationView;
