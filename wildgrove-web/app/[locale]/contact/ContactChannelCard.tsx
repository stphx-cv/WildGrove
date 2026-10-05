import type { ReactNode } from "react"
import { Link } from "@/i18n/routing"
import { contactChannelCardWidthClass } from "@wildgrove/core/contact-channel-layout"

const CARD_INTERACTIVE =
    "flex flex-row sm:flex-col sm:justify-center items-start sm:items-center text-left sm:text-center gap-3 sm:gap-0 p-4 sm:p-6 rounded-card bg-wg-bg dark:bg-wg-dark-raised border border-wg-border/50 dark:border-wg-dark-border transition-all duration-200 hover:border-wg-accent/35 dark:hover:border-wg-dark-accent/40 hover:shadow-card sm:hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C17F3A] dark:focus-visible:outline-wg-dark-accent group cursor-pointer w-full min-w-0 self-stretch sm:h-[11.5rem]"

type ContactChannelCardProps = {
    href: string
    external?: boolean
    ariaLabel: string
    index: number
    smCols: number
    lgCols: number
    icon: ReactNode
    title: string
    lines: string[]
}

function CardBody({ icon, title, lines }: Pick<ContactChannelCardProps, "icon" | "title" | "lines">) {
    const hasMultipleLines = lines.length > 1

    return (
        <>
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/15 flex items-center justify-center text-wg-accent dark:text-wg-dark-accent sm:mb-4 [&_svg]:w-5 [&_svg]:h-5 sm:[&_svg]:w-6 sm:[&_svg]:h-6 transition-colors">
                {icon}
            </div>
            <div className="min-w-0 flex-1 sm:w-full sm:flex sm:flex-col sm:items-center">
                <h3
                    className={
                        "font-display text-sm sm:text-base font-semibold text-wg-text dark:text-wg-dark-text mb-1 sm:mb-2 leading-snug w-full " +
                        (hasMultipleLines
                            ? "max-sm:whitespace-normal"
                            : "max-sm:truncate max-sm:whitespace-nowrap")
                    }
                    title={hasMultipleLines ? undefined : title}
                >
                    {title}
                </h3>
                <div className="space-y-0.5 w-full sm:min-h-[2.75rem] sm:flex sm:flex-col sm:justify-center sm:items-center">
                    {lines.map((line, lineIndex) => (
                        <p
                            key={`${lineIndex}-${line}`}
                            className={
                                "text-xs sm:text-sm text-wg-muted dark:text-wg-dark-muted leading-snug sm:leading-relaxed w-full " +
                                (hasMultipleLines
                                    ? "max-sm:whitespace-normal max-sm:break-words"
                                    : "max-sm:truncate max-sm:whitespace-nowrap")
                            }
                            title={hasMultipleLines ? undefined : line}
                        >
                            {line}
                        </p>
                    ))}
                </div>
            </div>
        </>
    )
}

export function ContactChannelCard({
    href,
    external = false,
    ariaLabel,
    index,
    smCols,
    lgCols,
    icon,
    title,
    lines,
}: ContactChannelCardProps) {
    const animateStyle = { transitionDelay: `${index * 80}ms` }
    const cardClass = `${CARD_INTERACTIVE} ${contactChannelCardWidthClass(smCols, lgCols)}`

    if (href.startsWith("/")) {
        return (
            <Link
                href={href}
                aria-label={ariaLabel}
                className={cardClass}
                data-animate=""
                style={animateStyle}
            >
                <CardBody icon={icon} title={title} lines={lines} />
            </Link>
        )
    }

    return (
        <a
            href={href}
            aria-label={ariaLabel}
            className={cardClass}
            data-animate=""
            style={animateStyle}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
            <CardBody icon={icon} title={title} lines={lines} />
        </a>
    )
}
