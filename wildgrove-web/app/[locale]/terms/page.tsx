import { getTranslations, setRequestLocale } from "next-intl/server"
import { LegalDocument, type LegalSection } from "@/components/layout/LegalDocument"
import { buildAlternates } from "@wildgrove/core/seo/alternates"
import type { Locale } from "@/i18n/routing"

const SECTIONS: LegalSection[] = [
    { id: "about" },
    { id: "use" },
    { id: "accounts" },
    { id: "orders" },
    { id: "reviews" },
    { id: "ip" },
    { id: "liability" },
    { id: "changes" },
]

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
    const { locale } = await params
    const t = await getTranslations({ locale, namespace: "terms" })
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
        alternates: buildAlternates("/terms", locale),
    }
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("terms")

    return <LegalDocument namespace="terms" sections={SECTIONS} crossLink={{ href: "/privacy", label: t("privacyLink") }} />
}
