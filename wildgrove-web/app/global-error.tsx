"use client"

// ══════════════════════════════════════════════════════════════════
// The last error boundary: an error in app/[locale]/layout.tsx itself,
// which app/[locale]/error.tsx cannot catch because it renders inside that
// layout. It replaces the whole document, so it renders its own <html>,
// like app/global-not-found.tsx, and has no header, footer or next-intl
// provider.
//
// Without messages to read, it keeps both languages here and picks one
// from the first segment of the path. Next.js shows it only in production
// builds; in development the error overlay takes its place.
// ══════════════════════════════════════════════════════════════════

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { playfair, dmSans } from "./fonts"
import "./globals.css"

const TEXT = {
    en: {
        title: "Wild Grove could not load",
        description: "Something failed while preparing the site. Try again, and if it keeps failing, come back in a few minutes.",
        retry: "Try again",
        home: "Back to Home",
        reference: "Reference",
    },
    es: {
        title: "Wild Grove no pudo cargarse",
        description: "Algo falló al preparar el sitio. Vuelve a intentarlo y, si sigue fallando, prueba en unos minutos.",
        retry: "Intentar de nuevo",
        home: "Volver al inicio",
        reference: "Referencia",
    },
} as const

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string }
}) {
    const pathname = usePathname() ?? "/"
    const locale = pathname.split("/")[1] === "es" ? "es" : "en"
    const t = TEXT[locale]

    useEffect(() => {
        console.error("[layout]", error.digest ?? error.message)
    }, [error])

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <title>{`${t.title} | Wild Grove`}</title>
            </head>
            <body className={`${playfair.variable} ${dmSans.variable} antialiased`}>
                <ThemeProvider>
                    <div className="min-h-screen flex items-center justify-center bg-wg-bg dark:bg-wg-dark-bg px-4">
                        <div className="w-full max-w-md text-center rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card p-8 sm:p-10">
                            <p className="font-body text-xs font-semibold tracking-[0.3em] uppercase text-wg-accent dark:text-wg-dark-accent mb-4">
                                Wild Grove
                            </p>
                            <h1 className="font-display text-xl sm:text-2xl font-bold text-wg-text dark:text-wg-dark-text mb-2">
                                {t.title}
                            </h1>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed mb-6">
                                {t.description}
                            </p>
                            {/* A full reload: the layout that failed is gone, so there is
                                nothing left on the page to refresh in place. */}
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="w-full px-5 py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all"
                            >
                                {t.retry}
                            </button>
                            <p className="mt-4">
                                {/* A plain anchor for the same reason. */}
                                <a
                                    href={`/${locale}`}
                                    className="text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors"
                                >
                                    {t.home}
                                </a>
                            </p>
                            {error.digest && (
                                <p className="mt-6 text-xs font-mono text-wg-muted/70 dark:text-wg-dark-muted/70">
                                    {t.reference}: {error.digest}
                                </p>
                            )}
                        </div>
                    </div>
                </ThemeProvider>
            </body>
        </html>
    )
}
