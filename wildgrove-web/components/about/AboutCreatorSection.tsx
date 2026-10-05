import { getTranslations } from "next-intl/server"
import {
    SITE_CREATOR,
    SITE_CREATOR_INITIALS,
    SITE_CREATOR_PHOTO,
    getSiteCreatorProfile,
    getSiteCreatorWhatsAppUrl,
    isSiteCreatorLinkedInReady,
} from "@wildgrove/core/site-creator"
import { SocialIcon } from "@wildgrove/ui/social/SocialIcon"
import { CreatorPortrait } from "./CreatorPortrait"

type AboutCreatorSectionProps = {
    locale: string
}

export async function AboutCreatorSection({ locale }: AboutCreatorSectionProps) {
    const t = await getTranslations("about")
    const profile = getSiteCreatorProfile(locale)
    const showLinkedIn = isSiteCreatorLinkedInReady()

    return (
        <section
            id="creator"
            className="section-padding bg-wg-bg dark:bg-wg-dark-bg"
            data-animate=""
        >
            <div className="content-wrapper">
                <div className="text-center mb-10 sm:mb-12">
                    <p className="text-wg-accent dark:text-wg-dark-accent text-sm font-medium uppercase tracking-[0.15em] mb-3">
                        {t("teamSubtitle")}
                    </p>
                    <h2 className="font-display text-3xl sm:text-4xl font-bold text-wg-text dark:text-wg-dark-text">
                        {t("teamTitle")}
                    </h2>
                </div>

                <div className="relative max-w-4xl mx-auto rounded-card overflow-hidden border border-wg-border/60 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-raised shadow-elevated dark:shadow-glow-sm">
                    <div
                        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.2] pointer-events-none"
                        aria-hidden
                        style={{
                            background:
                                "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(58, 90, 64, 0.12), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(193, 127, 58, 0.1), transparent 50%)",
                        }}
                    />

                    <div className="relative p-6 sm:p-8 lg:p-10">
                        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-center lg:items-start">
                            <div className="flex-shrink-0 flex flex-col items-center lg:items-start">
                                <div className="relative">
                                    <div
                                        className="absolute -inset-1 rounded-full bg-gradient-to-br from-wg-primary via-wg-secondary/80 to-wg-accent dark:from-wg-dark-primary dark:via-wg-dark-primary/60 dark:to-wg-dark-accent opacity-80"
                                        aria-hidden
                                    />
                                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-wg-bg dark:bg-wg-dark-bg border-2 border-wg-surface dark:border-wg-dark-surface">
                                        <CreatorPortrait
                                            name={profile.name}
                                            src={SITE_CREATOR_PHOTO}
                                            initials={SITE_CREATOR_INITIALS}
                                        />
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-col items-center lg:items-start gap-2">
                                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-wg-accent/15 text-wg-accent dark:bg-wg-dark-accent/20 dark:text-wg-dark-accent">
                                        {t("portfolioBadge")}
                                    </span>
                                    <span className="text-[10px] sm:text-xs font-medium px-2.5 py-1 rounded-full bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary">
                                        {profile.school}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 min-w-0 text-center lg:text-left">
                                <h3 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text">
                                    {profile.name}
                                </h3>
                                <p className="mt-1 text-sm font-medium text-wg-accent dark:text-wg-dark-accent">
                                    {profile.role}
                                </p>
                                <p className="mt-4 text-sm sm:text-base text-wg-muted dark:text-wg-dark-muted leading-relaxed text-justify">
                                    {profile.bio}
                                </p>

                                <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
                                    {showLinkedIn && (
                                        <a
                                            href={SITE_CREATOR.linkedIn}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={t("portfolioLinkedInAria")}
                                            className="inline-flex items-center justify-center gap-2 px-3.5 py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white shadow-card hover:shadow-elevated dark:shadow-glow-sm dark:hover:shadow-glow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            <SocialIcon platform="linkedin" className="w-5 h-5" />
                                            {t("creatorLinkedInCta")}
                                        </a>
                                    )}
                                    <a
                                        href={getSiteCreatorWhatsAppUrl(locale)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={t("portfolioWhatsAppAria")}
                                        className="inline-flex items-center justify-center gap-2 px-3.5 py-3 text-sm font-medium rounded-brand border border-wg-accent/40 dark:border-wg-dark-accent/40 text-wg-accent dark:text-wg-dark-accent hover:bg-wg-accent/10 dark:hover:bg-wg-dark-accent/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <SocialIcon platform="whatsapp" className="w-5 h-5" />
                                        {t("creatorWhatsAppCta")}
                                    </a>
                                    <a
                                        href={SITE_CREATOR.instagram}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={t("portfolioInstagramAria")}
                                        className="inline-flex items-center justify-center gap-2 px-3.5 py-3 text-sm font-medium rounded-brand border border-wg-accent/40 dark:border-wg-dark-accent/40 text-wg-accent dark:text-wg-dark-accent hover:bg-wg-accent/10 dark:hover:bg-wg-dark-accent/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <SocialIcon platform="instagram" className="w-5 h-5" />
                                        {t("creatorInstagramCta")}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
