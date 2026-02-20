"use client"

import { useRef, useState, useEffect } from "react"
import Image from "next/image"

const appLogos = [
  { src: "/assets/apps/google-drive.svg", alt: "Google Drive" },
  { src: "/assets/apps/microsoft-onedrive.svg", alt: "Microsoft OneDrive" },
  { src: "/assets/apps/discord.svg", alt: "Discord" },
  { src: "/assets/apps/slack.svg", alt: "Slack" },
  { src: "/assets/apps/n8n.svg", alt: "n8n" },
  { src: "/assets/apps/docker-engine.svg", alt: "Docker" },
  { src: "/assets/apps/postgresql.svg", alt: "PostgreSQL" },
  { src: "/assets/apps/mysql.svg", alt: "MySQL" },
]

const aiLogos = [
  { src: "/assets/models/deepseek-color.svg", alt: "DeepSeek" },
  { src: "/assets/models/openai.svg", alt: "OpenAI" },
  { src: "/assets/models/anthropic.svg", alt: "Anthropic" },
  { src: "/assets/models/gemini-color.svg", alt: "Google Gemini" },
  { src: "/assets/models/grok.svg", alt: "Groq" },
  { src: "/assets/models/ollama.svg", alt: "Ollama" },
  { src: "/assets/models/meta-color.svg", alt: "Meta Llama" },
  { src: "/assets/models/qwen-color.svg", alt: "Qwen" },
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

function LogoRow({ logos, delay = 0, visible }: { logos: { src: string; alt: string }[]; delay?: number; visible: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-8 md:gap-12 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {logos.map((logo) => (
        <div
          key={logo.alt}
          className="group flex flex-col items-center gap-2 cursor-default"
          title={logo.alt}
        >
          <Image
            src={logo.src}
            alt={logo.alt}
            width={40}
            height={40}
            className="h-9 w-9 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200"
          />
          <span className="text-xs font-medium text-gray-400 group-hover:text-gray-700 transition-colors">
            {logo.alt}
          </span>
        </div>
      ))}
    </div>
  )
}

export function IntegrationsSection() {
  const { ref, visible } = useInView()

  return (
    <section id="integrations" className="bg-white py-28 md:py-36 border-y border-gray-100">
      <div className="mx-auto max-w-7xl px-6" ref={ref}>
        {/* Heading */}
        <div
          className={`text-center mb-14 transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">
            Integrations
          </p>
          <h2 className="font-heading font-bold text-4xl md:text-5xl text-[#1d1d1f] tracking-tight">
            Works with your favorite tools.
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Connect apps, AI models, cloud storage, and automation platforms.
          </p>
        </div>

        {/* Row 1: Apps */}
        <div className="mb-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
            Apps & Services
          </p>
          <LogoRow logos={appLogos} delay={100} visible={visible} />
        </div>

        {/* Divider */}
        <div className="my-8 flex items-center gap-4">
          <div className="flex-1 border-t border-gray-100" />
          <span className="text-xs text-gray-300 font-medium uppercase tracking-widest">AI Models</span>
          <div className="flex-1 border-t border-gray-100" />
        </div>

        {/* Row 2: AI Models */}
        <LogoRow logos={aiLogos} delay={200} visible={visible} />

        <p
          className={`mt-8 text-center text-sm text-gray-400 transition-all duration-700 delay-300 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          More integrations coming soon · All via n8n automation
        </p>
      </div>
    </section>
  )
}
