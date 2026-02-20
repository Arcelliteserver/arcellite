"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Cloud, Menu, X, Github } from "lucide-react"
import Link from "next/link"

// Hash links use /#hash so they always navigate to home first, then scroll
const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Business", href: "/business" },
  { label: "Docs", href: "/docs" },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Active: exact match for page routes; hash links are never "active" on other pages
  const isActive = (href: string) =>
    !href.startsWith("/#") && (pathname === href || pathname.startsWith(href + "/"))

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center px-6 pt-4">
      {/* Always dark — same as the scrolled state */}
      <div className="w-full max-w-6xl rounded-full border border-white/15 bg-black/70 shadow-xl shadow-black/25 backdrop-blur-xl transition-all duration-300">
        <div className="grid grid-cols-3 items-center px-6 py-2.5">

          {/* Left: Logo — dot sits directly after "e", no gap */}
          <Link href="/" className="flex items-center gap-2 justify-self-start">
            <Cloud className="h-6 w-6 text-[#5D5FEF]" />
            <span className="flex items-baseline">
              <span className="text-lg font-bold tracking-tight text-white">Arcellite</span>
              <span className="text-[#5D5FEF] font-black text-2xl leading-none">.</span>
            </span>
          </Link>

          {/* Center: Desktop nav links */}
          <div className="hidden items-center gap-1 md:flex justify-self-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  isActive(link.href)
                    ? "bg-white/15 text-white"
                    : "text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right: Actions */}
          <div className="hidden items-center gap-3 md:flex justify-self-end">
            <Link
              href="https://github.com/arcellite"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-white/50 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-4 w-4" />
            </Link>
            <Link
              href="/early-access"
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                pathname === "/early-access"
                  ? "bg-[#5D5FEF] border-transparent text-white"
                  : "border-white/20 text-white/70 hover:border-white/40 hover:text-white"
              }`}
            >
              Early Access
            </Link>
            <Link
              href="/#how-it-works"
              className="rounded-full bg-[#5D5FEF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors shadow-lg shadow-[#5D5FEF]/30"
            >
              Install Now
            </Link>
          </div>

          {/* Mobile hamburger — col 3, right-aligned */}
          <button
            className="md:hidden text-white/70 hover:text-white transition-colors p-1 justify-self-end"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-white/10 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    isActive(link.href)
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/early-access"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center w-full rounded-full border border-white/20 py-2.5 text-sm font-semibold text-white/70 hover:text-white hover:border-white/40 transition-colors"
                >
                  Early Access
                </Link>
                <Link
                  href="/#how-it-works"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center w-full rounded-full bg-[#5D5FEF] py-2.5 text-sm font-semibold text-white hover:bg-[#4D4FCF] transition-colors"
                >
                  Install Now
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
