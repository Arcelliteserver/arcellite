"use client"

import Link from "next/link"
import { Cloud, ArrowLeft, FileQuestion } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full"
        style={{
          background: "radial-gradient(ellipse, rgba(93,95,239,0.08) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative text-center max-w-lg">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-12">
          <Cloud className="h-7 w-7 text-[#5D5FEF]" />
          <span className="flex items-baseline">
            <span className="text-xl font-bold tracking-tight text-[#1d1d1f]">Arcellite</span>
            <span className="text-[#5D5FEF] font-black text-2xl leading-none">.</span>
          </span>
        </Link>

        {/* 404 number */}
        <div className="relative mb-6">
          <p
            className="text-[9rem] md:text-[12rem] font-black leading-none tracking-tighter select-none"
            style={{
              background: "linear-gradient(135deg, #f5f5f7 0%, #e5e5e7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            404
          </p>
          {/* Floating icon on top */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-3xl bg-[#5D5FEF]/10 border border-[#5D5FEF]/20 flex items-center justify-center shadow-xl shadow-[#5D5FEF]/10">
              <FileQuestion className="h-8 w-8 text-[#5D5FEF]" />
            </div>
          </div>
        </div>

        <h1 className="font-heading font-bold text-2xl md:text-3xl text-[#1d1d1f] tracking-tight mb-3">
          This page got lost in the cloud.
        </h1>
        <p className="text-gray-500 text-base leading-relaxed mb-10">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back somewhere useful.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#5D5FEF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors shadow-lg shadow-[#5D5FEF]/25"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Read the Docs
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-12 pt-8 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-4">Popular pages</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { label: "Features", href: "/#features" },
              { label: "Pricing", href: "/#pricing" },
              { label: "Business", href: "/business" },
              { label: "Roadmap", href: "/roadmap" },
              { label: "Early Access", href: "/early-access" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-medium text-[#5D5FEF] hover:underline rounded-full border border-[#5D5FEF]/20 bg-[#5D5FEF]/5 px-3 py-1 transition-colors hover:bg-[#5D5FEF]/10"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
