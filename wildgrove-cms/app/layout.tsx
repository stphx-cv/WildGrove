// ══════════════════════════════════════════════════════════════════
// CMS root layout — document shell only (fonts, theme).
//
// The admin chrome (sidebar, header, date-time context) lives in
// app/(panel)/layout.tsx so that /login can render without it.
//
// No next-intl: this app is single-language by design.
// ══════════════════════════════════════════════════════════════════
import type { Metadata } from "next"
import { Playfair_Display, DM_Sans } from "next/font/google"
import { ThemeProvider } from "@wildgrove/ui/ThemeProvider"
import "./globals.css"

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    template: "%s | Wild Grove CMS",
    default: "Wild Grove CMS",
  },
  // Also sent as an X-Robots-Tag header for every response — see next.config.ts.
  robots: "noindex, nofollow",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${playfair.variable} ${dmSans.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
