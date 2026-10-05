"use client"

import { useEffect, useRef } from "react"
import { useAlternateLocale } from "@/components/providers/AlternateLocaleProvider"

/**
 * Rendered by server pages that have locale-specific slugs (e.g. menu product pages).
 * Registers the alternate locale URLs so LanguageSelector can navigate to the
 * correct slug instead of just swapping the locale prefix.
 *
 * Example: { en: "/menu/highland-granola", es: "/menu/granola-serrana" }
 */
export function SetAlternateLocale({ urls }: { urls: Partial<Record<string, string>> }) {
  const { setAlternateUrls, clearAlternateUrls } = useAlternateLocale()
  const tokenRef = useRef<number>(0)

  useEffect(() => {
    tokenRef.current = setAlternateUrls(urls)
    const token = tokenRef.current
    return () => clearAlternateUrls(token)
  }, [JSON.stringify(urls)]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
