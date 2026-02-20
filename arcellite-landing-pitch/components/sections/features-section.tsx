"use client"

import { useRef, useState, useEffect } from "react"
import {
  FolderOpen, Sparkles, Plug, ShieldCheck, Check, Cloud,
  Lock, Shield, CheckCircle2, Wifi, Key, MessageSquare,
  Fingerprint, Users,
} from "lucide-react"
import Image from "next/image"

// ─── Animated visual mockups ─────────────────────────────────────────

function FileVisual() {
  const folders = [
    { name: "Books", items: 12, color: "#5D5FEF" },
    { name: "Code", items: 48, color: "#4338ca" },
    { name: "Photos", items: 234, color: "#6366f1" },
    { name: "Files", items: 67, color: "#7c3aed" },
  ]

  return (
    <div className="rounded-3xl bg-[#f5f5f7] border border-gray-100 shadow-sm p-5">
      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-[0.18em] mb-4">Collections</p>
      <div className="grid grid-cols-2 gap-4">
        {folders.map(({ name, items, color }) => (
          <div key={name} className="relative pt-4 cursor-pointer hover:scale-[1.02] transition-transform duration-200">
            {/* Folder tab — wide and prominent */}
            <div
              className="absolute top-0 left-3 h-4 w-16 rounded-t-xl"
              style={{ background: color }}
            />
            {/* Folder body */}
            <div
              className="relative rounded-2xl rounded-tl-none p-4 h-[138px] flex flex-col justify-between overflow-hidden shadow-lg"
              style={{ background: color }}
            >
              {/* Subtle shine */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none rounded-2xl" />
              <div className="flex items-start justify-between">
                <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-white" />
                </div>
                <span className="text-4xl font-black text-white/12 leading-none">{items}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">{name}</p>
                <p className="text-[8px] font-semibold text-white/50 uppercase tracking-wider mt-1">{items} items</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AIVisual() {
  const messages = [
    { role: "user", text: "Rename all photos from last week by date" },
    { role: "ai", text: "Sure! I found 47 photos. Renaming them to YYYY-MM-DD format…" },
    { role: "ai", text: "✓ Done — 47 files renamed successfully." },
    { role: "user", text: "Now summarize the PDF in /Documents" },
  ]
  const [shown, setShown] = useState(1)
  useEffect(() => {
    if (shown >= messages.length) return
    const t = setTimeout(() => setShown((s) => s + 1), 1000)
    return () => clearTimeout(t)
  }, [shown, messages.length])

  const models = [
    { src: "/assets/models/openai.svg", alt: "OpenAI" },
    { src: "/assets/models/anthropic.svg", alt: "Anthropic" },
    { src: "/assets/models/gemini-color.svg", alt: "Gemini" },
    { src: "/assets/models/ollama.svg", alt: "Ollama" },
    { src: "/assets/models/deepseek-color.svg", alt: "DeepSeek" },
  ]

  return (
    <div className="rounded-3xl bg-[#0f0f14] border border-white/8 shadow-xl shadow-[#5D5FEF]/10 p-5 overflow-hidden">
      {/* Model selector */}
      <div className="flex items-center gap-2 mb-4 overflow-hidden">
        <span className="text-[10px] font-semibold text-white/40 flex-shrink-0">Provider</span>
        <div className="flex gap-1.5">
          {models.map((m) => (
            <div key={m.alt} className="h-6 w-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
              <Image src={m.src} alt={m.alt} width={14} height={14} className="h-3.5 w-3.5" />
            </div>
          ))}
        </div>
      </div>
      {/* Chat */}
      <div className="space-y-2.5 min-h-[200px]">
        {messages.slice(0, shown).map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#5D5FEF] text-white rounded-br-sm"
                  : "bg-white/10 border border-white/10 text-white/80 rounded-bl-sm"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {shown < messages.length && (
          <div className="flex justify-start">
            <div className="bg-white/10 border border-white/10 rounded-2xl rounded-bl-sm px-3 py-2">
              <div className="flex gap-1 items-center h-3">
                <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function IntegrationsVisual() {
  const [pulseIdx, setPulseIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setPulseIdx((i) => (i + 1) % 6), 1400)
    return () => clearInterval(id)
  }, [])

  const services = [
    { src: "/assets/apps/google-drive.svg", name: "Google Drive", status: "Synced" },
    { src: "/assets/apps/n8n.svg", name: "n8n", status: "5 active" },
    { src: "/assets/apps/discord.svg", name: "Discord", status: "Online" },
    { src: "/assets/apps/microsoft-onedrive.svg", name: "OneDrive", status: "Syncing…" },
    { src: "/assets/apps/postgresql.svg", name: "PostgreSQL", status: "Connected" },
    { src: "/assets/apps/mysql.svg", name: "MySQL", status: "Connected" },
  ]

  const aiModels = [
    { src: "/assets/models/openai.svg", name: "OpenAI" },
    { src: "/assets/models/anthropic.svg", name: "Anthropic" },
    { src: "/assets/models/gemini-color.svg", name: "Gemini" },
    { src: "/assets/models/deepseek-color.svg", name: "DeepSeek" },
  ]

  return (
    <div className="rounded-3xl bg-[#f5f5f7] border border-gray-100 shadow-sm p-5">
      {/* Services grid */}
      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-[0.18em] mb-3">Connected Services</p>
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {services.map((svc, i) => (
          <div
            key={svc.name}
            className={`flex items-center gap-2.5 bg-white rounded-2xl border px-3 py-2.5 shadow-xs transition-all duration-500 ${
              pulseIdx === i
                ? "border-[#5D5FEF]/30 shadow-md shadow-[#5D5FEF]/8 scale-[1.02]"
                : "border-gray-100"
            }`}
          >
            <img src={svc.src} alt={svc.name} className="h-5 w-5 flex-shrink-0 object-contain" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-[#1d1d1f] truncate">{svc.name}</p>
              <p className="text-[9px] text-gray-400 font-medium">{svc.status}</p>
            </div>
            <div className={`h-2 w-2 rounded-full flex-shrink-0 transition-all duration-300 ${
              svc.status === "Syncing…"
                ? "bg-amber-400 animate-pulse"
                : pulseIdx === i
                ? "bg-[#5D5FEF]"
                : "bg-green-400"
            }`} />
          </div>
        ))}
      </div>

      {/* AI models row */}
      <div className="border-t border-gray-200 pt-3">
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-[0.18em] mb-2.5">AI Providers</p>
        <div className="flex items-center gap-2">
          {aiModels.map((m) => (
            <div key={m.name} className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 px-2.5 py-1.5">
              <img src={m.src} alt={m.name} className="h-3.5 w-3.5 object-contain" />
              <span className="text-[9px] font-semibold text-gray-500">{m.name}</span>
            </div>
          ))}
          <span className="text-[9px] font-medium text-gray-400">+5 more</span>
        </div>
      </div>
    </div>
  )
}

function SecurityVisual() {
  const events = [
    { time: "just now", ip: "203.x.x.x", action: "Brute-force detected", tag: "BLOCKED", danger: true },
    { time: "4s ago",   ip: "94.x.x.x",  action: "IP not in allowlist",  tag: "BLOCKED", danger: true },
    { time: "18s ago",  ip: "127.0.0.1", action: "2FA code verified",    tag: "PASS",    danger: false },
    { time: "1m ago",   ip: "127.0.0.1", action: "Session token issued",  tag: "PASS",    danger: false },
    { time: "3m ago",   ip: "185.x.x.x", action: "Rate limit exceeded",   tag: "BLOCKED", danger: true },
  ]
  const [shown, setShown] = useState(1)
  useEffect(() => {
    if (shown >= events.length) return
    const t = setTimeout(() => setShown((s) => s + 1), 750)
    return () => clearTimeout(t)
  }, [shown, events.length])

  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-[#f5f5f7]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#5D5FEF]" />
          <span className="text-sm font-bold text-[#1d1d1f]">Security Log</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2.5 py-1">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold text-green-600">Live</span>
        </div>
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-[60px_80px_1fr_56px] px-5 py-2 border-b border-gray-50 bg-[#fafafa]">
        {["Time", "IP", "Event", "Status"].map((col) => (
          <span key={col} className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{col}</span>
        ))}
      </div>

      {/* Events */}
      <div className="divide-y divide-gray-50">
        {events.slice(0, shown).map((ev, i) => (
          <div
            key={i}
            className={`grid grid-cols-[60px_80px_1fr_56px] items-center px-5 py-3 transition-all duration-500 ${
              i === 0 ? "animate-fade-in-up" : ""
            } ${ev.danger ? "bg-red-50/30" : ""}`}
          >
            <span className="text-[10px] font-mono text-gray-400">{ev.time}</span>
            <span className="text-[10px] font-mono text-gray-400">{ev.ip}</span>
            <span className="text-[11px] font-medium text-gray-700 truncate pr-2">{ev.action}</span>
            <span className={`text-[9px] font-bold rounded-full px-2 py-0.5 text-center ${
              ev.danger
                ? "bg-red-100 text-red-600 border border-red-200"
                : "bg-green-100 text-green-600 border border-green-200"
            }`}>
              {ev.tag}
            </span>
          </div>
        ))}
        {shown < events.length && (
          <div className="flex items-center gap-2 px-5 py-3">
            <div className="flex gap-0.5">
              {[0, 1, 2].map((d) => (
                <div key={d} className="h-1 w-1 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />
              ))}
            </div>
            <span className="text-[10px] text-gray-300 font-medium">Monitoring…</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Reflective ID card ───────────────────────────────────────────────

function IDCard({
  name,
  role,
  id,
  accent = "#5D5FEF",
  rotate = 0,
  zIndex = 1,
  translateX = 0,
  translateY = 0,
}: {
  name: string
  role: string
  id: string
  accent?: string
  rotate?: number
  zIndex?: number
  translateX?: number
  translateY?: number
}) {
  return (
    <div
      style={{
        position: "absolute",
        width: "230px",
        height: "340px",
        borderRadius: "20px",
        overflow: "hidden",
        background: `linear-gradient(160deg, #0e0e20 0%, #13133a 45%, #0b0b1a 100%)`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07) inset, 0 0 40px ${accent}22`,
        transform: `rotate(${rotate}deg) translateX(${translateX}px) translateY(${translateY}px)`,
        zIndex,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Accent radial glow in top-left */}
      <div
        style={{
          position: "absolute",
          top: "-40px",
          left: "-40px",
          width: "180px",
          height: "180px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}45 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Secondary glow bottom-right */}
      <div
        style={{
          position: "absolute",
          bottom: "-30px",
          right: "-30px",
          width: "140px",
          height: "140px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}25 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Diagonal highlight sheen */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 35%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.04) 75%, rgba(255,255,255,0.07) 100%)",
          pointerEvents: "none",
        }}
      />
      {/* Gradient border */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "20px",
          padding: "1px",
          background: `linear-gradient(135deg, rgba(255,255,255,0.35) 0%, ${accent}55 50%, rgba(255,255,255,0.22) 100%)`,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor" as const,
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude" as const,
          pointerEvents: "none",
          zIndex: 20,
        }}
      />

      {/* Card content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "22px",
          color: "white",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "8px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              padding: "4px 9px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.13)",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            <Lock size={8} />
            <span>SECURE ACCESS</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Cloud size={13} style={{ color: accent, opacity: 0.9 }} />
            <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,255,255,0.6)" }}>
              ARCELLITE
            </span>
          </div>
        </div>

        {/* Body — avatar + name */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          {/* Avatar */}
          <div
            style={{
              width: "68px",
              height: "68px",
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${accent} 0%, ${accent}88 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 800,
              color: "white",
              boxShadow: `0 6px 24px ${accent}60`,
              border: "2px solid rgba(255,255,255,0.2)",
              letterSpacing: "0",
            }}
          >
            {name.charAt(0)}
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "0.05em", margin: 0, color: "white" }}>
              {name.toUpperCase()}
            </p>
            <p style={{ fontSize: "9px", letterSpacing: "0.2em", color: `${accent}cc`, margin: "5px 0 0 0", fontWeight: 600 }}>
              {role.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "0 0" }} />

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ fontSize: "7px", letterSpacing: "0.16em", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
              ACCESS ID
            </span>
            <span
              style={{
                fontFamily: "'Geist Mono', 'Courier New', monospace",
                fontSize: "12px",
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.9)",
                fontWeight: 500,
              }}
            >
              {id}
            </span>
          </div>
          <Fingerprint size={28} style={{ color: accent, opacity: 0.5 }} />
        </div>
      </div>
    </div>
  )
}

function AccessCardVisual() {
  return (
    <div style={{ position: "relative", height: "420px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Back card — rotated */}
      <IDCard
        name="James D."
        role="Family Member"
        id="ARC-5519-2076"
        accent="#4338ca"
        rotate={7}
        translateX={55}
        translateY={12}
        zIndex={1}
      />
      {/* Middle card */}
      <IDCard
        name="Maya R."
        role="Team Member"
        id="ARC-7203-8841"
        accent="#6366f1"
        rotate={-4}
        translateX={0}
        translateY={0}
        zIndex={2}
      />
      {/* Front card — slightly to the left */}
      <IDCard
        name="Sarah M."
        role="Shared Access"
        id="ARC-2847-9341"
        accent="#5D5FEF"
        rotate={-2}
        translateX={-52}
        translateY={-8}
        zIndex={3}
      />
    </div>
  )
}

// ─── Feature row ──────────────────────────────────────────────────────

const features = [
  {
    icon: FolderOpen,
    tag: "File Management",
    headline: "Every file,\nalways in reach.",
    description: "Upload, preview, search, and share any file type from a clean, fast web interface. Photos, videos, documents, music — all in one place on your own server.",
    bullets: [
      "Upload files up to 10 GB with real-time progress",
      "AI-powered auto-rename and categorization",
      "PDF viewer, image gallery, video player built-in",
      "Ghost folders and PIN-locked directories for privacy",
      "Family sharing with isolated storage per user",
    ],
    Visual: FileVisual,
    reverse: false,
  },
  {
    icon: Sparkles,
    tag: "AI Assistant",
    headline: "Intelligence built\nright in.",
    description: "Chat with your own AI assistant powered by your choice of model — DeepSeek, OpenAI, Claude, Gemini, or run Ollama locally. Full file access, no data sent to third-party clouds.",
    bullets: [
      "9 AI providers: DeepSeek, OpenAI, Claude, Gemini, Groq, Llama, Qwen, Ollama, ElevenLabs",
      "AI can read, write, rename, and organize your files",
      "Real-time streaming responses",
      "Voice output via ElevenLabs TTS integration",
    ],
    Visual: AIVisual,
    reverse: true,
  },
  {
    icon: Plug,
    tag: "Smart Integrations",
    headline: "Connect everything\nyou already use.",
    description: "Arcellite connects natively with n8n for automation, Google Drive and OneDrive for cloud sync, Discord for messaging, and Chromecast for media casting.",
    bullets: [
      "n8n automation with 5 pre-built workflows included",
      "Two-way sync with Google Drive and OneDrive",
      "Cast photos and videos to Chromecast",
      "Discord integration for file sharing",
      "PostgreSQL and MySQL remote database access",
    ],
    Visual: IntegrationsVisual,
    reverse: false,
  },
  {
    icon: ShieldCheck,
    tag: "Security & Privacy",
    headline: "Your data never\nleaves your hands.",
    description: "Session-based authentication, two-factor auth, IP allowlisting, and complete data isolation. Self-hosted means no third party ever sees your files.",
    bullets: [
      "TOTP two-factor authentication (Google Authenticator compatible)",
      "IP allowlisting — only your devices can connect",
      "Path traversal protection on all file operations",
      "Bcrypt password hashing, secure 256-bit session tokens",
    ],
    Visual: SecurityVisual,
    reverse: true,
  },
  {
    icon: Users,
    tag: "Family Sharing",
    headline: "Give access,\nnot your password.",
    description: "Share your Arcellite with family members or teammates — each gets their own secure access card, isolated storage directory, and private workspace. No shared passwords, ever.",
    bullets: [
      "Up to 5 family or team members with isolated storage",
      "Each member gets a unique secure access ID",
      "Ghost folders and PIN locks for private directories",
      "No cross-user file access — fully isolated per member",
      "Revoke access instantly from the admin panel",
    ],
    Visual: AccessCardVisual,
    reverse: false,
  },
]

function useInView(threshold = 0.08) {
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

function FeatureRow({ feature }: { feature: typeof features[0] }) {
  const { ref, visible } = useInView()
  const Icon = feature.icon

  return (
    <div
      ref={ref}
      className={`grid md:grid-cols-2 gap-10 lg:gap-16 items-center transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      {/* Text side */}
      <div className={feature.reverse ? "md:order-2" : ""}>
        <div className="inline-flex items-center gap-2 rounded-full bg-[#5D5FEF]/10 px-3 py-1 mb-5">
          <Icon className="h-3.5 w-3.5 text-[#5D5FEF]" />
          <span className="text-xs font-semibold text-[#5D5FEF] uppercase tracking-wider">{feature.tag}</span>
        </div>
        <h3 className="font-heading font-bold text-4xl md:text-5xl text-[#1d1d1f] leading-tight tracking-tight mb-5 whitespace-pre-line">
          {feature.headline}
        </h3>
        <p className="text-gray-500 text-base leading-relaxed mb-7">{feature.description}</p>
        <ul className="space-y-3">
          {feature.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-[#5D5FEF]/10 flex items-center justify-center">
                <Check className="h-3 w-3 text-[#5D5FEF]" />
              </span>
              <span className="text-sm text-gray-600 leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Visual side */}
      <div className={feature.reverse ? "md:order-1" : ""}>
        <feature.Visual />
      </div>
    </div>
  )
}

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-20">
          <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">Features</p>
          <h2 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl text-[#1d1d1f] tracking-tight">
            Everything you need.
            <br />
            <span className="text-gray-400">Nothing you don&apos;t.</span>
          </h2>
        </div>
        <div className="space-y-28 md:space-y-36">
          {features.map((feature) => (
            <FeatureRow key={feature.tag} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  )
}
