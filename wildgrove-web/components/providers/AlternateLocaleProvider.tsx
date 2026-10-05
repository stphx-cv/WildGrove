"use client"

import { createContext, useContext, useState, useCallback, useRef } from "react"

type AlternateLocaleContextType = {
  alternateUrls: Partial<Record<string, string>>
  setAlternateUrls: (urls: Partial<Record<string, string>>) => number
  clearAlternateUrls: (token: number) => void
}

const AlternateLocaleContext = createContext<AlternateLocaleContextType>({
  alternateUrls: {},
  setAlternateUrls: () => 0,
  clearAlternateUrls: () => {},
})

export function AlternateLocaleProvider({ children }: { children: React.ReactNode }) {
  const [alternateUrls, setAlternateUrlsState] = useState<Partial<Record<string, string>>>({})
  const generation = useRef(0)

  const setAlternateUrls = useCallback((urls: Partial<Record<string, string>>) => {
    const token = ++generation.current
    setAlternateUrlsState(urls)
    return token
  }, [])

  // Only clears if no newer registration has happened since `token` was issued.
  const clearAlternateUrls = useCallback((token: number) => {
    if (generation.current === token) {
      setAlternateUrlsState({})
    }
  }, [])

  return (
    <AlternateLocaleContext.Provider value={{ alternateUrls, setAlternateUrls, clearAlternateUrls }}>
      {children}
    </AlternateLocaleContext.Provider>
  )
}

export function useAlternateLocale() {
  return useContext(AlternateLocaleContext)
}
