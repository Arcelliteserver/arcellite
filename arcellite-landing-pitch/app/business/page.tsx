"use client"

import { useRef, useState, useEffect } from "react"
import {
  ArrowRight, Check, Shield, Users, Database,
  BarChart3, Lock, Server, Headphones, Globe,
} from "lucide-react"
import Link from "next/link"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, visible }
}

// ─── Page data ────────────────────────────────────────────────────────
const pillars = [
  {
    icon: Lock,
    title: "Advanced Access Control",
    body: "Granular role-based permissions, centralized admin management, and controlled user provisioning — built for teams, not individuals.",
  },
  {
    icon: BarChart3,
    title: "Audit & Compliance",
    body: "Complete activity logs, file-level access history, and exportable audit reports. Full visibility across your entire organization.",
  },
  {
    icon: Server,
    title: "Multi-Server Clustering",
    body: "Horizontal scaling, high availability architecture, and automatic failover — ready for production workloads.",
  },
  {
    icon: Shield,
    title: "Backup & Recovery",
    body: "Automated encrypted backups, snapshot recovery, and one-click restore. Built-in disaster protection.",
  },
  {
    icon: Globe,
    title: "Identity & SSO",
    body: "SAML 2.0, LDAP, Active Directory, Azure AD, and Google Workspace integration. Secure authentication at scale.",
  },
  {
    icon: Headphones,
    title: "Priority Support",
    body: "Dedicated support channels, SLA-backed uptime, and direct assistance when you need it.",
  },
]

const audiences = [
  "Early-stage startups building internal infrastructure",
  "Agencies managing sensitive client data",
  "Developer teams running self-hosted stacks",
  "Organizations requiring full data sovereignty",
]

const comparisonGroups: { group: string; rows: [string, boolean, boolean][] }[] = [
  {
    group: "Core Platform",
    rows: [
      ["File management — upload, preview, share any file type", true, true],
      ["AI Assistant — 9 providers (DeepSeek, OpenAI, Claude, Gemini, Groq…)", true, true],
      ["Database access — PostgreSQL, MySQL, SQLite in the browser", true, true],
      ["n8n Automation — 5 pre-built workflows included", true, true],
      ["Custom domain support via Cloudflare Tunnel or nginx", true, true],
      ["Full security suite — 2FA, IP allowlist, ghost folders, rate limiting", true, true],
      ["Family sharing — isolated storage, up to 5 members", true, true],
      ["Cloud sync — Google Drive & OneDrive two-way", true, true],
      ["Discord & Chromecast integrations", true, true],
    ],
  },
  {
    group: "Business Only",
    rows: [
      ["Multi-server cluster & high-availability architecture", false, true],
      ["Advanced role-based access control (RBAC)", false, true],
      ["Audit logs & compliance reports with export", false, true],
      ["SSO / LDAP / Active Directory / Azure AD integration", false, true],
      ["Automated encrypted backups & one-click restore", false, true],
      ["White-label & custom branding", false, true],
      ["Deployment support & infrastructure consulting", false, true],
      ["SLA-backed uptime & priority support channel", false, true],
    ],
  },
]

