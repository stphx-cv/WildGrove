"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Theme provider shared by both apps — next-themes only.
 *
 * `wildgrove-web` wraps this with `CurrencyProvider`
 * (components/providers/ThemeProvider.tsx); the CMS has no currency switcher,
 * so it mounts this one directly.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange={false}
        >
            {children}
        </NextThemesProvider>
    )
}
