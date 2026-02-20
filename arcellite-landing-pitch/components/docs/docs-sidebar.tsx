"use client"

import { useState } from "react"
import { Cloud, ArrowLeft, ChevronDown, Menu, X } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const sidebarSections = [
  {
    title: "Getting Started",
    items: [
      { id: "overview", label: "Overview" },
      { id: "system-requirements", label: "System Requirements" },
      { id: "installation", label: "Installation Guide" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { id: "chromecast", label: "Chromecast" },
      { id: "discord", label: "Discord" },
      { id: "n8n", label: "n8n Automation" },
      { id: "cloud-storage", label: "Cloud Storage Sync" },
    ],
  },
  {
    title: "Advanced",
    items: [
      { id: "homelab", label: "Home LAB Monitoring" },
      { id: "database", label: "Database Access" },
      { id: "custom-domain", label: "Custom Domain" },
      { id: "ai-config", label: "AI Configuration" },
    ],
  },
  {
    title: "Security",
    items: [
      { id: "security", label: "Security Features" },
    ],
  },
]

export function DocsSidebar({
  activeSection,
  onSectionClick,
}: {
  activeSection: string
  onSectionClick: (id: string) => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([])

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    )
  }

  const handleClick = (id: string) => {
    onSectionClick(id)
    setMobileOpen(false)
  }

  const sidebarContent = (
    <>
      {/* Logo + back */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border/40">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Home
        </Link>
        <div className="h-3.5 w-px bg-border/60" />
        <div className="flex items-center gap-1.5">
          <Cloud className="h-4 w-4 text-primary" />
          <span className="font-heading text-sm font-bold text-foreground">Arcellite Docs</span>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-6">
          {sidebarSections.map((group) => {
            const isCollapsed = collapsedGroups.includes(group.title)
            return (
              <div key={group.title}>
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="flex w-full items-center justify-between px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {group.title}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleClick(item.id)}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          activeSection === item.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Version */}
      <div className="border-t border-border/40 px-4 py-3">
        <p className="text-xs text-muted-foreground">v1.0.0 &middot; MIT License</p>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile toggle */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-primary" />
          <span className="font-heading text-sm font-bold text-foreground">Docs</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-foreground"
          aria-label="Toggle docs navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 flex h-full w-72 flex-col border-r border-border/40 bg-background">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:border-r lg:border-border/40 lg:bg-card/30">
        {sidebarContent}
      </aside>
    </>
  )
}