// ─── Main Page ────────────────────────────────────────────────────────
export default function BusinessPage() {
  const { ref: heroRef, visible: heroVisible } = useInView(0.1)
  const { ref: pillarsRef, visible: pillarsVisible } = useInView(0.05)
  const { ref: audRef, visible: audVisible } = useInView(0.1)
  const { ref: stackRef, visible: stackVisible } = useInView(0.1)
  const { ref: tableRef, visible: tableVisible } = useInView(0.05)
  const { ref: ctaRef, visible: ctaVisible } = useInView(0.1)

  return (
    <>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative bg-white pt-36 pb-24 overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[700px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(93,95,239,0.07) 0%, transparent 70%)", filter: "blur(60px)" }} />

        <div className="relative mx-auto max-w-5xl px-6 text-center" ref={heroRef}>
          <div className={`transition-all duration-700 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#5D5FEF]/20 bg-[#5D5FEF]/8 px-4 py-1.5 mb-8">
              <span className="text-xs font-bold text-[#5D5FEF] uppercase tracking-widest">Arcellite for Business</span>
            </div>

            {/* Single-line headline — no forced break */}
            <h1 className="font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-[#1d1d1f] tracking-tight leading-[1.05] mb-6">
              Stop building your company
              <span style={{
                display: "inline",
                background: "linear-gradient(90deg, #5D5FEF 0%, #8B8DF8 50%, #5D5FEF 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "shimmer 3s linear infinite",
              }}>
                {" "}on rented infrastructure.
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-gray-500 leading-relaxed mb-10">
              Arcellite Business gives teams full control over their data and operations — advanced permissions, audit logs, clustering, and SSO — without SaaS lock-in or per-seat pricing.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/early-access"
                className="inline-flex items-center gap-2 rounded-full bg-[#5D5FEF] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors shadow-lg shadow-[#5D5FEF]/25"
              >
                Request Early Access
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-3.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                View Free Plan
              </a>
            </div>

            <p className="mt-6 text-xs text-gray-400">
              MIT Licensed · No telemetry · No per-seat fees
            </p>
          </div>
        </div>
      </section>

      {/* ── Positioning ──────────────────────────────────────────── */}
      <section className="bg-[#f5f5f7] py-20 border-t border-gray-100">
        <div className="mx-auto max-w-3xl px-6 text-center">
          {/* Refined: single line, no redundant break */}
          <h2 className="font-bold text-3xl md:text-4xl text-[#1d1d1f] tracking-tight mb-5">
            Private infrastructure for growing teams.
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-8">
            Arcellite Business is designed for startups and organizations that need control, reliability, and scalability — without handing their data to third-party platforms.
          </p>
          <div className="inline-grid grid-cols-1 sm:grid-cols-3 gap-px rounded-2xl border border-gray-200 overflow-hidden bg-gray-200 shadow-sm">
            {["You run it.", "You own it.", "You control it."].map((line) => (
              <div key={line} className="bg-white px-8 py-4">
                <p className="font-semibold text-[#1d1d1f] text-sm">{line}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-gray-400">Built on open standards. Deployable on any Linux server.</p>
        </div>
      </section>

      {/* ── What's Included ──────────────────────────────────────── */}
      <section className="bg-white py-24 md:py-32" ref={pillarsRef}>
        <div className="mx-auto max-w-7xl px-6">
          <div className={`text-center mb-16 transition-all duration-700 ${pillarsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">What&apos;s Included</p>
            {/* Refined subtitle */}
            <h2 className="font-bold text-3xl md:text-4xl lg:text-5xl text-[#1d1d1f] tracking-tight">
              Enterprise-grade infrastructure,{" "}
              <span className="text-gray-400 font-medium">designed for production use.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pillars.map((pillar, i) => (
              <div
                key={pillar.title}
                className={`rounded-2xl border border-gray-100 bg-[#f5f5f7] p-6 hover:border-[#5D5FEF]/20 hover:bg-white hover:shadow-xl hover:shadow-gray-100 transition-all duration-500 ${
                  pillarsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: pillarsVisible ? `${i * 60}ms` : "0ms" }}
              >
                <div className="h-10 w-10 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center mb-4">
                  <pillar.icon className="h-5 w-5 text-[#5D5FEF]" />
                </div>
                <h3 className="font-bold text-base text-[#1d1d1f] mb-2">{pillar.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built For ────────────────────────────────────────────── */}
      <section className="bg-[#f5f5f7] py-20 border-t border-gray-100" ref={audRef}>
        <div className="mx-auto max-w-3xl px-6">
          <div className={`text-center mb-10 transition-all duration-700 ${audVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">Built For</p>
            {/* Removed the duplicate subtitle — just direct copy now */}
            <h2 className="font-bold text-3xl md:text-4xl text-[#1d1d1f] tracking-tight mb-2">
              Teams that need infrastructure they fully control:
            </h2>
          </div>
          <div className={`grid sm:grid-cols-2 gap-4 transition-all duration-700 delay-100 ${audVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            {audiences.map((a) => (
              <div key={a} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5">
                <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-[#5D5FEF]/10 flex items-center justify-center">
                  <Check className="h-3 w-3 text-[#5D5FEF]" />
                </div>
                <p className="text-sm text-[#1d1d1f] font-medium leading-snug">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Consolidate Your Stack ──────────────────────────────── */}
      <section className="bg-white py-20 border-t border-gray-100" ref={stackRef}>
        <div className="mx-auto max-w-4xl px-6">
          <div className={`text-center mb-12 transition-all duration-700 ${stackVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">Consolidate Your Stack</p>
            <h2 className="font-bold text-3xl md:text-4xl text-[#1d1d1f] tracking-tight mb-4">
              One environment. Full control.
            </h2>
            <p className="text-gray-500 text-lg">
              Bring storage, automation, AI, and collaboration into one controlled, private infrastructure stack.
            </p>
          </div>
          <div className={`grid sm:grid-cols-3 gap-5 transition-all duration-700 delay-100 ${stackVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            {[
              {
                icon: Database,
                headline: "Reduce SaaS sprawl.",
                /* Tightened as requested */
                body: "Consolidate storage, automation, and collaboration into one self-hosted platform.",
              },
              {
                icon: Users,
                headline: "No per-seat pricing.",
                body: "One deployment. Unlimited users. Your costs don't grow as your team grows.",
              },
              {
                icon: Shield,
                headline: "Data stays in your network.",
                body: "Zero telemetry. Zero cloud sync. Every file and query stays on hardware you own.",
              },
            ].map((item) => (
              <div key={item.headline} className="rounded-2xl border border-gray-100 bg-[#f5f5f7] p-6">
                <div className="h-9 w-9 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center mb-4">
                  <item.icon className="h-4.5 w-4.5 text-[#5D5FEF]" />
                </div>
                <h3 className="font-bold text-sm text-[#1d1d1f] mb-2">{item.headline}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Free vs Business table ──────────────────────────────── */}
      <section className="bg-[#f5f5f7] py-24 border-t border-gray-100" ref={tableRef}>
        <div className="mx-auto max-w-6xl px-6">
          <div className={`text-center mb-12 transition-all duration-700 ${tableVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">Compare</p>
            <h2 className="font-bold text-4xl md:text-5xl text-[#1d1d1f] tracking-tight mb-3">
              Same platform. More control.
            </h2>
            <p className="text-gray-500 text-lg">Personal stays free forever. Business gives your team the power to scale.</p>
          </div>

          <div className={`rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-sm transition-all duration-700 delay-100 ${tableVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            {/* Column header cards */}
            <div className="grid grid-cols-[2.5fr_1fr_1fr] border-b border-gray-100">
              <div className="px-8 py-6 border-r border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Feature</p>
                <p className="text-sm text-gray-400">Compare what's included in each plan.</p>
              </div>
              {/* Personal header */}
              <div className="px-6 py-6 border-r border-gray-100 bg-[#f5f5f7] text-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Personal</p>
                <p className="text-3xl font-black text-[#1d1d1f]">$0</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Forever free · MIT</p>
              </div>
              {/* Business header */}
              <div className="px-6 py-6 bg-[#1d1d1f] text-center">
                <p className="text-[10px] font-bold text-[#8B8DF8] uppercase tracking-widest mb-2">Business</p>
                <p className="text-3xl font-black text-white">—</p>
                <p className="text-[10px] text-white/40 mt-0.5">Pricing at launch</p>
              </div>
            </div>

            {/* Grouped rows */}
            {comparisonGroups.map(({ group, rows }) => (
              <div key={group}>
                {/* Group header */}
                <div className="grid grid-cols-[2.5fr_1fr_1fr] border-b border-gray-100">
                  <div className="col-span-3 px-8 py-3 bg-[#f9f9f9] border-b border-gray-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group}</p>
                  </div>
                </div>
                {rows.map(([feature, free, biz], i) => (
                  <div
                    key={String(feature)}
                    className={`grid grid-cols-[2.5fr_1fr_1fr] border-b border-gray-50 last:border-0 group hover:bg-[#fafafa] transition-colors`}
                  >
                    <div className="px-8 py-4 text-sm text-gray-700 border-r border-gray-100 flex items-center">
                      {String(feature)}
                    </div>
                    <div className="px-6 py-4 flex items-center justify-center border-r border-gray-100 bg-[#fafafa] group-hover:bg-[#f5f5f5]">
                      {free
                        ? <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-gray-500" />
                          </div>
                        : <span className="text-gray-200 text-xl">—</span>
                      }
                    </div>
                    <div className="px-6 py-4 flex items-center justify-center bg-[#1d1d1f]/[0.02] group-hover:bg-[#1d1d1f]/[0.04]">
                      {biz
                        ? <div className="h-6 w-6 rounded-full bg-[#5D5FEF]/12 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-[#5D5FEF]" />
                          </div>
                        : <span className="text-gray-200 text-xl">—</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Footer CTA row */}
            <div className="grid grid-cols-[2.5fr_1fr_1fr] border-t border-gray-200">
              <div className="px-8 py-5 text-sm text-gray-400 flex items-center">MIT Licensed · No telemetry · No per-seat fees</div>
              <div className="px-6 py-5 border-r border-gray-100 bg-[#f5f5f7] flex items-center justify-center">
                <Link href="/#how-it-works" className="text-sm font-semibold text-[#5D5FEF] hover:underline">
                  Get Started Free →
                </Link>
              </div>
              <div className="px-6 py-5 bg-[#1d1d1f] flex items-center justify-center">
                <Link href="/early-access" className="text-sm font-semibold text-[#8B8DF8] hover:underline">
                  Request Access →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA — dark intentionally ────────────────────────────── */}
      <section className="relative bg-[#0f0f14] py-28 overflow-hidden" ref={ctaRef}>
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-80 w-[700px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(93,95,239,0.18) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-56 w-[600px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(93,95,239,0.22) 0%, transparent 70%)", filter: "blur(50px)" }} />

        <div className={`relative mx-auto max-w-2xl px-6 text-center transition-all duration-700 ${ctaVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="font-bold text-4xl md:text-5xl text-white tracking-tight mb-4">
            Your startup shouldn&apos;t depend
            <span style={{
              display: "inline",
              background: "linear-gradient(90deg, #5D5FEF 0%, #8B8DF8 50%, #5D5FEF 100%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "shimmer 3s linear infinite",
            }}>
              {" "}on someone else&apos;s servers.
            </span>
          </h2>
          <p className="text-white/45 text-lg mb-10">
            Own your infrastructure. Scale on your terms.
          </p>
          <Link
            href="/early-access"
            className="inline-flex items-center gap-2 rounded-full bg-[#5D5FEF] px-8 py-4 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors shadow-xl shadow-[#5D5FEF]/30"
          >
            Request Early Access
            <ArrowRight className="h-4 w-4" />
          </Link>
          {/* Refined final line — calmer, more mature */}
          <p className="mt-6 text-xs text-white/20">
            MIT Licensed · No per-seat fees · Built for teams that need full control over their infrastructure.
          </p>
        </div>
      </section>

      <Footer />
    </>
  )
}
