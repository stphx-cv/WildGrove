"use client"

import { usePathname } from "@/i18n/routing"
import { Link } from "@/i18n/routing"

interface NavLinksProps {
    links: { href: string; label: string }[]
}

export function NavLinks({ links }: NavLinksProps) {
    const pathname = usePathname()

    return (
        <>
            {links.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`text-sm font-medium transition-colors relative pb-0.5 ${
                            isActive
                                ? "text-wg-accent dark:text-wg-dark-accent border-b-2 border-wg-accent dark:border-wg-dark-accent"
                                : "text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary"
                        }`}
                    >
                        {link.label}
                    </Link>
                )
            })}
        </>
    )
}
