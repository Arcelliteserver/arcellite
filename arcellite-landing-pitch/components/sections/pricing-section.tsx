"use client"

import { useRef, useState, useEffect } from "react" // useState kept for useInView
import { Check, Zap, Building2, ArrowRight } from "lucide-react"
import Link from "next/link"

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

const freeFeatures = [
  "Unlimited local file storage",
  "AI Assistant (9 providers)",
  "PostgreSQL & MySQL remote access",
  "n8n automation (5 workflows)",
  "Google Drive & OneDrive sync",
  "Discord & Chromecast integration",
  "Family sharing (up to 5 members)",
  "Custom domain support",
  "Full security suite (2FA, IP allowlist)",
  "MIT licensed — self-hosted forever",
]

const businessFeatures = [
  "Everything in Free",
  "Multi-server cluster support",
  "Advanced role & permission management",
  "Priority email & chat support",
  "White-label & custom branding",
  "SSO / LDAP integration",
  "Audit logs & compliance reports",
  "SLA guarantee",
]

// ─── Main Section ──────────────────────────────────────────────────────
export function PricingSection() {
  const { ref, visible } = useInView()

  return (
    <>
      <section id="pricing" className="bg-[#f5f5f7] py-28 md:py-36">
        <div className="mx-auto max-w-7xl px-6" ref={ref}>

          {/* Heading */}
          <div
            className={`text-center mb-16 transition-all duration-700 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">Pricing</p>
            <h2 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl text-[#1d1d1f] tracking-tight">
              Simple, honest pricing.
              <br />
              <span className="text-[#5D5FEF]">Start free. Always.</span>
            </h2>
            <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto">
              Arcellite is free for personal use — forever. Business plans with advanced features are coming soon.
            </p>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* Free tier */}
            <div
              className={`relative rounded-3xl bg-white border border-gray-100 p-8 shadow-sm transition-all duration-700 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: visible ? "100ms" : "0ms" }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-2xl bg-[#5D5FEF]/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-[#5D5FEF]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-xl text-[#1d1d1f]">Personal</h3>
                  <p className="text-xs font-medium text-gray-400">For individuals & families</p>
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-heading font-bold text-5xl text-[#1d1d1f]">$0</span>
                  <span className="text-gray-400 text-sm font-medium">/ forever</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">No credit card. No subscriptions. Self-host it yourself.</p>
              </div>
              <Link
                href="/#how-it-works"
                className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[#5D5FEF] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors shadow-lg shadow-[#5D5FEF]/20 mb-8"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <ul className="space-y-3">
                {freeFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="mt-0.5 h-4 w-4 rounded-full bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
                      <Check className="h-2.5 w-2.5 text-[#5D5FEF]" />
                    </div>
                    <span className="text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Business tier — coming soon */}
            <div
              className={`relative rounded-3xl bg-[#1d1d1f] border border-[#2d2d2f] p-8 overflow-hidden transition-all duration-700 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: visible ? "200ms" : "0ms" }}
            >
              <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#5D5FEF]/15 blur-3xl" />

              <div className="absolute top-6 right-6">
                <span className="rounded-full bg-[#5D5FEF]/20 border border-[#5D5FEF]/30 px-3 py-1 text-xs font-semibold text-[#8B8DF8]">
                  Coming Soon
                </span>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-xl text-white">Business</h3>
                  <p className="text-xs font-medium text-white/40">For teams & organizations</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-heading font-bold text-5xl text-white">—</span>
                </div>
                <p className="mt-1 text-sm text-white/40">Pricing announced at launch · Join the waitlist</p>
              </div>

              <Link
                href="/early-access"
                className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[#5D5FEF]/15 border border-[#5D5FEF]/30 px-6 py-3.5 text-sm font-semibold text-[#8B8DF8] hover:bg-[#5D5FEF]/25 hover:border-[#5D5FEF]/50 hover:text-white transition-all mb-8"
              >
                Request Early Access
                <ArrowRight className="h-4 w-4" />
              </Link>

              <ul className="space-y-3">
                {businessFeatures.map((feature, i) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className={`mt-0.5 h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                      i === 0 ? "bg-[#5D5FEF]/20" : "bg-white/8"
                    }`}>
                      <Check className={`h-2.5 w-2.5 ${i === 0 ? "text-[#8B8DF8]" : "text-white/30"}`} />
                    </div>
                    <span className={`text-sm ${i === 0 ? "text-white/70" : "text-white/35"}`}>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Bottom note */}
          <p
            className={`mt-10 text-center text-sm text-gray-400 transition-all duration-700 delay-300 ${
              visible ? "opacity-100" : "opacity-0"
            }`}
          >
            The personal version will always remain free and open source · No hidden fees · MIT licensed
          </p>
        </div>
      </section>
    </>
  )
}
