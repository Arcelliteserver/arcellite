"use client"

import { useRef, useState, useEffect } from "react"
import { DollarSign, Server, Lock } from "lucide-react"

const problems = [
  {
    icon: DollarSign,
    stat: "$2,400+",
    label: "per year",
    title: "Paying subscriptions you don't control",
    description:
      "iCloud, Google Drive, Dropbox — they charge you monthly for space on their hardware. And they can change terms anytime.",
  },
  {
    icon: Server,
    stat: "0%",
    label: "ownership",
    title: "Data living on someone else's servers",
    description:
      "Your files, photos, and messages pass through their systems. They can scan, analyze, or lose your data.",
  },
  {
    icon: Lock,
    stat: "100%",
    label: "vendor lock-in",
    title: "Locked into platforms you can't escape",
    description:
      "Switching providers means re-uploading everything — or just losing it. No portability, no freedom.",
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

export function ProblemSection() {
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
            The Problem
          </p>
          <h2 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl text-[#1d1d1f] tracking-tight">
            You don&apos;t own your cloud.
            <br />
            <span className="text-[#5D5FEF]">You&apos;re renting it.</span>
          </h2>
        </div>

        {/* Problem cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((problem, i) => (
            <div
              key={problem.title}
              className={`group rounded-3xl border border-gray-100 bg-[#f5f5f7] p-8 transition-all duration-700 hover:border-[#5D5FEF]/20 hover:bg-white hover:shadow-xl hover:shadow-gray-100 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: visible ? `${i * 80}ms` : "0ms" }}
            >
              <div className="mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5D5FEF]/10 mb-4">
                  <problem.icon className="h-6 w-6 text-[#5D5FEF]" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-heading font-bold text-4xl text-[#1d1d1f]">
                    {problem.stat}
                  </span>
                  <span className="text-sm text-gray-500 font-medium">{problem.label}</span>
                </div>
              </div>
              <h3 className="font-semibold text-lg text-[#1d1d1f] mb-2">{problem.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{problem.description}</p>
            </div>
          ))}
        </div>

        {/* Solution banner */}
        <div
          className={`mt-12 rounded-2xl bg-[#5D5FEF]/5 border border-[#5D5FEF]/15 px-8 py-6 text-center transition-all duration-700 delay-300 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="font-semibold text-[#5D5FEF] text-lg">
            Arcellite gives you control back — forever, with no recurring fees.
          </p>
        </div>
      </div>
    </section>
  )
}
