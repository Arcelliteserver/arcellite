import { Scale, Server, Eye, Github, ShieldCheck, Lock } from "lucide-react"

const trustItems = [
  {
    icon: Scale,
    title: "MIT Licensed",
    description: "Fully open-source. Read every line of code, fork it, modify it, and make it yours.",
  },
  {
    icon: Server,
    title: "Fully Self-Hosted",
    description: "Everything runs on your hardware. No cloud dependencies, no external servers.",
  },
  {
    icon: Eye,
    title: "Data Never Leaves",
    description: "Your files, databases, and conversations stay on your machine. Period.",
  },
  {
    icon: Github,
    title: "Transparent Repository",
    description: "Public GitHub repo with full commit history. No hidden code, no surprises.",
  },
  {
    icon: ShieldCheck,
    title: "Security-First Architecture",
    description: "Session-based auth, encrypted connections, and activity logging built in.",
  },
  {
    icon: Lock,
    title: "You Own Everything",
    description: "Export all your data at any time. No vendor lock-in, no data hostage situations.",
  },
]

export function TrustSection() {
  return (
    <section id="trust" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-primary">
            Security & Trust
          </p>
          <h2 className="font-heading mt-4 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Transparency is not optional.
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Arcellite is built on the principle that you should never have to trust a black box with your data.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {trustItems.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-4 rounded-2xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30 hover:bg-card"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
