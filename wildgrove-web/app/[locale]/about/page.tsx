import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { PageHero } from "@/components/ui/PageHero"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { SectionWrapper } from "@/components/ui/SectionWrapper"
import { ScrollAnimator } from "@/components/ui/ScrollAnimator"
import { AboutCreatorSection } from "@/components/about/AboutCreatorSection"
import { buildAlternates } from "@wildgrove/core/seo/alternates"
import type { Locale } from "@/i18n/routing"
import { CalendarCheckIcon, SageMark, SprigIcon } from "@wildgrove/ui/icons"

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
    const { locale } = await params
    const t = await getTranslations({ locale, namespace: "about" })
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
        alternates: buildAlternates("/about", locale),
    }
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("about")

    const BUILT_FEATURES = [
        {
            icon: <SprigIcon className="w-8 h-8" />,
            iconBox: "bg-wg-primary/10 dark:bg-wg-dark-primary/15 text-wg-primary dark:text-wg-dark-primary",
            title: t("value1Title"),
            description: t("value1Description"),
        },
        {
            icon: <CalendarCheckIcon className="w-8 h-8" />,
            iconBox: "bg-wg-primary/10 dark:bg-wg-dark-primary/15 text-wg-primary dark:text-wg-dark-primary",
            title: t("value2Title"),
            description: t("value2Description"),
        },
        {
            // Sage keeps the same light tile it wears in the chat.
            icon: <SageMark className="w-8 h-8" />,
            iconBox: "bg-wg-secondary dark:bg-wg-secondary text-wg-primary dark:text-wg-primary",
            title: t("value3Title"),
            description: t("value3Description"),
        },
    ]

    return (
        <>
            <ScrollAnimator />

            <PageHero
                imageSrc="/webp/about-dining-room.webp"
                imageAlt={t("imageAlt")}
                size="tall"
                subtitle={t("heroSubtitle")}
                title={t("heroTitle")}
            />

            <SectionWrapper id="story" className="bg-wg-bg dark:bg-wg-dark-bg">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    <div data-animate="">
                        <h2 className="font-display text-3xl font-bold text-wg-text dark:text-wg-dark-text mb-6">
                            {t("storyTitle1")} <span className="italic text-wg-primary dark:text-wg-dark-primary">{t("storyTitle2")}</span>
                        </h2>
                        <div className="space-y-4 text-wg-muted dark:text-wg-dark-muted leading-relaxed text-justify">
                            <p>{t("storyP1")}</p>
                            <p>{t("storyP2")}</p>
                            <p>{t("storyP3")}</p>
                        </div>
                    </div>
                    <div className="relative h-80 lg:h-[480px] rounded-card overflow-hidden" data-animate="" style={{ transitionDelay: "150ms" }}>
                        <FadeInImage
                            src="/webp/about-dining-room.webp"
                            alt={t("imageAlt")}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                    </div>
                </div>
            </SectionWrapper>

            <SectionWrapper className="bg-wg-surface dark:bg-wg-dark-surface">
                <div className="text-center mb-12">
                    <p className="text-wg-accent dark:text-wg-dark-accent text-sm font-medium uppercase tracking-[0.15em] mb-3">
                        {t("valuesSubtitle")}
                    </p>
                    <h2 className="font-display text-3xl sm:text-4xl font-bold text-wg-text dark:text-wg-dark-text">
                        {t("valuesTitle")}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {BUILT_FEATURES.map((feature, index) => (
                        <div
                            key={feature.title}
                            className="text-center p-6 rounded-card bg-wg-bg dark:bg-wg-dark-raised border border-wg-border/50 dark:border-wg-dark-border"
                            data-animate=""
                            style={{ transitionDelay: `${index * 100}ms` }}
                        >
                            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-[18px] mb-5 ${feature.iconBox}`}>
                                {feature.icon}
                            </div>
                            <h3 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text mb-3">
                                {feature.title}
                            </h3>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </SectionWrapper>

            <AboutCreatorSection locale={locale} />
        </>
    )
}
