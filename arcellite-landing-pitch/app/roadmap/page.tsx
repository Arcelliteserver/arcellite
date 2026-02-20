"use client"

import Link from "next/link"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import {
  CheckCircle2,
  Circle,
  Clock,
  Zap,
  Building2,
  Shield,
  Workflow,
  Smartphone,
  Globe,
  Users,
  Bot,
  Database,
  HardDrive,
  BarChart3,
  ArrowRight,
  Plug,
  Server,
} from "lucide-react"

// ─── Roadmap phases ──────────────────────────────────────────────────
const phases = [
  {
    phase: "v1.0 — Foundation",
    status: "done",
    quarter: "Q4 2025",
    summary: "Core platform launch — everything you need to run your own cloud.",
    items: [
      { icon: HardDrive, label: "Core file management — upload, preview, share, trash & restore" },
      { icon: Bot, label: "AI Assistant — 9 providers (DeepSeek, OpenAI, Claude, Gemini, Groq, Ollama, Llama, Qwen, ElevenLabs)" },
      { icon: Database, label: "Database browser — PostgreSQL, MySQL, SQLite in the browser" },
      { icon: Workflow, label: "n8n automation — 5 pre-built workflow templates (Google Drive, OneDrive, Discord, Chromecast, Home Lab)" },
      { icon: Shield, label: "Security suite — 2FA, IP allowlist, traffic masking, ghost folders, rate limiting" },
      { icon: Users, label: "Family sharing — isolated storage per member (up to 5)" },
      { icon: Globe, label: "Custom domain — Cloudflare Tunnel & nginx reverse proxy support" },
      { icon: Plug, label: "Cloud sync — Google Drive & OneDrive two-way file sync" },
    ],
  },
  {
    phase: "v1.1 — Refinement",
    status: "active",
    quarter: "Q1 2026 · In Progress",
    summary: "UX polish, more workflows, mobile improvements, and expanded AI capabilities.",
    items: [
      { icon: Smartphone, label: "Mobile-first UI — swipe gestures, bottom nav, pull-to-refresh" },
      { icon: Workflow, label: "10+ additional n8n workflow templates (Slack, Telegram, webhooks, cron jobs)" },
      { icon: Bot, label: "AI batch operations — bulk rename, auto-categorize, smart tagging" },
      { icon: BarChart3, label: "Storage analytics dashboard — usage over time, file type breakdown" },
      { icon: Shield, label: "Audit log viewer — browse and filter security events in the browser" },
      { icon: Globe, label: "Multi-language UI — English, German, French, Spanish (community-driven)" },
      { icon: Database, label: "Database export / import — CSV, SQL dump via browser UI" },
    ],
  },
  {
    phase: "v1.2 — Business Tier",
    status: "planned",
    quarter: "Q2 2026",
    summary: "Team features, SSO, multi-server clustering, and the Business plan launch.",
    items: [
      { icon: Building2, label: "Business plan launch — multi-server cluster with automatic failover" },
      { icon: Users, label: "Advanced RBAC — granular role-based access control per folder and resource" },
      { icon: Shield, label: "Compliance reports — audit export (JSON/CSV), file-level access history" },
      { icon: Globe, label: "SSO / LDAP / Azure AD / Google Workspace integration" },
      { icon: Server, label: "Automated encrypted backups with one-click restore" },
      { icon: Building2, label: "White-label & custom branding — own logo, colors, and domain" },
      { icon: Users, label: "Deployment support & dedicated infrastructure consulting" },
    ],
  },
  {
    phase: "v2.0 — Platform",
    status: "future",
    quarter: "Q3–Q4 2026",
    summary: "Arcellite evolves into a full self-hosted operations platform for teams and startups.",
    items: [
      { icon: Bot, label: "On-device AI fine-tuning — train models on your own hardware" },
      { icon: Workflow, label: "Visual workflow builder — drag-and-drop automation, no code" },
      { icon: Smartphone, label: "Native iOS & Android companion apps" },
      { icon: Globe, label: "Federated file sharing — encrypted P2P sharing between Arcellite instances" },
      { icon: BarChart3, label: "Home lab & infrastructure monitoring agent (CPU, memory, disk, uptime)" },
      { icon: Building2, label: "Marketplace — community-built n8n workflows, AI prompts, plugins" },
      { icon: Server, label: "Container orchestration — run Docker apps directly from the Arcellite UI" },
    ],
  },
]

