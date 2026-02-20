"use client"

import { useState } from "react"
import { Check, Copy, ArrowRight, Lock } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

function AppMockup() {
  return (
    <Image
      src="/image/Screenshot_app.png"
      alt="Arcellite — self-hosted personal cloud showing file management, storage stats, and sidebar navigation"
      width={1400}
      height={900}
      className="w-full"
      priority
    />
  )
}

export function Hero() {
  const [copied, setCopied] = useState(false)
  const installCommand = "curl -fsSL https://arcellite.io/install.sh | sh"

  const handleCopy = () => {
    navigator.clipboard.writeText(installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative overflow-hidden bg-white pt-40 md:pt-48 pb-0">
      {/* Animated glow orb — sits behind everything */}
      <div className="pointer-events-none absolute inset-0 flex justify-center overflow-hidden">
        <div
          className="mt-10 h-[520px] w-[820px] rounded-full"
          style={{
            background: "radial-gradient(ellipse, rgba(93,95,239,0.13) 0%, rgba(93,95,239,0.04) 50%, transparent 75%)",
            filter: "blur(40px)",
            animation: "pulse 5s ease-in-out infinite",
          }}
        />
      </div>
      <div className="relative mx-auto max-w-7xl px-6">
        {/* Headline */}
        <div className="text-center animate-fade-in-up">
          <h1 className="font-heading font-black tracking-tight leading-[0.88]">
            <span className="block text-[40px] sm:text-[58px] md:text-[76px] lg:text-[96px] text-[#1d1d1f]">
              Your Cloud.
            </span>
            <span
              className="block text-[40px] sm:text-[58px] md:text-[76px] lg:text-[96px]"
              style={{
                background: "linear-gradient(135deg, #0f0f14 0%, #2e2e7a 35%, #5D5FEF 65%, #818cf8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Your Rules.
            </span>
          </h1>
        </div>

        {/* Subheadline — short and punchy */}
        <p
          className="mx-auto mt-8 max-w-xl text-center text-lg sm:text-xl text-gray-500 leading-relaxed animate-fade-in-up"
          style={{ animationDelay: "120ms" }}
        >
          Self-hosted personal cloud — file management, AI assistant, and smart integrations. On your hardware. Under your control.
        </p>

        {/* Install command */}
        <div
          className="mx-auto mt-10 max-w-lg animate-fade-in-up"
          style={{ animationDelay: "240ms" }}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-[#f5f5f7] px-5 py-3.5 shadow-sm">
            <span className="text-sm font-semibold text-[#5D5FEF] flex-shrink-0">$</span>
            <code className="flex-1 text-left font-mono text-sm text-gray-700 truncate">
              {installCommand}
            </code>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-200 hover:text-gray-700"
              aria-label="Copy install command"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2.5 text-center text-xs text-gray-400">
            Takes less than 2 minutes · No cloud account required · Works on any Linux server
          </p>
          <p className="mt-1.5 text-center text-xs text-gray-400">
            <a
              href="https://github.com/arcellite/arcellite/blob/main/install.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5D5FEF] hover:underline font-medium"
            >
              View install script on GitHub
            </a>
            {" "}before running.
          </p>
        </div>

        {/* CTA Buttons */}
        <div
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up"
          style={{ animationDelay: "320ms" }}
        >
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-full bg-[#5D5FEF] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#5D5FEF]/25 hover:bg-[#4D4FCF] hover:shadow-[#5D5FEF]/40 transition-all"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-7 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            View Documentation
          </Link>
        </div>

        {/* Product showcase — CSS UI mockup */}
        <div
          className="relative mt-20 animate-fade-in-up"
          style={{ animationDelay: "400ms" }}
        >
          {/* Gradient fade at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />

          {/* Desktop browser frame */}
          <div className="relative mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/80">
              {/* Browser chrome — light style */}
              <div className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f7] px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
                  <div className="h-3 w-3 rounded-full bg-green-400/60" />
                </div>
                <div className="mx-auto flex items-center gap-2 rounded-md bg-white border border-gray-200 px-4 py-1 shadow-sm">
                  <Lock className="h-3 w-3 text-gray-400" />
                  <span className="font-mono text-xs text-gray-500">arcellite.local</span>
                </div>
              </div>
              {/* App UI mockup */}
              <AppMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
