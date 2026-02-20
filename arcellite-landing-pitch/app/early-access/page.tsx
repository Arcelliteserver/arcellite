"use client"

import { useRef, useState, useEffect } from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Cloud,
  Loader2, CheckCircle, Lock, Shield, Zap,
} from "lucide-react"
import Link from "next/link"

// ─── Form options ──────────────────────────────────────────────────────
const teamSizeOptions = ["1–5", "6–20", "21–50", "51–200", "200+"]

const replacingOptions = [
  "Google Drive", "Dropbox", "Notion", "Slack",
  "Internal file server", "Multiple SaaS tools", "Other",
]

const reasonOptions = [
  "Data control & sovereignty",
  "Reduce SaaS costs",
  "Compliance requirements",
  "Internal AI usage",
  "Replace fragmented tools",
  "Scaling infrastructure",
]

const deploymentOptions = [
  "Self-hosted only",
  "Managed deployment support",
  "Hosted version (future)",
]

const budgetOptions = [
  "Under $50/mo",
  "$50–$200/mo",
  "$200–$500/mo",
  "$500+/mo",
  "Not sure yet",
]

interface Form {
  email: string
  company: string
  teamSize: string
  replacing: string[]
  reason: string
  deployment: string
  budget: string
  specifics: string
  designPartner: boolean
}

// ─── Section label ─────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em] mb-3 mt-8 first:mt-0">
      {children}
    </p>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────
