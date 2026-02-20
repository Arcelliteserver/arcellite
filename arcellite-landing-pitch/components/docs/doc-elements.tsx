"use client"

import { useState } from "react"
import { Check, Copy, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export function CodeBlock({
  title,
  language,
  children,
}: {
  title?: string
  language?: string
  children: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-secondary/40">
      {title && (
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          {language && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{language}</span>
          )}
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
          <code className="font-mono text-foreground/90">{children}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 rounded-lg border border-border/40 bg-card/80 p-1.5 text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

export function StepList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-8">{children}</div>
}

export function Step({
  number,
  title,
  children,
  isLast = false,
}: {
  number: number
  title: string
  children: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {number}
        </div>
        {!isLast && <div className="mt-2 flex-1 w-px bg-border/50" />}
      </div>
      <div className="flex-1 pb-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <div className="mt-3 flex flex-col gap-3">{children}</div>
      </div>
    </div>
  )
}

export function InfoBox({
  variant = "info",
  children,
}: {
  variant?: "info" | "warning" | "tip"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-4 text-sm leading-relaxed",
        variant === "info" && "border-primary/20 bg-primary/5 text-foreground/90",
        variant === "warning" && "border-amber-500/20 bg-amber-500/5 text-foreground/90",
        variant === "tip" && "border-emerald-500/20 bg-emerald-500/5 text-foreground/90"
      )}
    >
      {variant === "info" && <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />}
      {variant === "warning" && <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />}
      {variant === "tip" && <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500" />}
      <div>{children}</div>
    </div>
  )
}

export function FlowDiagram({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/40 px-5 py-4">
      {items.map((item, i) => (
        <div key={item} className="flex items-center gap-2">
          <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">{item}</span>
          {i < items.length - 1 && (
            <span className="text-muted-foreground/40">{">"}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function SpecGrid({
  title,
  items,
}: {
  title: string
  items: { label: string; value: string; required?: boolean }[]
}) {
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="border-b border-border/40 bg-card/60 px-4 py-2.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="divide-y divide-border/30">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{item.value}</span>
              {item.required !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                    item.required
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.required ? "Required" : "Optional"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FeatureCard({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-5 transition-colors hover:border-primary/30 hover:bg-card/50">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      {action && (
        <a
          href={action.href}
          className="mt-3 inline-block text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {action.label}
        </a>
      )}
    </div>
  )
}
