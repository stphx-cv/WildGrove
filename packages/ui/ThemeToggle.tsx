"use client"

import { useTheme } from "next-themes"
import { useMounted } from "./useMounted"
import { ComputerDesktopIcon, MoonIcon, SunIcon } from "./icons"

// One button that cycles light, system and dark. The icon shown is the one the next click
// switches to, and "system" follows the device again after a manual choice.
const NEXT = { light: "system", system: "dark", dark: "light" } as const
const LABEL = {
    light: "Switch to light mode",
    dark: "Switch to dark mode",
    system: "Switch to system theme",
} as const

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    // next-themes already knows the theme when the page hydrates, so checking
    // only `theme` renders the button on the client where the server
    // rendered the placeholder, and React rebuilds the whole tree.
    const mounted = useMounted()

    if (!mounted || !theme) {
        return <div className="w-9 h-9" aria-hidden="true" />
    }

    const current = theme === "dark" || theme === "light" ? theme : "system"
    const next = NEXT[current]
    const Icon = next === "light" ? SunIcon : next === "dark" ? MoonIcon : ComputerDesktopIcon

    return (
        <button
            onClick={() => setTheme(next)}
            aria-label={LABEL[next]}
            title={LABEL[next]}
            className="relative p-2 rounded-brand text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary transition-colors hover:bg-wg-border/30 dark:hover:bg-wg-dark-border"
        >
            <Icon className="w-5 h-5" />
        </button>
    )
}
