import type { ReactNode } from "react"
import { SocialLinks, type SocialLinkView } from "@wildgrove/ui/social/SocialLinks"

export type FindUsContactItem = {
    key: string
    label: string
    value: string
    href: string
    ariaLabel: string
    icon: ReactNode
    external?: boolean
    multiline?: boolean
}

type FindUsCardProps = {
    title: string
    items: FindUsContactItem[]
    /** Rendered as one wrapping icon row, so eight networks do not become eight rows. */
    socials?: SocialLinkView[]
    socialsLabel?: string
    hideSocialHandles?: boolean
}

const ROW_CLASS =
    "group flex items-center gap-3 p-3 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised transition-all duration-200 hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C17F3A] dark:focus-visible:outline-wg-dark-accent"

export function FindUsCard({ title, items, socials = [], socialsLabel, hideSocialHandles }: FindUsCardProps) {
    return (
        <div className="p-6 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border">
            <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-4">
                {title}
            </h3>
            <ul className="space-y-2">
                {items.map((item) => (
                    <li key={item.key}>
                        <a
                            href={item.href}
                            aria-label={item.ariaLabel}
                            className={ROW_CLASS}
                            {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                            <span className="w-9 h-9 flex-shrink-0 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/15 flex items-center justify-center text-wg-accent dark:text-wg-dark-accent [&_svg]:w-4 [&_svg]:h-4">
                                {item.icon}
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-[0.65rem] font-medium uppercase tracking-[0.14em] text-wg-muted dark:text-wg-dark-muted mb-0.5">
                                    {item.label}
                                </span>
                                <span
                                    className={`block text-sm font-medium text-wg-text dark:text-wg-dark-text group-hover:text-wg-primary dark:group-hover:text-wg-dark-primary transition-colors ${item.multiline ? "whitespace-pre-line break-words" : "truncate"}`}
                                >
                                    {item.value}
                                </span>
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
            {socials.length > 0 && (
                <div className="mt-4 pt-4 border-t border-wg-border/50 dark:border-wg-dark-border">
                    {socialsLabel && (
                        <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-wg-muted dark:text-wg-dark-muted mb-3">
                            {socialsLabel}
                        </p>
                    )}
                    <SocialLinks links={socials} size="sm" hideHandles={hideSocialHandles} />
                </div>
            )}
        </div>
    )
}
