"use client"

import { useRef, useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, ArrowRight, Loader2, CheckCircle, ChevronDown, Check } from "lucide-react"
import Link from "next/link"

// ─── Options ──────────────────────────────────────────────────────────
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

// ─── Types ────────────────────────────────────────────────────────────
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

// ─── WaitlistModal ────────────────────────────────────────────────────
export function WaitlistModal({ onClose }: { onClose: () => void }) {
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

  // Lock background scroll
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  // Click-outside to close dropdown
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
    } catch {
      setReqStatus("error")
      setErrorMsg("Something went wrong. Please try again.")
    }
  }

  const inputCls =
    "w-full min-w-0 rounded-xl bg-[#f5f5f7] border border-gray-200 px-4 py-2.5 text-sm text-[#1d1d1f] placeholder:text-gray-400 outline-none focus:border-[#5D5FEF]/50 focus:ring-2 focus:ring-[#5D5FEF]/15 transition-all"

  const radioCls = (selected: boolean) =>
    `w-full text-left rounded-xl border px-3.5 py-2.5 text-sm transition-all ${
      selected
        ? "bg-[#5D5FEF]/8 border-[#5D5FEF]/40 text-[#5D5FEF] font-medium"
        : "bg-[#f5f5f7] border-gray-200 text-gray-600 hover:border-[#5D5FEF]/25 hover:text-gray-800"
    }`

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-x-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-gray-200 shadow-2xl shadow-gray-300/40 max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-8">
          {/* ── Success state ──────────────────────────────── */}
          {reqStatus === "success" ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="h-16 w-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-5">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="font-bold text-2xl text-[#1d1d1f] mb-2">You&apos;re on the list.</h3>
              <p className="text-gray-500 text-sm leading-relaxed max-w-sm mb-6">
                We&apos;re onboarding teams in small batches. We&apos;ll reach out once Business access opens for your segment.
              </p>
              <div className="w-full rounded-2xl border border-gray-100 bg-[#f5f5f7] p-4 text-left mb-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">In the meantime</p>
                <div className="space-y-2">
                  <Link href="/" onClick={onClose} className="flex items-center gap-2 text-sm text-[#5D5FEF] font-medium hover:underline">
                    <ArrowRight className="h-3.5 w-3.5" /> Explore the Free plan
                  </Link>
                  <a href="https://github.com/arcellite" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#5D5FEF] font-medium hover:underline">
                    <ArrowRight className="h-3.5 w-3.5" /> Join the developer community
                  </a>
                  <a href="https://github.com/arcellite" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#5D5FEF] font-medium hover:underline">
                    <ArrowRight className="h-3.5 w-3.5" /> Follow product updates
                  </a>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-[#5D5FEF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors"
              >
                Got it
              </button>
            </div>
          ) : (
            <>
              {/* ── Header ─────────────────────────────────── */}
              <div className="mb-6">
                <h3 className="font-bold text-xl text-[#1d1d1f] mb-1">
                  Request Early Access to Arcellite Business
                </h3>
                <p className="text-gray-400 text-sm">
                  Built for teams that need full control. Tell us about your team — we&apos;ll prioritize access accordingly.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Email + Company */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Work Email *</label>
                    <input type="email" required placeholder="you@company.com" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Company Name</label>
                    <input type="text" placeholder="Acme Corp" value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })} className={inputCls} />
                  </div>
                </div>

                {/* Team size — portal dropdown */}
                <div className="relative min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Team Size</label>
                  <button
                    ref={dropBtnRef}
                    type="button"
                    onClick={openDropdown}
                    className="w-full flex items-center justify-between rounded-xl bg-[#f5f5f7] border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#5D5FEF]/50 focus:ring-2 focus:ring-[#5D5FEF]/15 transition-all"
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
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            form.teamSize === opt
                              ? "text-[#5D5FEF] bg-[#5D5FEF]/8 font-medium"
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

                {/* What are you replacing? */}
                <div>
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
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                            sel
                              ? "bg-[#5D5FEF]/10 border-[#5D5FEF]/40 text-[#5D5FEF]"
                              : "border-gray-200 bg-[#f5f5f7] text-gray-500 hover:border-[#5D5FEF]/25"
                          }`}
                        >
                          {sel && <Check className="h-2.5 w-2.5" />}
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Primary reason */}
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

                {/* Deployment preference */}
                <div>
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

                {/* Budget — optional */}
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

                {/* Specifics — optional */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Anything specific you need?{" "}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Specific requirements, integrations, compliance needs…"
                    value={form.specifics}
                    onChange={(e) => setForm({ ...form, specifics: e.target.value })}
                    className={inputCls + " resize-none"}
                  />
                </div>

                {/* Design partner */}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, designPartner: !form.designPartner })}
                  className="w-full flex items-start gap-3 rounded-xl border border-gray-200 bg-[#f5f5f7] px-4 py-3 text-left hover:border-[#5D5FEF]/30 transition-all group"
                >
                  <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 transition-all flex items-center justify-center ${
                    form.designPartner
                      ? "border-[#5D5FEF] bg-[#5D5FEF]"
                      : "border-gray-300 group-hover:border-[#5D5FEF]/50"
                  }`}>
                    {form.designPartner && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1f]">Interested in becoming a design partner?</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Design partners get early access and help shape the product roadmap.
                    </p>
                  </div>
                </button>

                {errorMsg && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={reqStatus === "loading"}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#5D5FEF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4D4FCF] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#5D5FEF]/20"
                >
                  {reqStatus === "loading" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</>
                  ) : (
                    <>Request Early Access <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
