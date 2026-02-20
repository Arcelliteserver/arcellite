"use client"

import { useRef, useState, useEffect } from "react"
import { Copy, Check } from "lucide-react"

const steps = [
  {
    number: "01",
    title: "Install with one command",
    description: "Run the installer on any Ubuntu, Debian, or Raspberry Pi server. It handles Node.js, PostgreSQL, PM2, and all dependencies automatically.",
    command: "curl -fsSL https://arcellite.io/install.sh | sh",
  },
  {
    number: "02",
    title: "Start Arcellite",
    description: "Start the server with a single command. PM2 keeps it running in the background and restarts it automatically on reboot.",
    command: "pm2 start arcellite --name arcellite",
  },
  {
    number: "03",
    title: "Open in your browser",
    description: "Access your personal cloud from any browser on your network. Complete setup in under a minute — create your account and you're done.",
    command: "http://YOUR-SERVER-IP:3000",
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

function CodeBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const isUrl = command.startsWith("http")

  const handleCopy = () => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-[#f5f5f7] px-4 py-3 mt-4">
      {!isUrl && <span className="text-[#5D5FEF] font-mono text-sm font-semibold flex-shrink-0">$</span>}
      <code className="flex-1 font-mono text-sm text-gray-700 truncate">{command}</code>
      {!isUrl && (
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          aria-label="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  )
}

export function HowItWorksSection() {
  const { ref, visible } = useInView()

  return (
    <section id="how-it-works" className="bg-[#f5f5f7] py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6" ref={ref}>
        {/* Heading */}
        <div
          className={`text-center mb-20 transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">
            How It Works
          </p>
          <h2 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl text-[#1d1d1f] tracking-tight">
            Up and running
            <br />
            in under 2 minutes.
          </h2>
        </div>

        {/* Steps */}
        <div className="max-w-3xl mx-auto space-y-6">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`relative flex gap-6 transition-all duration-700 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: visible ? `${i * 100}ms` : "0ms" }}
            >
              {/* Left: number + connector */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5D5FEF] text-white font-heading font-bold text-lg shadow-lg shadow-[#5D5FEF]/25">
                  {step.number}
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 w-px bg-[#5D5FEF]/20 mt-3" style={{ minHeight: "32px" }} />
                )}
              </div>

              {/* Right: content */}
              <div className="flex-1 pb-8">
                <h3 className="font-heading font-bold text-xl md:text-2xl text-[#1d1d1f] mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-500 text-base leading-relaxed">{step.description}</p>
                <CodeBlock command={step.command} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p
          className={`mt-12 text-center text-sm text-gray-400 transition-all duration-700 delay-400 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          Supported: Ubuntu 22.04/24.04 · Debian 12 · Raspberry Pi OS · ARM64 & x86_64
        </p>
      </div>
    </section>
  )
}
