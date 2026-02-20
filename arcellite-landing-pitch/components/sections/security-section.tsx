"use client"

import { useRef, useState, useEffect } from "react"
import {
  KeyRound,
  Smartphone,
  Globe,
  EyeOff,
  FolderLock,
  UploadCloud,
  Gauge,
  Users,
} from "lucide-react"

const features = [
  {
    icon: KeyRound,
    title: "Session-Based Auth",
    description: "256-bit cryptographically random tokens. No JWT vulnerabilities. Sessions expire automatically.",
  },
  {
    icon: Smartphone,
    title: "Two-Factor Authentication",
    description: "TOTP-compatible 2FA (Google Authenticator, Authy). Required for sensitive operations.",
  },
  {
    icon: Globe,
    title: "IP Allowlisting",
    description: "Restrict access to specific IP addresses or ranges. Unknown IPs see a blank page.",
  },
  {
    icon: EyeOff,
    title: "Traffic Masking",
    description: "Return generic 404 responses for unauthorized requests to avoid fingerprinting.",
  },
  {
    icon: FolderLock,
    title: "Ghost Folders",
    description: "Hidden directories that don't appear in file listings for any user except the owner.",
  },
  {
    icon: UploadCloud,
    title: "Secure File Uploads",
    description: "Path traversal protection, MIME type validation, 10 GB limit, and streaming I/O.",
  },
  {
    icon: Gauge,
    title: "Rate Limiting",
    description: "Per-IP rate limiting on auth endpoints. Brute-force protection built in.",
  },
  {
    icon: Users,
    title: "Family Isolation",
    description: "Each family member gets a completely isolated storage subdirectory. No cross-access.",
  },
]

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

export function SecuritySection() {
  const { ref, visible } = useInView()

  return (
    <section id="security" className="bg-[#f5f5f7] py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6" ref={ref}>
        {/* Heading */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">
            Security
          </p>
          <h2 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl text-[#1d1d1f] tracking-tight">
            Your data stays yours.
            <br />
            <span className="text-gray-400">Always.</span>
          </h2>
          <p className="mt-5 text-lg text-gray-500 max-w-xl mx-auto">
            Eight layers of security designed to keep your self-hosted cloud private and protected.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className={`group rounded-2xl border border-gray-100 bg-white p-6 transition-all duration-700 hover:shadow-xl hover:shadow-gray-100 hover:-translate-y-1 hover:border-[#5D5FEF]/20 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: visible ? `${i * 50}ms` : "0ms" }}
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#5D5FEF]/10 group-hover:bg-[#5D5FEF]/15 transition-colors">
                  <Icon className="h-5 w-5 text-[#5D5FEF]" />
                </div>
                <h3 className="font-semibold text-[#1d1d1f] mb-1.5 text-sm">{feature.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            )
          })}
        </div>

        {/* Trust banner */}
        <div
          className={`mt-10 flex items-center justify-center gap-3 transition-all duration-700 delay-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#5D5FEF]/20 bg-[#5D5FEF]/5 px-5 py-2.5 text-sm font-medium text-[#5D5FEF]">
            Open source · Fully auditable by anyone
          </span>
        </div>
      </div>
    </section>
  )
}
