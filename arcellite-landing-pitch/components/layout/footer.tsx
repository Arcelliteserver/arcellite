import Link from "next/link"
import { Cloud } from "lucide-react"

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Security", href: "#security" },
    { label: "Integrations", href: "#integrations" },
    { label: "How It Works", href: "#how-it-works" },
  ],
  Resources: [
    { label: "Documentation", href: "/docs" },
    { label: "GitHub", href: "https://github.com" },
    { label: "Changelog", href: "#" },
    { label: "System Requirements", href: "/docs#system-requirements" },
  ],
  Community: [
    { label: "Discord", href: "#" },
    { label: "Twitter", href: "#" },
    { label: "Discussions", href: "#" },
    { label: "Report a Bug", href: "#" },
  ],
}

export function Footer() {
  return (
    <footer className="bg-[#f5f5f7] border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <Cloud className="h-6 w-6 text-[#5D5FEF]" />
              <span className="flex items-baseline">
                <span className="text-lg font-bold tracking-tight text-[#1d1d1f]">Arcellite</span>
                <span className="text-[#5D5FEF] font-black text-2xl leading-none">.</span>
              </span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              Self-hosted personal cloud platform. File management, AI assistant, and smart integrations — on your hardware.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#5D5FEF]" />
              <span className="text-xs font-medium text-gray-500">MIT Licensed</span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-4">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 hover:text-[#5D5FEF] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            © 2025 Arcellite · Built with privacy in mind
          </p>
          <p className="text-xs text-gray-400">
            Made by{" "}
            <span className="text-gray-600 font-medium">Robera Desissa</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
