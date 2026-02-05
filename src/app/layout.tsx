import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { APP_CONFIG } from "@/lib/config"
import { PWAInstall } from "@/components/PWAInstall"
import { OfflineIndicator } from "@/components/OfflineIndicator"
import { SyncIndicator } from "@/components/SyncIndicator"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: APP_CONFIG.fullName,
  description: APP_CONFIG.description,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_CONFIG.name,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFBF7" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
}

// Script para evitar flash de tema incorreto
const themeScript = `
  (function() {
    const stored = localStorage.getItem('${APP_CONFIG.storage.themeKey}');
    if (stored) {
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  })();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/Logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <OfflineIndicator />
        {children}
        <SyncIndicator />
        <PWAInstall />
      </body>
    </html>
  )
}
