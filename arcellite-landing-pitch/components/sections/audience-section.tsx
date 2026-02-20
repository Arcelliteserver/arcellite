"use client"

import { useRef, useState, useEffect } from "react"

const audiences = [
  {
    emoji: "💼",
    title: "Small Businesses",
    tagline: "Replace $200/mo cloud costs with a one-time setup.",
    description:
      "Store contracts, invoices, and team files on your own server. Share folders with employees securely, without paying per-seat subscription fees.",
    perks: ["No per-seat pricing", "Full data control", "Team file sharing", "Role-based access"],
  },
  {
    emoji: "👨‍💻",
    title: "Developers & Homelabbers",
    tagline: "A complete dev environment in a single install.",
    description:
      "PostgreSQL + MySQL remote access, n8n automation, webhook endpoints, AI assistant, and a full file system — all on your own hardware.",
    perks: ["Remote DB access", "n8n automation hub", "Webhook proxy", "Ollama local AI"],
  },
  {
    emoji: "🎓",
    title: "Students & Creators",
    tagline: "Own your storage. Zero recurring fees.",
    description:
      "Store projects, photos, music, and videos without worrying about monthly costs or storage limits. Runs on a $35 Raspberry Pi.",
    perks: ["No monthly fees", "Unlimited local storage", "Runs on Raspberry Pi", "Family sharing"],
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

export function AudienceSection() {
  const { ref, visible } = useInView()

  return (
    <section className="bg-white py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6" ref={ref}>
        {/* Heading */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-sm font-semibold text-[#5D5FEF] uppercase tracking-widest mb-4">
            Who It&apos;s For
          </p>
          <h2 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl text-[#1d1d1f] tracking-tight">
            Built for people
            <br />
            who value control.
          </h2>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {audiences.map((audience, i) => (
            <div
              key={audience.title}
              className={`rounded-3xl border border-gray-100 bg-[#f5f5f7] p-8 hover:border-[#5D5FEF]/20 hover:bg-white hover:shadow-xl hover:shadow-gray-100 transition-all duration-700 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: visible ? `${i * 80}ms` : "0ms" }}
            >
              <div className="text-4xl mb-5">{audience.emoji}</div>
              <h3 className="font-heading font-bold text-xl text-[#1d1d1f] mb-1">{audience.title}</h3>
              <p className="text-sm font-semibold text-[#5D5FEF] mb-3">{audience.tagline}</p>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">{audience.description}</p>
              <div className="flex flex-wrap gap-2">
                {audience.perks.map((perk) => (
                  <span
                    key={perk}
                    className="rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600"
                  >
                    {perk}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
