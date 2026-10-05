"use client"

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"
import { useRouter, usePathname } from "@/i18n/routing"
import { CloseIcon, GlobeIcon } from "@wildgrove/ui/icons"

const DISMISSED_KEY = "wg:locale-prompt-dismissed"

export function LocalePromptBanner() {
    const locale = useLocale()
    const router = useRouter()
    const pathname = usePathname()

    const [visible, setVisible] = useState(false)

    /* eslint-disable react-hooks/set-state-in-effect -- browser locale vs stored dismissal after hydration */
    useEffect(() => {
        try {
            if (localStorage.getItem(DISMISSED_KEY)) {
                setVisible(false)
                return
            }
            const browserLang = (navigator.language || "").toLowerCase()
            const browserPrefersEs = browserLang.startsWith("es")
            setVisible((locale === "en" && browserPrefersEs) || (locale === "es" && !browserPrefersEs))
        } catch {
            setVisible(false)
        }
    }, [locale])
    /* eslint-enable react-hooks/set-state-in-effect */

    if (!visible) return null

    const isEs = locale === "es"
    const targetLocale = isEs ? "en" : "es"

    function dismiss() {
        localStorage.setItem(DISMISSED_KEY, "1")
        setVisible(false)
    }

    function switchLocale() {
        localStorage.setItem(DISMISSED_KEY, "1")
        router.replace(pathname, { locale: targetLocale })
    }

    const message = isEs
        ? <>Would you prefer to view this page in <span className="font-semibold">English</span>?</>
        : <>¿Prefieres ver esta página en <span className="font-semibold">español</span>?</>

    const confirmLabel = isEs ? "Yes, switch" : "Sí, cambiar"
    const dismissLabel = isEs ? "No, thanks" : "No, gracias"
    const closeLabel = isEs ? "Close" : "Cerrar"

    // One layer under the chat (z-50): with both open, the chat window and its
    // bubble stay on top and usable.
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-max max-w-[calc(100vw-1.5rem)] motion-safe:[animation:var(--animate-fade-up)]">
            {/* Light: white card with strong shadow — always visible on any bg color.
                Dark: raised dark card with green glow — lifts off the dark bg. */}
            <div className="
                flex items-center gap-3 rounded-brand px-5 py-3.5
                bg-white border border-wg-primary/25 ring-1 ring-wg-primary/10 shadow-[0_8px_40px_rgba(58,90,64,0.18)]
                dark:bg-wg-dark-raised dark:border dark:border-wg-dark-primary/40 dark:shadow-glow-md
            ">
                {/* Globe icon */}
                <GlobeIcon className="w-4 h-4 shrink-0 text-wg-primary dark:text-wg-dark-primary" strokeWidth={1.8} />

                {/* Message */}
                <p className="text-sm text-wg-text dark:text-wg-dark-text">
                    {message}
                </p>

                <div className="flex items-center gap-2 shrink-0 ml-1">
                    {/* CTA button — green in light, gold in dark */}
                    <button
                        onClick={switchLocale}
                        className="
                            text-sm font-semibold px-3.5 py-1.5 rounded-brand transition-colors
                            bg-wg-primary text-white hover:bg-wg-primary/90
                            dark:bg-wg-dark-accent dark:text-wg-dark-bg dark:hover:bg-wg-dark-accent-hover
                        "
                    >
                        {confirmLabel}
                    </button>

                    {/* Soft dismiss */}
                    <button
                        onClick={dismiss}
                        className="text-sm transition-colors text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text"
                    >
                        {dismissLabel}
                    </button>
                </div>

                {/* X close */}
                <button
                    onClick={dismiss}
                    aria-label={closeLabel}
                    className="transition-colors shrink-0 text-wg-muted/60 hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text"
                >
                    <CloseIcon className="w-4 h-4" strokeWidth={2} />
                </button>
            </div>
        </div>
    )
}
