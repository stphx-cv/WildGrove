"use client"

import { useLocale, useTranslations } from "next-intl"
import { NotFoundScreen } from "@/components/layout/NotFoundScreen"

// Reached when a page under [locale] calls notFound(): a dish slug that does
// not exist, for example. URLs that match no route at all never get here; they
// are handled by app/global-not-found.tsx.
//
// It reads the language from the next-intl provider the layout already mounts,
// never from the request headers: a dish page is rendered statically, and
// reading headers there turns the 404 into a 500. The page title comes from the
// dish page's own metadata, which knows the language from the URL.
export default function NotFound() {
    const locale = useLocale()
    const t = useTranslations("notFound")
    const tc = useTranslations("common")
    return (
        <NotFoundScreen
            homeHref={`/${locale}`}
            menuHref={`/${locale}/menu`}
            text={{
                title: t("title"),
                description: t("description"),
                backToHome: tc("backToHome"),
                viewMenu: t("viewMenu"),
                errorFooter: t("errorFooter"),
            }}
        />
    )
}