// ─── Free version use cases ──────────────────────────────────────────
const useCases = [
  {
    icon: Building2,
    title: "Run your startup's infrastructure",
    desc: "Replace Dropbox, Notion AI, and Airtable with a single self-hosted platform. File storage, AI assistant, and database access — all on hardware you own, with zero monthly SaaS fees.",
    tags: ["File Storage", "AI Assistant", "Database"],
  },
  {
    icon: Workflow,
    title: "Automate your business with n8n",
    desc: "Ship pre-built n8n workflows for client onboarding, invoice processing, Slack notifications, and Google Drive sync. Five templates included — import and run in minutes.",
    tags: ["n8n Automation", "5 Workflows", "Google Drive", "Discord"],
  },
  {
    icon: Bot,
    title: "Your own private AI workspace",
    desc: "Chat with DeepSeek, OpenAI, or run Ollama locally — no data sent to third-party clouds. Ask the AI to rename files, summarize PDFs, or manage your database. Your prompts stay yours.",
    tags: ["DeepSeek", "OpenAI", "Ollama", "Groq"],
  },
  {
    icon: BarChart3,
    title: "Monitor your home lab",
    desc: "Deploy the Home LAB monitoring n8n workflow to track CPU, memory, disk, and uptime across all your servers. Get alerts via Discord, Slack, or email — all automated.",
    tags: ["Home Lab", "Monitoring", "Alerts", "n8n"],
  },
  {
    icon: Shield,
    title: "Privacy-first team storage",
    desc: "Share storage with up to 5 family or team members — each with their own isolated directory. Ghost folders, IP allowlisting, and 2FA keep sensitive data away from prying eyes.",
    tags: ["Family Sharing", "2FA", "IP Allowlist"],
  },
  {
    icon: Globe,
    title: "Custom domain on your own server",
    desc: "Set up a Cloudflare Tunnel and point your own domain to Arcellite in minutes. Access your cloud from anywhere — no VPN required, no port forwarding.",
    tags: ["Custom Domain", "Cloudflare", "Remote Access"],
  },
]

const statusStyles = {
  done: {
    badge: "bg-green-50 border-green-100 text-green-700",
    icon: CheckCircle2,
    iconClass: "text-green-500",
    itemIcon: "bg-green-50 text-green-500",
    ringColor: "ring-green-200",
  },
  active: {
    badge: "bg-[#5D5FEF]/8 border-[#5D5FEF]/20 text-[#5D5FEF]",
    icon: Clock,
    iconClass: "text-[#5D5FEF]",
    itemIcon: "bg-[#5D5FEF]/10 text-[#5D5FEF]",
    ringColor: "ring-[#5D5FEF]/30",
  },
  planned: {
    badge: "bg-amber-50 border-amber-100 text-amber-700",
    icon: Circle,
    iconClass: "text-amber-400",
    itemIcon: "bg-amber-50 text-amber-500",
    ringColor: "ring-amber-200",
  },
  future: {
    badge: "bg-gray-50 border-gray-100 text-gray-500",
    icon: Circle,
    iconClass: "text-gray-300",
    itemIcon: "bg-gray-50 text-gray-400",
    ringColor: "ring-gray-100",
  },
} as const

