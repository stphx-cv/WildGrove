"use client"

import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/routing"
import { useAlternateLocale } from "@/components/providers/AlternateLocaleProvider"
import { persistLocaleSwitchScroll } from "@wildgrove/core/locale-switch-scroll"

const LANGUAGES = [
  { code: "en" as const, label: "EN" },
  { code: "es" as const, label: "ES" },
]

export function LanguageSelector() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const { alternateUrls } = useAlternateLocale()

  function switchLocale(newLocale: "en" | "es") {
    // Persist current scroll so the new locale's page can restore it.
    persistLocaleSwitchScroll()

    const alternate = alternateUrls[newLocale]
    if (alternate) {
      router.replace(alternate, { locale: newLocale, scroll: false })
    } else {
      router.replace(pathname, { locale: newLocale, scroll: false })
    }
  }

  return (
    <div className="flex items-center gap-0.5 text-sm">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => switchLocale(lang.code)}
          className={`px-2 py-1 rounded-brand transition-colors ${
            locale === lang.code
              ? "bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary font-medium"
              : "text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text"
          }`}
          aria-label={lang.code === "en" ? "Switch to English" : "Cambiar a Español"}
        >
          {lang.label}
        </button>
      ))}
    </div>
  )
}
