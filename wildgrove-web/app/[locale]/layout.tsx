// ══════════════════════════════════════════════════════════════════
// Root layout. It lives inside the [locale] segment on purpose.
//
// There used to be an app/layout.tsx above this one that rendered <html>.
// A root layout never receives a child segment's params, so its
// `lang={locale ?? "en"}` was "en" on every Spanish page — verified in
// production on 2026-09-08 — which contradicted the hreflang the same page
// declared. Public pages are prerendered per locale, so reading the locale
// from request headers here is not an option either. This is the structure
// next-intl documents: the [locale] layout owns <html> and <body>.
// ══════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { Suspense } from "react"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { routing, type Locale } from "@wildgrove/core/i18n/routing"
import { getAppSettings } from "@wildgrove/core/settings"
import { safeJsonLd } from "@wildgrove/core/seo/json-ld"
import { siteUrl } from "@wildgrove/core/urls"
import { openingHoursSpecification } from "@wildgrove/core/seo/opening-hours-schema"
import { SITE_CREATOR, SITE_CREATOR_INSTAGRAM, SITE_CREATOR_LINKEDIN } from "@wildgrove/core/site-creator"
import { trimmedContact } from "@wildgrove/core/public-contact"
import { socialProfileUrls } from "@wildgrove/core/social-links"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { Header } from "@/components/layout/Header"
import { HeaderSkeleton } from "@/components/layout/HeaderSkeleton"
import { Footer } from "@/components/layout/Footer"
import { LocalePromptBanner } from "@/components/layout/LocalePromptBanner"
import { LocaleSwitchScrollRestorer } from "@/components/layout/LocaleSwitchScrollRestorer"
import { ChatLazy } from "@/components/chat/ChatLazy"
import { AlternateLocaleProvider } from "@/components/providers/AlternateLocaleProvider"
import { CartProvider } from "@/components/providers/CartProvider"
import { CartDrawer } from "@/components/cart/CartDrawer"
import { WebMcpTools } from "@/components/agent/WebMcpTools"
import { playfair, dmSans } from "../fonts"
import "../globals.css"

const ORIGIN = siteUrl()

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

// Short document titles — inner pages use the `%s | Wild Grove` template.
// Rich copy stays in description / OG description for SEO and shares.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const isSpanish = locale === "es"

  return {
    metadataBase: new URL(ORIGIN),
    title: {
      template: "%s | Wild Grove",
      default: "Wild Grove",
    },
    description:
      "Wild Grove, healthy food restaurant in Lima, Peru. Seasonal menus, reservations, and Sage, our AI dining assistant.",
    openGraph: {
      siteName: "Wild Grove",
      type: "website",
      locale: isSpanish ? "es_PE" : "en_US",
      alternateLocale: isSpanish ? ["en_US"] : ["es_PE"],
      title: "Wild Grove",
      description: "Seasonal cuisine crafted with care. Reserve your table today.",
      images: [{ url: "/jpg/og-home-dishes.jpg", width: 1200, height: 630, alt: "Wild Grove restaurant" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Wild Grove",
      description: "Seasonal cuisine crafted with care.",
      images: ["/jpg/og-home-dishes.jpg"],
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }

  setRequestLocale(locale)
  const messages = await getMessages()

  const settings = await getAppSettings()
  const address = trimmedContact(settings.contactAddress)
  const phone = trimmedContact(settings.contactPhone)
  const socialProfiles = socialProfileUrls(settings.socialLinks)

  // The restaurant is fictional, and the structured data has to say so.
  // Search engines and assistants read this without opening the page, and a
  // Restaurant in Miraflores with a phone number and acceptsReservations is a
  // real person's wasted evening if the only disclosure lives in the About copy.
  const restaurantJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@id": `${ORIGIN}/#restaurant`,
    "@type": "Restaurant",
    name: "Wild Grove",
    description:
      "A fictional restaurant, built as a software portfolio project. Wild Grove does not exist and takes no real reservations; the menu, hours and reviews are demonstration data.",
    disambiguatingDescription:
      "Not a real business. This site is a full-stack demonstration by Stephano Camarena V.",
    servesCuisine: ["Healthy", "Contemporary"],
    priceRange: "$$",
    url: ORIGIN,
    image: `${ORIGIN}/webp/home-dishes.webp`,
    acceptsReservations: "True",
    hasMenu: `${ORIGIN}/en/menu`,
  }
  // Same source as the reservations page, the agent API and the markdown
  // representation. The hours used to be typed here by hand and disagreed
  // with all three.
  const hours = openingHoursSpecification(
    settings.operatingDays,
    settings.openingTime,
    settings.closingTime
  )
  if (hours.length > 0) restaurantJsonLd.openingHoursSpecification = hours
  if (address) {
    restaurantJsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: address,
      addressCountry: "PE",
    }
  }
  if (phone) restaurantJsonLd.telephone = phone
  if (socialProfiles.length > 0) restaurantJsonLd.sameAs = socialProfiles

  // The website is the actual work; the restaurant is its subject matter. This
  // node is what tells a machine who built it and what to evaluate, which is
  // the only audience this site really has.
  const portfolioJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Wild Grove",
    url: ORIGIN,
    description:
      "A full-stack portfolio project: a fictional restaurant with a public menu, reservations, an AI host, an admin CMS, and a read-only surface for autonomous agents.",
    inLanguage: ["en", "es"],
    about: { "@id": `${ORIGIN}/#restaurant` },
    creator: {
      "@type": "Person",
      name: SITE_CREATOR.en.name,
      jobTitle: SITE_CREATOR.en.role,
      sameAs: [SITE_CREATOR_LINKEDIN, SITE_CREATOR_INSTAGRAM],
    },
  }

  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${playfair.variable} ${dmSans.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(restaurantJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(portfolioJsonLd) }}
        />
        {/* Points agents at the ARD manifest without them having to guess the
            well-known path. React hoists this into <head>. */}
        <link
          rel="ai-catalog"
          type="application/json"
          href="/.well-known/ai-catalog.json"
        />
        <ThemeProvider storeCurrency={settings.storeCurrency}>
          <NextIntlClientProvider messages={messages}>
            <AlternateLocaleProvider>
              <CartProvider>
                <Suspense fallback={<HeaderSkeleton />}>
                  <Header />
                </Suspense>
                <main className="w-full">{children}</main>
                <Footer />
                {settings.chatMode !== "off" && <ChatLazy locale={locale} chatMode={settings.chatMode} />}
                <LocalePromptBanner />
                <LocaleSwitchScrollRestorer />
                <CartDrawer />
                <WebMcpTools locale={locale} />
              </CartProvider>
            </AlternateLocaleProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
