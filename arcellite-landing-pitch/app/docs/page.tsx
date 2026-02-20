"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  Github,
  Zap,
  Server,
  Download,
  FolderOpen,
  Bot,
  Database,
  Workflow,
  Cast,
  MessageSquare,
  Cloud,
  Globe,
  Shield,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
  HardDrive,
  Cpu,
  Monitor,
  Terminal,
  Search,
} from "lucide-react"

// ─── Sidebar sections ───────────────────────────────────────────────
const SECTIONS = [
  { id: "getting-started", label: "Getting Started", icon: Zap },
  { id: "requirements", label: "System Requirements", icon: Server },
  { id: "installation", label: "Installation Guide", icon: Download },
  { id: "file-management", label: "File Management", icon: FolderOpen },
  { id: "ai-assistant", label: "AI Assistant", icon: Bot },
  { id: "database", label: "Database Management", icon: Database },
  { id: "n8n", label: "n8n Automation", icon: Workflow },
  { id: "chromecast", label: "Chromecast Integration", icon: Cast },
  { id: "discord", label: "Discord Integration", icon: MessageSquare },
  { id: "cloud-storage", label: "Cloud Storage Sync", icon: Cloud },
  { id: "custom-domain", label: "Custom Domain", icon: Globe },
  { id: "security", label: "Security", icon: Shield },
]

// ─── Code block ─────────────────────────────────────────────────────
function CodeBlock({ code, title, language = "bash" }: { code: string; title?: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-950 my-4">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
          <span className="text-xs font-semibold text-gray-400">{title}</span>
          <span className="text-xs text-gray-600">{language}</span>
        </div>
      )}
      <div className="relative group">
        <pre className="p-4 overflow-x-auto text-sm leading-relaxed font-mono text-gray-300">
          <code>{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          aria-label="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-gray-400" />}
        </button>
      </div>
    </div>
  )
}

// ─── Section heading ─────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="mb-8 pb-6 border-b border-gray-100">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-[#5D5FEF]" />
        </div>
        <h2 className="font-heading font-bold text-2xl md:text-3xl text-[#1d1d1f]">{title}</h2>
      </div>
      {subtitle && <p className="text-gray-500 ml-12">{subtitle}</p>}
    </div>
  )
}

