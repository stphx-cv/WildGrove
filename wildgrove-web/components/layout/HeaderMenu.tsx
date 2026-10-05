"use client"

import { cmsLink } from "@wildgrove/core/urls"
import { useState, useRef, useEffect } from "react"
import { useTheme } from "next-themes"
import { useMounted } from "@wildgrove/ui/useMounted"
import { useLocale, useTranslations } from "next-intl"
import { usePathname, useRouter } from "@/i18n/routing"
import { useAlternateLocale } from "@/components/providers/AlternateLocaleProvider"
import { CurrencySelector } from "@/components/layout/CurrencySelector"
import { useCurrency } from "@/components/providers/CurrencyProvider"
import { persistLocaleSwitchScroll } from "@wildgrove/core/locale-switch-scroll"
import Link from "next/link"
import { CogIcon, ComputerDesktopIcon, MoonIcon, SlidersIcon, SunIcon } from "@wildgrove/ui/icons"

interface HeaderMenuProps {
    isAdmin: boolean
}

export function HeaderMenu({ isAdmin }: HeaderMenuProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const { theme, setTheme } = useTheme()
    const locale = useLocale()
    const pathname = usePathname()
    const router = useRouter()
    const tc = useTranslations("common")
    const { alternateUrls } = useAlternateLocale()
    // With one store currency there is nothing to choose.
    const { storeCurrency } = useCurrency()

    // Close on click outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        if (open) document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [open])

    // Close on Escape
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false)
        }
        if (open) document.addEventListener("keydown", handleKey)
        return () => document.removeEventListener("keydown", handleKey)
    }, [open])

    // The server cannot know the saved theme, so nothing is marked active until
    // after hydration; otherwise the server's "Light" stays highlighted.
    const mounted = useMounted()
    const isDark = mounted && theme === "dark"
    const isLight = mounted && theme === "light"
    const isSystem = mounted && theme === "system"

    function switchLocale(newLocale: "en" | "es") {
        // Persist current scroll so the new locale's page can restore it.
        persistLocaleSwitchScroll()

        const alternate = alternateUrls[newLocale]
        if (alternate) {
            router.replace(alternate, { locale: newLocale, scroll: false })
        } else {
            router.replace(pathname, { locale: newLocale, scroll: false })
        }
        setOpen(false)
    }

    return (
        <div ref={ref} className="relative hidden md:block">
            {/* Trigger button — ellipsis icon */}
            <button
                onClick={() => setOpen(!open)}
                aria-label={tc("settings")}
                aria-expanded={open}
                className={`p-2 rounded-brand transition-colors ${
                    open
                        ? "bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary"
                        : "text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary hover:bg-wg-border/30 dark:hover:bg-wg-dark-border"
                }`}
            >
                <SlidersIcon className="w-5 h-5" />
            </button>

            {/* Dropdown — always mounted so it can animate out; `invisible` keeps it
                unfocusable while closed. It grows from the trigger's corner. */}
            <div
                className={`absolute right-0 top-full mt-2 w-56 origin-top-right rounded-brand bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated z-50 transition-[opacity,scale,translate,visibility] motion-reduce:transition-none ${
                    open
                        ? "opacity-100 scale-100 translate-y-0 visible duration-150 ease-out"
                        : "opacity-0 scale-95 -translate-y-1 invisible pointer-events-none duration-100 ease-in"
                }`}
            >

                {/* Theme section */}
                <div className="px-4 py-3 border-b border-wg-border/50 dark:border-wg-dark-border/50">
                    <p className="text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wider mb-2">
                        {tc("theme")}
                    </p>
                    <div className="grid grid-cols-3 gap-1">
                        {([
                            { value: "light", active: isLight, Icon: SunIcon, label: tc("lightMode") },
                            { value: "system", active: isSystem, Icon: ComputerDesktopIcon, label: tc("systemMode") },
                            { value: "dark", active: isDark, Icon: MoonIcon, label: tc("darkMode") },
                        ] as const).map(({ value, active, Icon, label }) => (
                            <button
                                key={value}
                                onClick={() => setTheme(value)}
                                aria-pressed={active}
                                className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-brand text-xs font-medium transition-colors ${
                                    active
                                        ? "bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary"
                                        : "text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Language section */}
                <div className="px-4 py-3 border-b border-wg-border/50 dark:border-wg-dark-border/50">
                    <p className="text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wider mb-2">
                        {tc("language")}
                    </p>
                    <div className="flex gap-1">
                        <button
                            onClick={() => switchLocale("en")}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-brand text-xs font-medium transition-colors ${
                                locale === "en"
                                    ? "bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary"
                                    : "text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
                            }`}
                        >
                            EN
                        </button>
                        <button
                            onClick={() => switchLocale("es")}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-brand text-xs font-medium transition-colors ${
                                locale === "es"
                                    ? "bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary"
                                    : "text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
                            }`}
                        >
                            ES
                        </button>
                    </div>
                </div>

                {/* Currency section */}
                {!storeCurrency && (
                    <div className="px-4 py-3 border-b border-wg-border/50 dark:border-wg-dark-border/50">
                        <CurrencySelector />
                    </div>
                )}

                {/* Admin link — only if admin */}
                {isAdmin && (
                    <div className="py-1">
                        <a
                            href={cmsLink()}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-wg-primary dark:text-wg-dark-primary hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors"
                        >
                            <CogIcon className="w-4 h-4" />
                            {tc("adminPanel")}
                        </a>
                    </div>
                )}
            </div>
        </div>
    )
}
