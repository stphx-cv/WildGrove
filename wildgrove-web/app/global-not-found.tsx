// ══════════════════════════════════════════════════════════════════
// The 404 for URLs that match no route. Enabled by
// `experimental.globalNotFound` in next.config.ts.
//
// Why not a catch-all page under [locale]: app/[locale]/loading.tsx makes
// every page there stream behind a shell that is sent with a 200 before the
// page can throw notFound(), so the branded 404 arrived with the wrong
// status. Production before this file answered 404 because the root layout
// sat above [locale]; that layout is gone (it could not know the locale),
// and this document takes its place for unmatched URLs. It renders its own
// <html>, outside every layout, and answers 404.
//
// It sits outside the next-intl provider and the [locale] segment, so
// getLocale() reads the locale the next-intl middleware in proxy.ts resolved
// for this request: the URL's prefix, or the default locale.
// ══════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { getLocale } from "next-intl/server"
import { routing, type Locale } from "@wildgrove/core/i18n/routing"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { NotFoundScreen, type NotFoundText } from "@/components/layout/NotFoundScreen"
import { messagesFor } from "@/i18n/messages"
import { playfair, dmSans } from "./fonts"
import "./globals.css"

async function requestLocale(): Promise<Locale> {
    const locale = await getLocale()
    return routing.locales.includes(locale as Locale) ? (locale as Locale) : routing.defaultLocale
}

function notFoundMessages(locale: Locale) {
    const messages = messagesFor(locale)
    const notFound = messages.notFound as Record<string, string>
    const common = messages.common as Record<string, string>
    const text: NotFoundText = {
        title: notFound.title,
        description: notFound.description,
        backToHome: common.backToHome,
        viewMenu: notFound.viewMenu,
        errorFooter: notFound.errorFooter,
    }
    return { metaTitle: notFound.metaTitle, metaDescription: notFound.metaDescription, text }
}

export async function generateMetadata(): Promise<Metadata> {
    const { metaTitle, metaDescription } = notFoundMessages(await requestLocale())
    return {
        title: `${metaTitle} | Wild Grove`,
        description: metaDescription,
    }
}

export default async function GlobalNotFound() {
    const locale = await requestLocale()
    const { text } = notFoundMessages(locale)
    return (
        <html lang={locale} suppressHydrationWarning>
            <body className={`${playfair.variable} ${dmSans.variable} antialiased`}>
                <ThemeProvider>
                    <NotFoundScreen homeHref={`/${locale}`} menuHref={`/${locale}/menu`} text={text} />
                </ThemeProvider>
            </body>
        </html>
    )
}
