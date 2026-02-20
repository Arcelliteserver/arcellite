"use client"

import { useState } from "react"
import { Copy, Check, ArrowRight, Github } from "lucide-react"
import Link from "next/link"

export function CTASection() {
  const [copied, setCopied] = useState(false)
  const installCommand = "curl -fsSL https://arcellite.io/install.sh | sh"

  const handleCopy = () => {
    navigator.clipboard.writeText(installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative bg-[#0f0f14] py-28 md:py-36 overflow-hidden">
      {/* Top purple atmospheric glow */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-80 w-[700px] rounded-full"
        style={{
          background: "radial-gradient(ellipse, rgba(93,95,239,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      {/* Bottom purple glow — like the business card */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-56 w-[600px] rounded-full"
        style={{
          background: "radial-gradient(ellipse, rgba(93,95,239,0.25) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <h2 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl text-white tracking-tight mb-6">
          Ready to own
          <br />
          <span
            style={{
              background: "linear-gradient(90deg, #5D5FEF 0%, #8B8DF8 50%, #5D5FEF 100%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "shimmer 3s linear infinite",
            }}
          >
            your cloud?
          </span>
        </h2>
        <p className="text-lg text-white/50 mb-12 max-w-xl mx-auto">
          One command. Your own hardware. Full control — forever.
        </p>

        {/* Install command */}
        <div className="mx-auto max-w-lg mb-8">
          <div className="flex items-center gap-3 rounded-2xl bg-white/6 border border-white/12 px-5 py-4">
            <span className="text-[#8B8DF8] font-mono text-sm font-semibold flex-shrink-0">$</span>
            <code className="flex-1 text-left font-mono text-sm text-white/70 truncate">
              {installCommand}
            </code>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Copy"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-full bg-[#5D5FEF] px-7 py-3.5 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors shadow-lg shadow-[#5D5FEF]/30"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/arcellite"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/6 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/12 transition-colors"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </Link>
        </div>

        <p className="mt-8 text-sm text-white/25">
          MIT Licensed · No cloud account required · Works on your hardware
        </p>
      </div>
    </section>
  )
}