// ─── Step card ───────────────────────────────────────────────────────
function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-8">
      <div className="flex-shrink-0 h-8 w-8 rounded-xl bg-[#5D5FEF] text-white flex items-center justify-center font-bold text-sm">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-[#1d1d1f] text-base mb-2">{title}</h4>
        <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

// ─── Info box ────────────────────────────────────────────────────────
function InfoBox({ variant = "info", children }: { variant?: "info" | "warning" | "tip"; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-50 border-blue-100 text-blue-700",
    warning: "bg-amber-50 border-amber-100 text-amber-700",
    tip: "bg-[#5D5FEF]/5 border-[#5D5FEF]/15 text-[#5D5FEF]",
  }
  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed my-4 ${styles[variant]}`}>
      {children}
    </div>
  )
}

// ─── Main Docs Page ──────────────────────────────────────────────────
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started")
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const filteredSections = searchQuery
    ? SECTIONS.filter((s) => s.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : SECTIONS

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    setMobileMenuOpen(false)
    const el = document.getElementById(`doc-${id}`)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  useEffect(() => {
    const container = contentRef.current
    if (!container) return
    const handleScroll = () => {
      for (const section of SECTIONS) {
        const el = document.getElementById(`doc-${section.id}`)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 120 && rect.bottom > 120) {
            setActiveSection(section.id)
            break
          }
        }
      }
    }
    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="h-screen bg-white flex overflow-hidden">

      {/* ── Desktop sidebar (full height, always visible) ── */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 border-r border-gray-100 bg-[#f5f5f7] overflow-hidden">
        {/* Sidebar header with logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-gray-200 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-[#5D5FEF]" />
            <span className="flex items-baseline">
              <span className="text-lg font-bold tracking-tight text-[#1d1d1f]">Arcellite</span>
              <span className="text-[#5D5FEF] font-black text-2xl leading-none">.</span>
            </span>
          </Link>
          <span className="text-xs font-semibold text-[#5D5FEF] bg-[#5D5FEF]/10 rounded-full px-2 py-0.5">
            Docs
          </span>
        </div>
        {/* Search */}
        <div className="p-3 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search docs..."
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 placeholder:text-gray-400"
            />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {filteredSections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                activeSection === s.id
                  ? "bg-white text-[#5D5FEF] font-semibold shadow-sm border border-[#5D5FEF]/10"
                  : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
              }`}
            >
              <s.icon className="h-4 w-4 flex-shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 text-center flex-shrink-0">
          <span className="text-xs text-gray-400">Arcellite v1.0.0 · MIT</span>
        </div>
      </aside>

      {/* ── Right column: sticky header + scrollable content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Sticky header — only covers the content column */}
        <header className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-b border-gray-100 z-40">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#5D5FEF] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
              {/* Show logo on mobile (sidebar hidden) */}
              <div className="md:hidden flex items-center gap-2">
                <div className="h-4 w-px bg-gray-200" />
                <Link href="/" className="flex items-center gap-1.5">
                  <Cloud className="h-4 w-4 text-[#5D5FEF]" />
                  <span className="flex items-baseline">
                    <span className="text-sm font-bold tracking-tight text-[#1d1d1f]">Arcellite</span>
                    <span className="text-[#5D5FEF] font-black text-base leading-none">.</span>
                  </span>
                </Link>
              </div>
            </div>
            <Link
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">GitHub</span>
            </Link>
          </div>
        </header>

        {/* Mobile section picker */}
        <div className="md:hidden fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center gap-2 rounded-full bg-[#5D5FEF] text-white text-sm font-semibold px-4 py-3 shadow-xl shadow-[#5D5FEF]/30"
          >
            <Search className="h-4 w-4" />
            Sections
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {mobileMenuOpen && (
            <div className="absolute bottom-14 right-0 w-72 bg-white rounded-2xl border border-gray-100 shadow-2xl p-3 space-y-1 max-h-[60vh] overflow-y-auto">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                    activeSection === s.id
                      ? "bg-[#5D5FEF]/10 text-[#5D5FEF] font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <s.icon className="h-4 w-4 flex-shrink-0" />
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto scroll-smooth"
        >
          <div className="px-8 xl:px-16 py-10 space-y-20">

            {/* ─── Getting Started ─── */}
            <section id="doc-getting-started">
              <div className="relative rounded-3xl bg-[#0a0a14] overflow-hidden p-8 md:p-10 text-white mb-8">
                {/* Atmospheric purple glows */}
                <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#5D5FEF]/25 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-indigo-900/35 blur-3xl" />
                <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-56 w-96 rounded-full bg-[#5D5FEF]/10 blur-2xl" />
                {/* Content */}
                <div className="relative">
                  <h1 className="font-heading font-bold text-3xl md:text-4xl mb-3">
                    Welcome to Arcellite
                  </h1>
                  <p className="text-white/70 leading-relaxed text-lg mb-6">
                    Arcellite is a self-hosted personal cloud platform for file management, AI assistance,
                    database tools, and smart device integrations. This documentation covers every feature
                    from initial setup to advanced integrations.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold">
                      Version 1.0.0
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5D5FEF]/20 border border-[#5D5FEF]/30 px-3 py-1 text-xs font-semibold text-[#a5b4fc]">
                      MIT Licensed
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold">
                      By Robera Desissa
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 leading-relaxed text-base mb-6">
                Use the sidebar to navigate between sections. If you&apos;re new, start with
                <strong> System Requirements</strong> and the <strong>Installation Guide</strong>.
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: Download, title: "Installation", desc: "Set up Arcellite on your server", id: "installation" },
                  { icon: Bot, title: "AI Assistant", desc: "Configure AI models and providers", id: "ai-assistant" },
                  { icon: Workflow, title: "n8n Automation", desc: "Connect workflow automations", id: "n8n" },
                  { icon: Shield, title: "Security", desc: "Authentication and privacy features", id: "security" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="flex items-center gap-4 p-4 bg-[#f5f5f7] rounded-2xl border border-gray-100 hover:border-[#5D5FEF]/20 hover:bg-white hover:shadow-lg hover:shadow-gray-100 transition-all text-left group"
                  >
                    <div className="h-10 w-10 bg-[#5D5FEF]/10 rounded-xl flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-[#5D5FEF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1d1d1f] text-sm">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-gray-300 group-hover:text-[#5D5FEF] transition-colors" />
                  </button>
                ))}
              </div>
            </section>

            {/* ─── System Requirements ─── */}
            <section id="doc-requirements">
              <SectionTitle
                icon={Server}
                title="System Requirements"
                subtitle="Hardware and software specifications for running Arcellite."
              />

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl border border-gray-200 p-5">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-4">Minimum</p>
                  <div className="space-y-3">
                    {[
                      { icon: Cpu, label: "CPU", value: "4 cores (ARM64 or x86_64)" },
                      { icon: Monitor, label: "RAM", value: "4 GB" },
                      { icon: HardDrive, label: "Storage", value: "64 GB" },
                      { icon: Terminal, label: "OS", value: "Ubuntu 22.04+ / Debian 12+" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 flex items-center gap-1.5">
                          <row.icon className="h-3.5 w-3.5" /> {row.label}
                        </span>
                        <span className="text-xs font-semibold text-[#1d1d1f]">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-[#5D5FEF]/20 bg-[#5D5FEF]/3 p-5">
                  <p className="text-xs font-bold text-[#5D5FEF] uppercase tracking-widest mb-4">Recommended</p>
                  <div className="space-y-3">
                    {[
                      { icon: Cpu, label: "CPU", value: "4+ cores" },
                      { icon: Monitor, label: "RAM", value: "8+ GB" },
                      { icon: HardDrive, label: "Storage", value: "250+ GB SSD" },
                      { icon: Terminal, label: "OS", value: "Ubuntu 24.04 LTS" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 flex items-center gap-1.5">
                          <row.icon className="h-3.5 w-3.5" /> {row.label}
                        </span>
                        <span className="text-xs font-semibold text-[#5D5FEF]">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#f5f5f7] p-5 mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Software Prerequisites</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: "Node.js", version: "≥ 18", required: true },
                    { name: "PostgreSQL", version: "≥ 14", required: true },
                    { name: "MySQL/MariaDB", version: "Any", required: false },
                    { name: "PM2", version: "Latest", required: false },
                  ].map((s) => (
                    <div key={s.name} className="bg-white rounded-xl p-3 text-center border border-gray-100">
                      <p className="text-xs font-semibold text-[#1d1d1f]">{s.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.version}</p>
                      <p className={`text-[10px] font-bold uppercase mt-1 ${s.required ? "text-[#5D5FEF]" : "text-gray-300"}`}>
                        {s.required ? "Required" : "Optional"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <InfoBox variant="warning">
                <strong>Storage Note:</strong> 64 GB is the minimum. We strongly recommend 250 GB or more for a comfortable experience with file uploads, media storage, database backups, and future growth. NVMe/SSD storage provides significantly better performance for database operations and file serving.
              </InfoBox>

              <InfoBox variant="info">
                <strong>Supported Platforms:</strong> Ubuntu 22.04/24.04, Debian 12, Raspberry Pi OS (64-bit), and any Linux distribution with Node.js ≥ 18 and PostgreSQL ≥ 14. Both ARM64 and x86_64 architectures are supported.
              </InfoBox>
            </section>

            {/* ─── Installation ─── */}
            <section id="doc-installation">
              <SectionTitle
                icon={Download}
                title="Installation Guide"
                subtitle="Complete step-by-step guide to installing Arcellite on your server."
              />

              <Step number={1} title="Clone the Repository">
                <CodeBlock
                  code={`git clone https://github.com/ArcelliteProject/arcellite.git\ncd arcellite`}
                  title="Clone Repository"
                />
              </Step>

              <Step number={2} title="Run the Installer">
                <p className="mb-3">The automated installer handles everything — Node.js, PostgreSQL, MySQL, SQLite, data directories, environment configuration, and PM2 process management.</p>
                <CodeBlock
                  code={`chmod +x install.sh\n./install.sh`}
                  title="Run Installer"
                />
                <p className="mt-3 mb-2 font-medium">The installer runs 10 steps automatically:</p>
                <ol className="space-y-1.5 list-none">
                  {[
                    "System dependencies (curl, build tools)",
                    "Node.js ≥ 18 installation",
                    "PostgreSQL setup & database creation",
                    "MySQL/MariaDB setup",
                    "SQLite support (pure JS — no system packages)",
                    "Data directories (~/arcellite-data/)",
                    "Environment configuration (.env)",
                    "npm dependency installation",
                    "Frontend build & server compile",
                    "PM2 process manager & auto-start on reboot",
                  ].map((step, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <span className="h-5 w-5 rounded-lg bg-[#5D5FEF]/10 text-[#5D5FEF] font-bold text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </Step>

              <Step number={3} title="Access the Web UI">
                <p className="mb-3">Once installed, open your browser:</p>
                <CodeBlock
                  code={`# Local access\nhttp://localhost:3000\n\n# LAN access\nhttp://YOUR-SERVER-IP:3000`}
                  title="Access URL"
                />
                <p>Complete the setup wizard to create your admin account, then go to <strong>Settings → AI Models</strong> to add your API keys.</p>
              </Step>

              <Step number={4} title="Managing with PM2">
                <CodeBlock
                  code={`pm2 status                    # Check status\npm2 logs arcellite            # View logs\npm2 restart arcellite         # Restart\npm2 stop arcellite            # Stop\npm2 startup                   # Auto-start on reboot`}
                  title="PM2 Commands"
                />
              </Step>

              <Step number={5} title="Data Directory Structure">
                <CodeBlock
                  code={`~/arcellite-data/\n├── files/          # General files\n├── photos/         # Images & photos\n├── videos/         # Video files\n├── music/          # Music files\n├── shared/         # Shared files\n├── avatars/        # User profile pictures\n├── databases/      # User-created databases\n│   └── sqlite/     # SQLite files\n└── family/         # Isolated family member storage`}
                  language="text"
                  title="Directory Layout"
                />
              </Step>
            </section>

            {/* ─── File Management ─── */}
            <section id="doc-file-management">
              <SectionTitle
                icon={FolderOpen}
                title="File Management"
                subtitle="Upload, organize, and share files from any browser."
              />
              <ul className="space-y-3">
                {[
                  ["Upload files up to 10 GB", "Real-time progress bar with streaming I/O — no blocking the server"],
                  ["AI-powered auto-rename", "Let the AI assistant rename files by content, date, or custom rules"],
                  ["Preview everything", "Built-in PDF viewer, image gallery, video player, and audio player"],
                  ["Ghost folders", "Hidden directories invisible in file listings — for private content"],
                  ["PIN-locked directories", "Require a PIN to open specific folders"],
                  ["Family sharing", "Each family member gets isolated storage under your data directory"],
                  ["Favorites & tags", "Mark files as favorites and add custom tags for organization"],
                  ["Trash & restore", "Deleted files go to trash first; restore anytime within 30 days"],
                ].map(([title, desc]) => (
                  <li key={title} className="flex gap-3 p-4 rounded-2xl border border-gray-100 bg-[#f5f5f7]">
                    <div className="h-5 w-5 rounded-full bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#5D5FEF]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1d1d1f]">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* ─── AI Assistant ─── */}
            <section id="doc-ai-assistant">
              <SectionTitle
                icon={Bot}
                title="AI Assistant"
                subtitle="Chat with your own AI — 9 supported providers."
              />
              <p className="text-gray-600 mb-6">Add API keys via <strong>Settings → AI Models</strong>. You can switch between providers instantly.</p>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-8">
                {[
                  { name: "DeepSeek", src: "/assets/models/deepseek-color.svg" },
                  { name: "OpenAI", src: "/assets/models/openai.svg" },
                  { name: "Anthropic", src: "/assets/models/anthropic.svg" },
                  { name: "Gemini", src: "/assets/models/gemini-color.svg" },
                  { name: "Groq", src: "/assets/models/grok.svg" },
                  { name: "Ollama", src: "/assets/models/ollama.svg" },
                  { name: "Meta", src: "/assets/models/meta-color.svg" },
                  { name: "Qwen", src: "/assets/models/qwen-color.svg" },
                  { name: "ElevenLabs", src: "/assets/models/elevenlabs.svg" },
                ].map((model) => (
                  <div
                    key={model.name}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-gray-100 bg-[#f5f5f7] hover:bg-white hover:border-[#5D5FEF]/20 hover:shadow-sm transition-all"
                  >
                    <Image src={model.src} alt={model.name} width={28} height={28} className="h-7 w-7" />
                    <span className="text-xs font-medium text-gray-600">{model.name}</span>
                  </div>
                ))}
              </div>

              <ul className="space-y-3">
                {[
                  ["Full file access", "The AI can read, write, rename, move, and delete files in your cloud"],
                  ["Real-time streaming", "Responses stream token-by-token — no waiting for complete replies"],
                  ["Voice output", "ElevenLabs TTS integration converts AI responses to speech"],
                  ["Code execution context", "AI can reference your databases and data directory contents"],
                  ["Model switching", "Switch between providers mid-conversation; context is preserved"],
                ].map(([title, desc]) => (
                  <li key={title} className="flex gap-3 p-4 rounded-2xl border border-gray-100 bg-[#f5f5f7]">
                    <div className="h-5 w-5 rounded-full bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#5D5FEF]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1d1d1f]">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* ─── Database Management ─── */}
            <section id="doc-database">
              <SectionTitle
                icon={Database}
                title="Database Management"
                subtitle="Manage PostgreSQL, MySQL, and SQLite databases from your browser."
              />
              <p className="text-gray-600 mb-6">Arcellite supports three database engines out of the box. Access them via the Database tab in the sidebar.</p>
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                {[
                  { name: "PostgreSQL", port: "5432", icon: "/assets/apps/postgresql.svg", desc: "Primary database. Used by Arcellite itself. Access remotely with your credentials." },
                  { name: "MySQL / MariaDB", port: "3306", icon: "/assets/apps/mysql.svg", desc: "Secondary database. Run queries, manage tables, and export data via browser UI." },
                  { name: "SQLite", port: "Local", icon: null, desc: "Create and query SQLite databases locally. Pure JS — no system packages needed." },
                ].map((db) => (
                  <div key={db.name} className="rounded-2xl border border-gray-100 p-5 bg-[#f5f5f7]">
                    <div className="flex items-center gap-2 mb-3">
                      {db.icon && <Image src={db.icon} alt={db.name} width={20} height={20} className="h-5 w-5" />}
                      <span className="font-semibold text-sm text-[#1d1d1f]">{db.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3 leading-relaxed">{db.desc}</p>
                    <code className="text-xs font-mono text-[#5D5FEF] bg-white rounded-lg px-2 py-1 border border-[#5D5FEF]/10">
                      Port: {db.port}
                    </code>
                  </div>
                ))}
              </div>

              <p className="text-sm font-semibold text-[#1d1d1f] mb-3">Remote access firewall rules:</p>
              <CodeBlock
                code={`# Allow PostgreSQL remote access\nsudo ufw allow 5432/tcp\n\n# Allow MySQL remote access\nsudo ufw allow 3306/tcp`}
                title="UFW Firewall Rules"
              />
              <InfoBox variant="warning">
                Only open remote database ports if you need external access. For most setups, databases should only be accessible from your local network.
              </InfoBox>
            </section>

            {/* ─── n8n Automation ─── */}
            <section id="doc-n8n">
              <SectionTitle
                icon={Workflow}
                title="n8n Automation"
                subtitle="Connect Arcellite to hundreds of apps via n8n workflow automation."
              />
              <p className="text-gray-600 mb-6">
                Arcellite ships with 5 pre-built n8n workflow templates. Run n8n on the same server via Docker Compose for seamless integration.
              </p>

              <p className="text-sm font-semibold text-[#1d1d1f] mb-3">Docker Compose setup for n8n:</p>
              <CodeBlock
                code={`version: '3.8'\nservices:\n  n8n:\n    image: n8nio/n8n\n    restart: unless-stopped\n    ports:\n      - '5678:5678'\n    environment:\n      - N8N_HOST=localhost\n      - N8N_PROTOCOL=http\n      - WEBHOOK_URL=http://localhost:5678/\n    volumes:\n      - n8n_data:/home/node/.n8n\nvolumes:\n  n8n_data:`}
                title="docker-compose.yml"
                language="yaml"
              />

              <p className="text-sm font-semibold text-[#1d1d1f] mb-3 mt-6">Pre-built workflow templates — download &amp; import into n8n:</p>
              <div className="space-y-2">
                {[
                  {
                    label: "Chromecast Webhook — Cast from Website",
                    desc: "Cast any photo or video to Chromecast / Google TV via webhook",
                    file: "Chromecast Webhook - Cast from Website (Multi-Device).json",
                  },
                  {
                    label: "AI to Discord — Send Messages via Webhook",
                    desc: "Trigger Discord messages from Arcellite AI events",
                    file: "AI to Discord - Send Messages via Webhook.json",
                  },
                  {
                    label: "Google Drive File Manager",
                    desc: "Two-way sync and management of Google Drive files",
                    file: "Google Drive File Manager.json",
                  },
                  {
                    label: "OneDrive File Manager",
                    desc: "Sync and manage Microsoft OneDrive files from Arcellite",
                    file: "OneDrive File Manager.json",
                  },
                  {
                    label: "Home LAB Monitoring Agent",
                    desc: "Monitor your home lab infrastructure and get alerts",
                    file: "Home LAB.json",
                  },
                ].map((wf) => (
                  <a
                    key={wf.file}
                    href={`/json/${encodeURIComponent(wf.file)}`}
                    download={wf.file}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-[#f5f5f7] hover:border-[#5D5FEF]/30 hover:bg-white hover:shadow-sm transition-all group"
                  >
                    <div className="h-8 w-8 rounded-xl bg-[#5D5FEF]/10 group-hover:bg-[#5D5FEF]/15 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Workflow className="h-4 w-4 text-[#5D5FEF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1d1d1f] truncate">{wf.label}</p>
                      <p className="text-xs text-gray-400 truncate">{wf.desc}</p>
                    </div>
                    <div className="flex-shrink-0 text-xs font-semibold text-[#5D5FEF] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      Download
                    </div>
                  </a>
                ))}
              </div>
              <InfoBox variant="tip">
                In n8n: click <strong>+ New Workflow → Import from file</strong> and select the downloaded JSON. All webhooks auto-configure to your Arcellite server URL.
              </InfoBox>
            </section>

            {/* ─── Chromecast ─── */}
            <section id="doc-chromecast">
              <SectionTitle
                icon={Cast}
                title="Chromecast Integration"
                subtitle="Cast photos and videos directly to smart TVs via Chromecast."
              />
              <p className="text-gray-600 mb-6">
                Arcellite can cast media to any Chromecast or Google TV device on your network via an n8n → Home Assistant pipeline.
              </p>

              <div className="rounded-2xl border border-gray-100 bg-[#f5f5f7] p-5 mb-6">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Cast Flow</p>
                <div className="flex items-center gap-2 flex-wrap text-sm text-gray-600">
                  <span className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 font-medium">Arcellite</span>
                  <span className="text-gray-400">→</span>
                  <span className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 font-medium">n8n Webhook</span>
                  <span className="text-gray-400">→</span>
                  <span className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 font-medium">Home Assistant</span>
                  <span className="text-gray-400">→</span>
                  <span className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 font-medium">Chromecast</span>
                </div>
              </div>

              <p className="text-sm font-semibold text-[#1d1d1f] mb-2">Supported media types:</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {["JPG", "PNG", "GIF", "WebP", "MP4", "WebM", "MKV", "YouTube URLs"].map((type) => (
                  <span key={type} className="text-xs font-medium rounded-full bg-[#f5f5f7] border border-gray-200 px-3 py-1 text-gray-600">
                    {type}
                  </span>
                ))}
              </div>

              <InfoBox variant="tip">
                Download the Chromecast workflow from <strong>Settings → Integrations</strong> and import it into your n8n instance.
              </InfoBox>
            </section>

            {/* ─── Discord ─── */}
            <section id="doc-discord">
              <SectionTitle
                icon={MessageSquare}
                title="Discord Integration"
                subtitle="Send files and AI messages to Discord channels via n8n."
              />
              <p className="text-gray-600 mb-6">
                The Discord integration lets you send files from Arcellite directly to Discord channels. The AI assistant can also auto-select the appropriate channel based on content.
              </p>

              <p className="text-sm font-semibold text-[#1d1d1f] mb-3">Webhook endpoints (via n8n):</p>
              <CodeBlock
                code={`# List available channels\nGET /webhook/discord-channels\n\n# Send message/file to channel\nPOST /webhook/discord-send\n{\n  "channel": "general",\n  "message": "Hello from Arcellite!",\n  "fileUrl": "http://YOUR-SERVER:3000/..."\n}`}
                title="n8n Webhook API"
              />

              <InfoBox variant="tip">
                Import the <strong>AI to Discord</strong> workflow template from Settings → Integrations into n8n to enable AI-powered channel routing.
              </InfoBox>
            </section>

            {/* ─── Cloud Storage ─── */}
            <section id="doc-cloud-storage">
              <SectionTitle
                icon={Cloud}
                title="Cloud Storage Sync"
                subtitle="Two-way sync with Google Drive and Microsoft OneDrive."
              />
              <p className="text-gray-600 mb-6">
                Keep your Arcellite files in sync with cloud storage providers using pre-built n8n workflows.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { name: "Google Drive", icon: "/assets/apps/google-drive.svg", desc: "Two-way file sync between your Google Drive and Arcellite storage." },
                  { name: "Microsoft OneDrive", icon: "/assets/apps/microsoft-onedrive.svg", desc: "Two-way file sync between your OneDrive and Arcellite storage." },
                ].map((provider) => (
                  <div key={provider.name} className="rounded-2xl border border-gray-100 p-5 bg-[#f5f5f7]">
                    <div className="flex items-center gap-3 mb-3">
                      <Image src={provider.icon} alt={provider.name} width={24} height={24} className="h-6 w-6" />
                      <span className="font-semibold text-sm text-[#1d1d1f]">{provider.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{provider.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ─── Custom Domain ─── */}
            <section id="doc-custom-domain">
              <SectionTitle
                icon={Globe}
                title="Custom Domain"
                subtitle="Access Arcellite remotely via your own domain name."
              />
              <p className="text-gray-600 mb-6">Two options for remote access: Cloudflare Tunnel (no port forwarding needed) or a traditional nginx/Caddy reverse proxy.</p>

              <p className="text-sm font-semibold text-[#1d1d1f] mb-3">Option 1 — Cloudflare Tunnel (Recommended)</p>
              <CodeBlock
                code={`# Install cloudflared\ncurl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | \\\n  sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null\n\nsudo apt-get install -y cloudflared\n\n# Authenticate and create tunnel\ncloudflared tunnel login\ncloudflared tunnel create arcellite\ncloudflared tunnel route dns arcellite cloud.yourdomain.com\ncloudflared tunnel run arcellite`}
                title="Cloudflare Tunnel"
              />

              <p className="text-sm font-semibold text-[#1d1d1f] mb-3 mt-6">Option 2 — Nginx Reverse Proxy</p>
              <CodeBlock
                code={`server {\n    listen 80;\n    server_name cloud.yourdomain.com;\n\n    location / {\n        proxy_pass http://localhost:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_cache_bypass $http_upgrade;\n    }\n}`}
                title="nginx.conf"
                language="nginx"
              />
            </section>

            {/* ─── Security ─── */}
            <section id="doc-security">
              <SectionTitle
                icon={Shield}
                title="Security"
                subtitle="Eight layers of protection for your self-hosted cloud."
              />
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    title: "Session-Based Authentication",
                    desc: "256-bit cryptographically random Bearer tokens. Sessions expire automatically after 14 days. No JWT vulnerabilities.",
                  },
                  {
                    title: "Two-Factor Authentication (TOTP)",
                    desc: "TOTP-compatible 2FA works with Google Authenticator, Authy, and any RFC 6238 app.",
                  },
                  {
                    title: "IP Allowlisting",
                    desc: "Restrict logins to specific IP addresses or ranges. Unknown IPs receive a blank 404 response.",
                  },
                  {
                    title: "Traffic Masking",
                    desc: "Unauthorized requests return generic 404 responses to prevent fingerprinting and enumeration.",
                  },
                  {
                    title: "Ghost Folders",
                    desc: "Hidden directories that don't appear in file listings. Only the owner can see or access them.",
                  },
                  {
                    title: "Secure File Uploads",
                    desc: "Path traversal protection, MIME type validation, 10 GB size limit, and streaming I/O to prevent memory exhaustion.",
                  },
                  {
                    title: "Rate Limiting",
                    desc: "Per-IP rate limiting on all auth endpoints. Automatic lockout after repeated failures.",
                  },
                  {
                    title: "Family Isolation",
                    desc: "Each family member's storage is a completely isolated subdirectory. No cross-user file access is possible.",
                  },
                ].map((feature) => (
                  <div key={feature.title} className="rounded-2xl border border-gray-100 p-5 bg-[#f5f5f7]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded-lg bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="h-3.5 w-3.5 text-[#5D5FEF]" />
                      </div>
                      <h4 className="font-semibold text-sm text-[#1d1d1f]">{feature.title}</h4>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed ml-8">{feature.desc}</p>
                  </div>
                ))}
              </div>

              <InfoBox variant="tip">
                Arcellite is open source — you can audit every line of security-critical code on GitHub. We believe transparency is non-optional.
              </InfoBox>
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
