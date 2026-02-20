import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const _spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" });
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: 'Arcellite — Your Cloud. Your Rules.',
  description: 'A self-hosted personal cloud platform for file management, AI assistance, database tools, and smart home integrations. Replace cloud subscriptions with your own server.',
  keywords: ['self-hosted', 'cloud storage', 'personal cloud', 'open source', 'file management', 'AI assistant', 'privacy'],
  authors: [{ name: 'Robera Desissa' }],
  icons: {
    icon: '/favicon.svg',
    apple: '/assets/png/logo.png',
  },
  openGraph: {
    title: 'Arcellite — Own Your Infrastructure',
    description: 'A self-hosted personal cloud platform for storage, automation, and private data control.',
    images: ['/images/arcellite-desktop.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arcellite — Your Cloud. Your Rules.',
    description: 'Self-hosted personal cloud. No monthly fees. 100% yours.',
  },
}

export const viewport: Viewport = {
  themeColor: '#5D5FEF',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${_inter.variable} ${_spaceGrotesk.variable} ${_geistMono.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
