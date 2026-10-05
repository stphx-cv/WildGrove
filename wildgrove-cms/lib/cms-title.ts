import type { Metadata } from "next"
import type { ReactNode } from "react"

/** Leaf title; the root layout templates it as `{title} | Wild Grove CMS`. */
export function cmsTitle(title: string): Metadata {
    return { title }
}

export function CmsSectionLayout({ children }: { children: ReactNode }) {
    return children
}