export default function EarlyAccessPage() {
  const [form, setForm] = useState<Form>({
    email: "",
    company: "",
    teamSize: "",
    replacing: [],
    reason: "",
    deployment: "",
    budget: "",
    specifics: "",
    designPartner: false,
  })
  const [reqStatus, setReqStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [dropOpen, setDropOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const dropBtnRef = useRef<HTMLButtonElement>(null)
  const dropPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        dropBtnRef.current && !dropBtnRef.current.contains(t) &&
        dropPanelRef.current && !dropPanelRef.current.contains(t)
      ) setDropOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [dropOpen])

  const openDropdown = () => {
    if (dropBtnRef.current) {
      const rect = dropBtnRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setDropOpen((o) => !o)
  }

  const toggleReplacing = (opt: string) =>
    setForm((f) => ({
      ...f,
      replacing: f.replacing.includes(opt)
        ? f.replacing.filter((r) => r !== opt)
        : [...f.replacing, opt],
    }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email.trim()) return
    setReqStatus("loading")
    setErrorMsg("")
    try {
      const res = await fetch("https://n8n.arcelliteserver.com/webhook/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          company: form.company.trim() || "",
          team_size: form.teamSize || "",
          replacing: form.replacing,
          reason: form.reason || "",
          deployment: form.deployment || "",
          budget: form.budget || "",
          specifics: form.specifics.trim() || "",
          design_partner: form.designPartner,
          type: "business",
          signed_up: new Date().toISOString(),
          status: "waiting",
        }),
      })
      if (!res.ok) throw new Error("Server error")
      setReqStatus("success")
      // Scroll right panel to top to show success
      rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setReqStatus("error")
      setErrorMsg("Something went wrong. Please try again.")
    }
  }

  const inputCls =
    "w-full min-w-0 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1d1d1f] placeholder:text-gray-400 outline-none focus:border-[#5D5FEF]/60 focus:ring-2 focus:ring-[#5D5FEF]/10 transition-all shadow-sm"

  const radioCls = (selected: boolean) =>
    `w-full text-left rounded-xl border px-4 py-3 text-sm transition-all cursor-pointer shadow-sm ${
      selected
        ? "bg-[#5D5FEF]/8 border-[#5D5FEF]/50 text-[#5D5FEF] font-medium shadow-[#5D5FEF]/10"
        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
    }`

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-x-hidden">

      {/* ── LEFT PANEL ───────────────────────────────────────────── */}
      <div className="relative w-full md:w-[44%] md:min-h-screen bg-[#07070e] flex flex-col md:sticky md:top-0 md:h-screen overflow-hidden">

        {/* Atmospheric glows */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(93,95,239,0.22) 0%, transparent 65%)", filter: "blur(80px)" }} />
        <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(93,95,239,0.08) 0%, transparent 70%)", filter: "blur(60px)" }} />

        <div className="relative flex flex-col h-full px-8 py-10 md:px-10 md:py-12">

          {/* Logo + back */}
          <div className="flex items-center justify-between mb-12">
            <Link href="/" className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-[#5D5FEF]" />
              <span className="flex items-baseline">
                <span className="text-base font-bold tracking-tight text-white">Arcellite</span>
                <span className="text-[#5D5FEF] font-black text-xl leading-none">.</span>
              </span>
            </Link>
            <Link
              href="/business"
              className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/70 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </div>

          {/* Hero copy */}
          <div className="flex-1 flex flex-col justify-center pb-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#5D5FEF]/25 bg-[#5D5FEF]/10 px-3.5 py-1.5 mb-8 w-fit">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5D5FEF] animate-pulse" />
              <span className="text-[11px] font-bold text-[#8B8DF8] uppercase tracking-widest">
                Early Access Program
              </span>
            </div>

            {/* Main heading — Umbrel-style: large, confident, no hype */}
            <h1 className="font-heading font-bold text-3xl sm:text-4xl md:text-[2.6rem] lg:text-5xl text-white leading-[1.1] tracking-tight mb-5">
              Built for teams
              <br />
              <span style={{
                background: "linear-gradient(135deg, #a5b4fc 0%, #818cf8 40%, #6366f1 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                who need full control.
              </span>
            </h1>

            <p className="text-white/50 text-base leading-relaxed mb-10 max-w-sm">
              Tell us about your team and use case. We review applications individually and prioritize based on fit.
            </p>

            {/* Trust signals */}
            <div className="space-y-4 mb-10">
              {[
                { icon: Lock, text: "Data never leaves your servers" },
                { icon: Zap, text: "No per-seat pricing — ever" },
                { icon: Shield, text: "MIT Licensed · Open source core" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-white/6 border border-white/8 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3.5 w-3.5 text-[#8B8DF8]" />
                  </div>
                  <span className="text-sm text-white/55">{text}</span>
                </div>
              ))}
            </div>

            {/* Bottom note */}
            <div className="rounded-2xl border border-white/8 bg-white/3 px-5 py-4">
              <p className="text-xs text-white/35 leading-relaxed">
                We&apos;re onboarding in small batches.
                <span className="text-white/55 font-medium"> Design partners get priority access </span>
                and help shape the product roadmap.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────── */}
      <div
        ref={rightPanelRef}
        className="w-full md:flex-1 bg-[#f7f7f9] md:h-screen md:overflow-y-auto"
      >
        <div className="max-w-xl mx-auto px-6 py-12 md:px-10 md:py-16">

          {/* ── Success state ──────────────────────── */}
          {reqStatus === "success" ? (
            <div className="flex flex-col items-center text-center py-16">
              <div className="h-20 w-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mb-6">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="font-heading font-bold text-3xl text-[#1d1d1f] mb-3">You&apos;re on the list.</h2>
              <p className="text-gray-500 text-base leading-relaxed max-w-sm mb-10">
                We&apos;re onboarding in small batches. We&apos;ll reach out once access opens for your segment.
              </p>

              <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-left mb-8 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em] mb-4">In the meantime</p>
                <div className="space-y-3">
                  {[
                    { label: "Explore the Free plan", href: "/" },
                    { label: "Read the documentation", href: "/docs" },
                    { label: "View on GitHub", href: "https://github.com/arcellite" },
                  ].map(({ label, href }) => (
                    <Link
                      key={label}
                      href={href}
                      className="flex items-center justify-between group py-2 border-b border-gray-50 last:border-0"
                    >
                      <span className="text-sm text-[#1d1d1f] font-medium group-hover:text-[#5D5FEF] transition-colors">{label}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-[#5D5FEF] transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>

              <Link
                href="/"
                className="rounded-full bg-[#5D5FEF] px-8 py-3 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors shadow-lg shadow-[#5D5FEF]/20"
              >
                Back to home
              </Link>
            </div>

          ) : (
            <>
              {/* ── Form header ──────────────────────── */}
              <div className="mb-8">
                <h2 className="font-heading font-bold text-2xl text-[#1d1d1f] mb-1">
                  Request Early Access
                </h2>
                <p className="text-gray-400 text-sm">
                  Takes about 2 minutes. All fields except email are optional.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-0">

                {/* ── About you ──────────────────────── */}
                <SectionLabel>About you</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Work email *</label>
                    <input
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Company name</label>
                    <input
                      type="text"
                      placeholder="Acme Corp"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* ── Team size ──────────────────────── */}
                <SectionLabel>Your team</SectionLabel>
                <div className="relative min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Team size</label>
                  <button
                    ref={dropBtnRef}
                    type="button"
                    onClick={openDropdown}
                    className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-[#5D5FEF]/60 focus:ring-2 focus:ring-[#5D5FEF]/10 transition-all"
                  >
                    <span className={form.teamSize ? "text-[#1d1d1f]" : "text-gray-400"}>
                      {form.teamSize || "How many people on your team?"}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${dropOpen ? "rotate-180" : ""}`} />
                  </button>
                  {dropOpen && typeof document !== "undefined" && createPortal(
                    <div
                      ref={dropPanelRef}
                      style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
                      className="rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden"
                    >
                      {teamSizeOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => { setForm({ ...form, teamSize: opt }); setDropOpen(false) }}
                          className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                            form.teamSize === opt
                              ? "text-[#5D5FEF] bg-[#5D5FEF]/6 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}
                </div>

                {/* ── Use case ───────────────────────── */}
                <SectionLabel>Your use case</SectionLabel>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-2">
                    What are you replacing?{" "}
                    <span className="text-gray-400 font-normal">Select all that apply</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {replacingOptions.map((opt) => {
                      const sel = form.replacing.includes(opt)
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleReplacing(opt)}
                          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                            sel
                              ? "bg-[#5D5FEF]/10 border-[#5D5FEF]/40 text-[#5D5FEF] shadow-sm"
                              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 shadow-sm"
                          }`}
                        >
                          {sel && <Check className="h-2.5 w-2.5" />}
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Primary reason for interest</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {reasonOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setForm({ ...form, reason: opt })}
                        className={radioCls(form.reason === opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Technical preferences ──────────── */}
                <SectionLabel>Technical preferences</SectionLabel>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Deployment preference</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {deploymentOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setForm({ ...form, deployment: opt })}
                        className={radioCls(form.deployment === opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">
                    Budget expectation{" "}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {budgetOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setForm({ ...form, budget: form.budget === opt ? "" : opt })}
                        className={radioCls(form.budget === opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Final details ──────────────────── */}
                <SectionLabel>Anything else?</SectionLabel>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Specific requirements{" "}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Compliance needs, integrations you require, specific use cases…"
                    value={form.specifics}
                    onChange={(e) => setForm({ ...form, specifics: e.target.value })}
                    className={inputCls + " resize-none"}
                  />
                </div>

                {/* Design partner */}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, designPartner: !form.designPartner })}
                  className={`w-full flex items-start gap-3 rounded-xl border px-4 py-4 text-left transition-all ${
                    form.designPartner
                      ? "border-[#5D5FEF]/30 bg-[#5D5FEF]/4 shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300 shadow-sm"
                  }`}
                >
                  <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 transition-all flex items-center justify-center ${
                    form.designPartner
                      ? "border-[#5D5FEF] bg-[#5D5FEF]"
                      : "border-gray-300"
                  }`}>
                    {form.designPartner && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1f]">Interested in becoming a design partner?</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                      Design partners collaborate on the roadmap and get early access before anyone else.
                    </p>
                  </div>
                </button>

                {/* Error */}
                {errorMsg && (
                  <div className="mt-4 text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={reqStatus === "loading"}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#5D5FEF] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#4D4FCF] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#5D5FEF]/25"
                  >
                    {reqStatus === "loading" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</>
                    ) : (
                      <>Request Early Access <ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                  <p className="text-center text-xs text-gray-400 mt-3">
                    MIT Licensed · No per-seat fees · Data stays on your servers
                  </p>
                </div>

              </form>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