export default function RoadmapPage() {
  return (
    <div className="bg-white min-h-screen">
      <Navbar />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <section className="pt-36 pb-16 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">Public Roadmap</p>
            <h1 className="font-heading font-bold text-5xl md:text-6xl lg:text-7xl text-[#1d1d1f] tracking-tight leading-tight mb-5">
              Where Arcellite
              <br />
              is heading.
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-xl">
              We build in the open. The personal tier is always free and MIT licensed.
              Business features are rolling out through 2026.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/early-access"
                className="inline-flex items-center gap-2 rounded-full bg-[#5D5FEF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors shadow-lg shadow-[#5D5FEF]/25"
              >
                Request Early Access
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you can do TODAY ────────────────────────────────── */}
      <section className="bg-[#f5f5f7] py-20 border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-100 px-3 py-1.5 mb-4">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-green-700 uppercase tracking-widest">Free Version — Available Now</span>
            </div>
            <h2 className="font-heading font-bold text-4xl md:text-5xl text-[#1d1d1f] tracking-tight mb-3">
              What you can build today.
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl">
              The free personal version isn&apos;t a demo — it&apos;s a full platform. Here&apos;s what people are using it for right now.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {useCases.map((uc) => {
              const Icon = uc.icon
              return (
                <div key={uc.title} className="bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-xl hover:shadow-gray-100 hover:-translate-y-1 hover:border-[#5D5FEF]/20 transition-all duration-300">
                  <div className="h-10 w-10 rounded-2xl bg-[#5D5FEF]/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-[#5D5FEF]" />
                  </div>
                  <h3 className="font-bold text-base text-[#1d1d1f] mb-2">{uc.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{uc.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {uc.tags.map((tag) => (
                      <span key={tag} className="text-[10px] font-semibold rounded-full bg-[#5D5FEF]/8 border border-[#5D5FEF]/15 text-[#5D5FEF] px-2.5 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <h2 className="font-heading font-bold text-4xl md:text-5xl text-[#1d1d1f] tracking-tight mb-3">
              Release timeline.
            </h2>
            <p className="text-lg text-gray-500">
              Started in 2025 · Current year: 2026 · Building in public.
            </p>
          </div>

          {/* 2-column grid: timeline on left, sticky summary on right */}
          <div className="grid lg:grid-cols-[1fr_320px] gap-10 items-start">
            {/* Left: timeline cards */}
            <div className="relative">
              {/* Vertical connector */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-100 hidden md:block" />

              <div className="space-y-8">
                {phases.map((phase) => {
                  const s = statusStyles[phase.status as keyof typeof statusStyles]
                  const StatusIcon = s.icon
                  return (
                    <div key={phase.phase} className="relative md:pl-16">
                      {/* Timeline dot */}
                      <div className={`hidden md:flex absolute left-0 top-6 h-10 w-10 rounded-full bg-white border-2 border-white shadow-sm ring-2 ${s.ringColor} items-center justify-center`}>
                        <StatusIcon className={`h-5 w-5 ${s.iconClass}`} />
                      </div>

                      {/* Card */}
                      <div className={`rounded-3xl border p-6 md:p-8 ${
                        phase.status === "active"
                          ? "border-[#5D5FEF]/20 bg-[#5D5FEF]/3 shadow-lg shadow-[#5D5FEF]/5"
                          : "border-gray-100 bg-white"
                      }`}>
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                          <div>
                            <h3 className="font-heading font-bold text-xl text-[#1d1d1f]">{phase.phase}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{phase.summary}</p>
                          </div>
                          <span className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${s.badge}`}>
                            {phase.quarter}
                          </span>
                        </div>

                        <div className="mt-5 grid sm:grid-cols-2 gap-2">
                          {phase.items.map((item) => {
                            const ItemIcon = item.icon
                            return (
                              <div key={item.label} className="flex items-start gap-2.5">
                                <div className={`mt-0.5 h-5 w-5 rounded-lg flex items-center justify-center flex-shrink-0 ${s.itemIcon}`}>
                                  <ItemIcon className="h-3 w-3" />
                                </div>
                                <span className={`text-sm leading-relaxed ${
                                  phase.status === "done" || phase.status === "active"
                                    ? "text-gray-700"
                                    : "text-gray-400"
                                }`}>{item.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: sticky summary sidebar */}
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="rounded-3xl bg-[#f5f5f7] border border-gray-100 p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Legend</p>
                <div className="space-y-3">
                  {[
                    { label: "Shipped", color: "bg-green-500", text: "text-green-700 bg-green-50 border-green-100" },
                    { label: "In Progress", color: "bg-[#5D5FEF] animate-pulse", text: "text-[#5D5FEF] bg-[#5D5FEF]/8 border-[#5D5FEF]/20" },
                    { label: "Planned", color: "bg-amber-400", text: "text-amber-700 bg-amber-50 border-amber-100" },
                    { label: "Future", color: "bg-gray-300", text: "text-gray-500 bg-gray-50 border-gray-100" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                      <span className={`text-xs font-semibold rounded-full border px-2.5 py-0.5 ${item.text}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-[#1d1d1f] p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-[#8B8DF8]" />
                  <p className="text-sm font-bold">Free forever</p>
                </div>
                <p className="text-sm text-white/60 leading-relaxed mb-4">
                  The personal tier never has a paid upgrade. MIT licensed, self-hosted, no telemetry.
                </p>
                <Link
                  href="/docs"
                  className="flex items-center justify-center gap-2 w-full rounded-2xl bg-white/10 border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
                >
                  Install Guide
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-3xl border border-[#5D5FEF]/20 bg-[#5D5FEF]/5 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-[#5D5FEF]" />
                  <p className="text-sm font-bold text-[#1d1d1f]">Business plan</p>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Multi-server clustering, SSO, audit logs, and SLA support — launching Q2 2026.
                </p>
                <Link
                  href="/early-access"
                  className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[#5D5FEF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors shadow-lg shadow-[#5D5FEF]/25"
                >
                  Request Early Access
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-3xl bg-[#f5f5f7] border border-gray-100 p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Feature request?</p>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Open an issue on GitHub or join the early access program to discuss your use case.
                </p>
                <a
                  href="https://github.com/ArcelliteProject/arcellite/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Open GitHub Issue
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
