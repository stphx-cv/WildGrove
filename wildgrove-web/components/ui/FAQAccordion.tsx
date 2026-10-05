"use client"

import { Fragment, useState, type ReactNode } from "react"
import { Link } from "@/i18n/routing"
import { ChevronDownSolidIcon } from "@wildgrove/ui/icons"

const INLINE_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g

const linkClassName =
    "text-wg-accent dark:text-wg-dark-accent hover:text-wg-accent-hover dark:hover:text-wg-dark-accent-hover underline underline-offset-2 font-semibold transition-colors"

function renderAnswerWithLinks(text: string): ReactNode {
    const parts: ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    const re = new RegExp(INLINE_LINK_RE)

    while ((match = re.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index))
        }
        const label = match[1]
        const href = match[2]
        const key = match.index

        if (href.startsWith("http://") || href.startsWith("https://")) {
            parts.push(
                <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClassName}
                >
                    {label}
                </a>,
            )
        } else {
            parts.push(
                <Link key={key} href={href} className={linkClassName}>
                    {label}
                </Link>,
            )
        }
        lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex))
    }

    if (parts.length === 0) {
        return text
    }

    return parts.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
    ))
}

interface FAQItem {
    q: string
    a: string
}

interface FAQAccordionProps {
    items: FAQItem[]
}

export function FAQAccordion({ items }: FAQAccordionProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(null)

    const toggle = (index: number) => {
        setOpenIndex((prev) => (prev === index ? null : index))
    }

    return (
        <div className="space-y-3">
            {items.map((faq, index) => {
                const isOpen = openIndex === index
                return (
                    <div
                        key={faq.q}
                        className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised overflow-hidden transition-shadow duration-200 hover:shadow-card dark:hover:shadow-glow-sm"
                        data-animate=""
                        style={{ transitionDelay: `${index * 60}ms` }}
                    >
                        <button
                            type="button"
                            onClick={() => toggle(index)}
                            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer group"
                            aria-expanded={isOpen}
                        >
                            <h3 className="font-display text-base font-semibold text-wg-text dark:text-wg-dark-text group-hover:text-wg-primary dark:group-hover:text-wg-dark-primary transition-colors duration-200">
                                {faq.q}
                            </h3>
                            {/* Chevron */}
                            <span
                                className={`flex-shrink-0 w-5 h-5 text-wg-muted dark:text-wg-dark-muted transition-transform duration-300 ${isOpen ? "rotate-180" : "rotate-0"
                                    }`}
                            >
                                <ChevronDownSolidIcon />
                            </span>
                        </button>

                        {/* Animated answer panel */}
                        <div
                            className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                }`}
                        >
                            <div className="overflow-hidden">
                                <p className="px-5 pb-4 text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                    {renderAnswerWithLinks(faq.a)}
                                </p>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
