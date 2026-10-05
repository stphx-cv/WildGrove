import Image from "next/image"
import { Link } from "@/i18n/routing"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { pageMetadata } from "@/i18n/messages"
import { AuthForm } from "@/components/auth/AuthForm"
import { ArrowLeftIcon, LeafIcon } from "@wildgrove/ui/icons"
import { HeroOverlay } from "@wildgrove/ui/HeroOverlay"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    // Synchronous on purpose — see i18n/messages.ts: an awaited lookup here
    // lets the HTML shell win the race and pushes <title> out of <head>.
    return pageMetadata(locale, "portal")
}

export default async function LoginPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ verified?: string; error?: string; mode?: string }>
}) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("portal")

    const sp = await searchParams
    const verified = sp.verified === 'true'
    const authError = sp.error ?? null
    const initialMode = sp.mode === 'register' ? 'register' as const : 'login' as const
    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            {/* -- Left Panel -- Hero Image + Branding -------------------- */}
            <div className="relative lg:w-[55%] xl:w-[60%] min-h-[260px] sm:min-h-[320px] lg:h-screen lg:sticky lg:top-0 overflow-hidden hero-image-wrap">
                {/* Background image */}
                <Image
                    src="/webp/portal-dining-room.webp"
                    alt={t("imageAlt")}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 1024px) 100vw, 60vw"
                />

                <HeroOverlay direction="side" />

                {/* Grain texture */}
                <div className="absolute inset-0 opacity-[0.04]">
                    <div
                        className="w-full h-full"
                        style={{ backgroundImage: "url('/svg/noise.svg')", backgroundRepeat: "repeat" }}
                    />
                </div>

                {/* Branding content */}
                <div className="relative z-10 flex flex-col justify-end h-full p-6 sm:p-8 lg:p-12 xl:p-16">
                    {/* Bottom -- Quote & Features (hidden on mobile for compact hero) */}
                    <div className="hidden lg:block mt-auto">
                        {/* Decorative line */}
                        <div className="w-12 h-0.5 bg-wg-accent/60 mb-8" />

                        <blockquote className="max-w-md">
                            <p className="font-display text-2xl xl:text-3xl font-bold text-white leading-snug mb-4">
                                {t("heroQuote")}
                            </p>
                            <p className="text-white/90 text-sm leading-relaxed max-w-sm">
                                {t("heroDescription")}
                            </p>
                        </blockquote>

                        {/* Feature pills */}
                        <div className="flex flex-wrap gap-3 mt-8">
                            {[t("tag1"), t("tag2"), t("tag3"), t("tag4")].map(
                                (tag) => (
                                    <span
                                        key={tag}
                                        className="px-3 py-1.5 text-xs font-medium text-white/70 bg-white/10 backdrop-blur-sm rounded-full border border-white/10"
                                    >
                                        {tag}
                                    </span>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* -- Right Panel -- Auth Form ------------------------------- */}
            <div className="flex-1 bg-wg-bg dark:bg-wg-dark-bg">
                <div className="min-h-full flex items-center justify-center px-4 sm:px-6 py-10 lg:pt-20 lg:pb-6">
                    <div className="w-full max-w-md">
                        {/* Mobile-only: small logo repeat (since hero is compact on mobile) */}
                        <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
                            <LeafIcon className="w-7 h-7 text-wg-primary dark:text-wg-dark-primary" />
                            <span className="font-display text-lg font-bold text-wg-text dark:text-wg-dark-text">
                                Wild Grove
                            </span>
                        </div>

                        {/* Card */}
                        <div className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card animate-fade-up">
                            <h1 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text mb-1">
                                {t("welcomeTitle")}
                            </h1>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-7">
                                {t("welcomeDescription")}
                            </p>

                            <AuthForm verified={verified} authError={authError} initialMode={initialMode} />
                        </div>

                        {/* Back to home */}
                        <p className="text-center text-xs text-wg-muted dark:text-wg-dark-muted mt-6">
                            <Link
                                href="/"
                                className="hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors inline-flex items-center gap-1.5"
                            >
                                <ArrowLeftIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                {t("backToHome")}
                            </Link>
                        </p>

                        {/* Legal links */}
                        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-wg-muted/60 dark:text-wg-dark-muted/60">
                            <Link href="/privacy" className="hover:text-wg-muted dark:hover:text-wg-dark-muted transition-colors">
                                {t("privacyPolicy")}
                            </Link>
                            <span>·</span>
                            <Link href="/terms" className="hover:text-wg-muted dark:hover:text-wg-dark-muted transition-colors">
                                {t("termsOfService")}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
