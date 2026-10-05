import type { ReactNode } from "react"
import { Link } from "@/i18n/routing"
import { getTranslations } from "next-intl/server"
import { SectionWrapper } from "@/components/ui/SectionWrapper"
import { ScrollAnimator } from "@/components/ui/ScrollAnimator"
import { getEnvFallbackContactEmail } from "@wildgrove/core/public-contact"
import { SITE_REPO_URL } from "@wildgrove/core/site-creator"
import { ArrowLeftIcon } from "@wildgrove/ui/icons"

const CONTACT_EMAIL = getEnvFallbackContactEmail()

export interface LegalSection {
    id: string
    // Keys under `sections.<id>.items`, rendered as a bulleted list after the body
    items?: string[]
}

interface LegalDocumentProps {
    namespace: "privacy" | "terms"
    sections: LegalSection[]
    crossLink: { href: "/privacy" | "/terms"; label: string }
}

const inlineLink = "text-wg-primary dark:text-wg-dark-primary hover:underline font-medium"

const richTags = {
    strong: (chunks: ReactNode) => <strong className="font-semibold text-wg-text dark:text-wg-dark-text">{chunks}</strong>,
    email: (chunks: ReactNode) => <a href={`mailto:${CONTACT_EMAIL}`} className={inlineLink}>{chunks}</a>,
    repo: (chunks: ReactNode) => <a href={SITE_REPO_URL} target="_blank" rel="noopener noreferrer" className={inlineLink}>{chunks}</a>,
}

export async function LegalDocument({ namespace, sections, crossLink }: LegalDocumentProps) {
    const t = await getTranslations(namespace)

    const nav = [
        ...sections.map((s) => ({ id: s.id, title: t(`sections.${s.id}.title`) })),
        { id: "contact", title: t("sections.contact.title") },
    ]

    return (
        <>
            <ScrollAnimator />

            {/* -- Hero Banner ------------------------------------------ */}
            <section className="relative bg-wg-primary dark:bg-[#0E1A12] overflow-hidden">
                {/* Decorative grain */}
                <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "url('/svg/noise.svg')", backgroundRepeat: "repeat" }} />
                {/* Decorative circle */}
                <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
                <div className="absolute -left-16 bottom-0 w-64 h-64 rounded-full bg-wg-accent/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 content-wrapper pt-24 pb-12 md:pt-28 md:pb-20">
                    <div className="flex items-center gap-2 text-white/50 text-xs font-medium uppercase tracking-widest mb-6">
                        <Link href="/" className="hover:text-white/80 transition-colors">{t("breadcrumbHome")}</Link>
                        <span>/</span>
                        <span className="text-white/70">{t("heroTitle")}</span>
                    </div>
                    <div className="max-w-2xl">
                        <p className="text-wg-secondary dark:text-wg-dark-secondary text-sm font-medium uppercase tracking-[0.2em] mb-3">
                            {t("heroLabel")}
                        </p>
                        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight mb-4">
                            {t("heroTitle")}
                        </h1>
                        <p className="text-white/60 text-sm">
                            {t("lastUpdated")}
                        </p>
                    </div>
                </div>
            </section>

            {/* -- Body ------------------------------------------------- */}
            <SectionWrapper className="bg-wg-bg dark:bg-wg-dark-bg" animate={false}>
                <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">

                    {/* Sticky sidebar -- table of contents */}
                    <aside className="hidden lg:block w-56 flex-shrink-0">
                        <div className="sticky top-24 space-y-1" data-animate="">
                            <p className="text-xs font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted mb-4">
                                {t("sidebarTitle")}
                            </p>
                            {nav.map((s) => (
                                <a
                                    key={s.id}
                                    href={`#${s.id}`}
                                    className="block text-sm py-1.5 px-3 rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary hover:bg-wg-primary/5 dark:hover:bg-wg-dark-primary/10 transition-colors duration-150"
                                >
                                    {s.title}
                                </a>
                            ))}

                            {/* Back link */}
                            <div className="pt-6 border-t border-wg-border/50 dark:border-wg-dark-border mt-4">
                                <Link
                                    href="/contact"
                                    className="inline-flex items-center gap-1.5 text-sm text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors"
                                >
                                    <ArrowLeftIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                    {t("sidebarContact")}
                                </Link>
                            </div>
                        </div>
                    </aside>

                    {/* Main content */}
                    <main className="flex-1 min-w-0">
                        <div className="space-y-10 max-w-2xl">

                            {sections.map((s, i) => {
                                const key = `sections.${s.id}`
                                return (
                                    <div key={s.id} className="space-y-10">
                                        <section id={s.id} className="scroll-mt-24" data-animate="" style={i > 0 ? { transitionDelay: `${i * 60}ms` } : undefined}>
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/15 flex items-center justify-center text-wg-primary dark:text-wg-dark-primary text-xs font-bold">{i + 1}</span>
                                                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">
                                                    {t(`${key}.title`)}
                                                </h2>
                                            </div>
                                            <div className="pl-10 space-y-3">
                                                <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                                    {t.rich(`${key}.body`, richTags)}
                                                </p>
                                                {s.items && (
                                                    <ul className="space-y-2">
                                                        {s.items.map((item) => (
                                                            <li key={item} className="flex items-start gap-2 text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                                                <span className="mt-2 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-wg-accent dark:bg-wg-dark-accent" />
                                                                <span>{t.rich(`${key}.items.${item}`, richTags)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {t.has(`${key}.outro`) && (
                                                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                                        {t.rich(`${key}.outro`, richTags)}
                                                    </p>
                                                )}
                                            </div>
                                        </section>

                                        <div className="border-t border-wg-border/40 dark:border-wg-dark-border" />
                                    </div>
                                )
                            })}

                            {/* Contact callout */}
                            <section id="contact" className="scroll-mt-24" data-animate="" style={{ transitionDelay: `${sections.length * 60}ms` }}>
                                <div className="p-6 rounded-card bg-gradient-to-br from-wg-primary/5 to-wg-accent/5 dark:from-wg-dark-primary/10 dark:to-wg-dark-accent/10 border border-wg-primary/10 dark:border-wg-dark-primary/20">
                                    <h2 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-2">
                                        {t("contactTitle")}
                                    </h2>
                                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed mb-4">
                                        {t("contactDescription")}
                                    </p>
                                    <a
                                        href={`mailto:${CONTACT_EMAIL}`}
                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-brand bg-wg-primary text-white hover:bg-wg-primary/90 dark:bg-wg-dark-primary dark:text-wg-dark-bg dark:hover:bg-wg-dark-primary/90 transition-colors"
                                    >
                                        {CONTACT_EMAIL}
                                    </a>
                                </div>
                            </section>

                        </div>
                    </main>
                </div>
            </SectionWrapper>

            {/* -- Bottom link bar --------------------------------------- */}
            <section className="bg-wg-surface dark:bg-wg-dark-surface border-t border-wg-border/50 dark:border-wg-dark-border">
                <div className="content-wrapper py-6 flex flex-col sm:flex-row items-center sm:justify-end gap-4 text-sm text-wg-muted dark:text-wg-dark-muted">
                    <div className="flex items-center gap-4">
                        <Link href={crossLink.href} className="hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors">
                            {crossLink.label}
                        </Link>
                        <Link href="/contact" className="hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors">
                            {t("contactLink")}
                        </Link>
                    </div>
                </div>
            </section>
        </>
    )
}
