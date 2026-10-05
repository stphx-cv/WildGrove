import { getTranslations, setRequestLocale } from "next-intl/server"
import { LegalDocument, type LegalSection } from "@/components/layout/LegalDocument"
import { buildAlternates } from "@wildgrove/core/seo/alternates"
import type { Locale } from "@/i18n/routing"

const SECTIONS: LegalSection[] = [
    { id: "owner" },
    { id: "collect", items: ["account", "reservations", "orders", "reviews", "chat", "technical"] },
    { id: "use", items: ["account", "emails", "reviews", "chat", "abuse"] },
    { id: "processors", items: ["insforge", "ai", "maps", "google", "upstash", "email"] },
    { id: "retention" },
    { id: "rights" },
    { id: "cookies" },
]

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
    const { locale } = await params
    const t = await getTranslations({ locale, namespace: "privacy" })
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
        alternates: buildAlternates("/privacy", locale),
    }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("privacy")

    return <LegalDocument namespace="privacy" sections={SECTIONS} crossLink={{ href: "/terms", label: t("termsLink") }} />
}
