// ══════════════════════════════════════════════════════════════════
// The 404 screen, shared by two boundaries with different reach:
//
//   app/global-not-found.tsx   URLs that match no route. Rendered outside
//                              every layout, with a real 404 status.
//   app/[locale]/not-found.tsx notFound() thrown by a page, such as a dish
//                              slug that does not exist. Rendered inside the
//                              locale layout.
//
// Plain next/link on purpose: the global boundary renders outside the
// next-intl provider, so the localized Link cannot be used here. Callers
// pass the hrefs, prefixed or not, for the context they are in.
//
// The same goes for the texts: both boundaries pass them from the `notFound`
// and `common` messages of the locale they resolved.
// ══════════════════════════════════════════════════════════════════

import Link from "next/link"
import { ClipboardSolidIcon, HomeSolidIcon, SageMark } from "@wildgrove/ui/icons"

export interface NotFoundText {
    title: string
    description: string
    backToHome: string
    viewMenu: string
    errorFooter: string
}

export function NotFoundScreen({
    homeHref,
    menuHref,
    text,
}: {
    homeHref: string
    menuHref: string
    text: NotFoundText
}) {
    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[var(--color-wg-bg)] dark:bg-[var(--color-wg-dark-bg)]">

            {/* ── Decorative background blobs ── */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
            >
                {/* Large green glow top-left */}
                <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-[var(--color-wg-primary)] opacity-[0.07] dark:opacity-[0.12] blur-[80px]" />
                {/* Amber glow bottom-right */}
                <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-[var(--color-wg-accent)] opacity-[0.06] dark:opacity-[0.10] blur-[90px]" />
                {/* Secondary green center-right */}
                <div className="absolute top-1/2 right-0 w-[300px] h-[300px] rounded-full bg-[var(--color-wg-secondary)] opacity-[0.08] dark:opacity-[0.10] blur-[70px]" />
            </div>

            {/* ── Floating leaf decorations ── */}
            <SageMark className="absolute top-16 right-[10%] w-20 h-20 opacity-10 dark:opacity-15 text-[var(--color-wg-primary)] dark:text-[var(--color-wg-dark-primary)] animate-[float_6s_ease-in-out_infinite]" />

            <SageMark className="absolute bottom-20 left-[8%] w-14 h-14 opacity-10 dark:opacity-15 text-[var(--color-wg-accent)] dark:text-[var(--color-wg-dark-accent)] animate-[float_8s_ease-in-out_infinite_1s]" />

            <SageMark variant="compact" className="absolute top-1/3 left-[5%] w-10 h-10 opacity-[0.08] dark:opacity-[0.12] text-[var(--color-wg-secondary)] animate-[float_7s_ease-in-out_infinite_2s]" />

            {/* ── Main Card ── */}
            <div className="relative z-10 text-center px-6 max-w-xl mx-auto animate-[fadeUp_0.7s_ease_forwards]">

                {/* Brand badge */}
                <p className="font-body text-xs font-semibold tracking-[0.3em] uppercase text-[var(--color-wg-accent)] dark:text-[var(--color-wg-dark-accent)] mb-6">
                    Wild Grove
                </p>

                {/* 404 glyphs */}
                <div className="relative inline-block mb-6">
                    <span
                        className="font-display block text-[clamp(6rem,20vw,10rem)] font-bold leading-none select-none
                       text-transparent bg-clip-text
                       bg-gradient-to-br from-[var(--color-wg-primary)] via-[var(--color-wg-secondary)] to-[var(--color-wg-accent)]
                       dark:from-[var(--color-wg-dark-primary)] dark:via-[var(--color-wg-secondary)] dark:to-[var(--color-wg-dark-accent)]"
                    >
                        404
                    </span>
                    {/* Decorative leaf in the middle of "0" */}
                    <span
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                        <SageMark className="w-[clamp(2rem,5vw,3.5rem)] h-[clamp(2rem,5vw,3.5rem)] opacity-25 dark:opacity-35 text-[var(--color-wg-primary)] dark:text-[var(--color-wg-dark-primary)] animate-[float_5s_ease-in-out_infinite]" />
                    </span>
                </div>

                {/* Headline */}
                <h1 className="font-display text-[clamp(1.6rem,4vw,2.5rem)] font-semibold text-[var(--color-wg-text)] dark:text-[var(--color-wg-dark-text)] mb-4 leading-tight">
                    {text.title}
                </h1>

                {/* Subtext */}
                <p className="font-body text-base text-[var(--color-wg-muted)] dark:text-[var(--color-wg-dark-muted)] mb-10 max-w-md mx-auto leading-relaxed">
                    {text.description}
                </p>

                {/* Divider with leaf icon */}
                <div className="flex items-center justify-center gap-3 mb-10">
                    <span className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--color-wg-border)] dark:to-[var(--color-wg-dark-border)]" />
                    <SageMark variant="compact" className="w-4 h-4 text-[var(--color-wg-secondary)] dark:text-[var(--color-wg-dark-muted)]" />
                    <span className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--color-wg-border)] dark:to-[var(--color-wg-dark-border)]" />
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                        href={homeHref}
                        id="not-found-home-cta"
                        className="inline-flex items-center gap-2 px-7 py-3 rounded-[var(--radius-brand)]
                       bg-[var(--color-wg-accent)] hover:bg-[var(--color-wg-accent-hover)]
                       text-white font-body font-medium text-sm tracking-wide
                       shadow-[var(--shadow-elevated)] dark:shadow-[var(--shadow-glow-md)]
                       transition-all duration-300 ease-out hover:scale-[1.03] hover:shadow-[var(--shadow-glow-lg)]"
                    >
                        <HomeSolidIcon className="w-4 h-4" />
                        {text.backToHome}
                    </Link>

                    <Link
                        href={menuHref}
                        id="not-found-menu-cta"
                        className="inline-flex items-center gap-2 px-7 py-3 rounded-[var(--radius-brand)]
                       border border-[var(--color-wg-border)] dark:border-[var(--color-wg-dark-border)]
                       text-[var(--color-wg-text)] dark:text-[var(--color-wg-dark-text)]
                       bg-[var(--color-wg-surface)] dark:bg-[var(--color-wg-dark-surface)]
                       hover:bg-[var(--color-wg-primary)] hover:text-white hover:border-transparent
                       dark:hover:bg-[var(--color-wg-dark-raised)] dark:hover:text-[var(--color-wg-dark-accent)]
                       font-body font-medium text-sm tracking-wide
                       transition-all duration-300 ease-out hover:scale-[1.03]"
                    >
                        <ClipboardSolidIcon className="w-4 h-4" />
                        {text.viewMenu}
                    </Link>
                </div>

                {/* Subtle footer note */}
                <p className="font-body text-xs text-[var(--color-wg-muted)] dark:text-[var(--color-wg-dark-muted)] mt-12 opacity-60">
                    {text.errorFooter}
                </p>
            </div>
        </div>
    )
}
