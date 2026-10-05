import { type ReactNode } from "react"
import { PageHero } from "@/components/ui/PageHero"
import { Link } from "@/i18n/routing"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { SectionWrapper } from "@/components/ui/SectionWrapper"
import { ScrollAnimator } from "@/components/ui/ScrollAnimator"
import { ReservationFormGate } from "./ReservationFormGate"
import { getAppSettings } from "@wildgrove/core/settings"
import { normalizeTimeFormatPreference } from "@wildgrove/core/app-datetime-format"
import {
    formatPhoneForDisplay,
    googleMapsExternalUrl,
    telHrefFromDisplay,
    trimmedContact,
} from "@wildgrove/core/public-contact"
import { resolveSocialLinks } from "@wildgrove/core/social-links"
import { formatOperatingHours } from "@wildgrove/core/operating-hours"
import { buildAlternates } from "@wildgrove/core/seo/alternates"
import type { Locale } from "@/i18n/routing"
import { ContactChannelCard } from "@/app/[locale]/contact/ContactChannelCard"
import { contactChannelGridClass, getContactChannelColumnCounts } from "@wildgrove/core/contact-channel-layout"
import { FindUsCard, type FindUsContactItem } from "./FindUsCard"
import { ReservationReviewsSection } from "@/components/sections/ReservationReviewsSection"
import { ReservationIconBadge } from "./ReservationIconBadge"
import {
    BellIcon,
    ClockRightAngleIcon,
    EnvelopeIcon,
    MapPinIcon,
    PhoneIcon,
    TagIcon,
    UserGroupIcon,
} from "@wildgrove/ui/icons"

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
    const { locale } = await params
    const t = await getTranslations({ locale, namespace: "reservations" })
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
        alternates: buildAlternates("/reservations", locale),
    }
}

export default async function ReservationsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("reservations")
    const tNav = await getTranslations("nav")
    const settings = await getAppSettings()
    const address = trimmedContact(settings.contactAddress)
    const phone = formatPhoneForDisplay(trimmedContact(settings.contactPhone))
    const publicEmail = trimmedContact(settings.publicContactEmail)
    const telHref = phone ? telHrefFromDisplay(phone) : ""
    const socialLinks = resolveSocialLinks(settings.socialLinks).map((link) => ({
        ...link,
        ariaLabel: tNav("openSocial", { network: link.label }),
    }))
    const showFindUsCard = !!(address || phone || publicEmail || socialLinks.length > 0)
    const hourLines = formatOperatingHours(settings, locale === "es" ? "es" : "en")

    const findUsItems: FindUsContactItem[] = []
    if (address) {
        findUsItems.push({
            key: "location",
            label: t("findUsLocationLabel"),
            value: address,
            href: googleMapsExternalUrl(address),
            ariaLabel: t("findUsAddressAria", { address }),
            icon: <MapPinIcon className="w-6 h-6" />,
            external: true,
            multiline: true,
        })
    }
    if (phone && telHref) {
        findUsItems.push({
            key: "phone",
            label: t("findUsPhoneLabel"),
            value: phone,
            href: `tel:${telHref}`,
            ariaLabel: t("findUsPhoneAria", { phone }),
            icon: <PhoneIcon className="w-6 h-6" />,
        })
    }
    if (publicEmail) {
        findUsItems.push({
            key: "email",
            label: t("findUsEmailLabel"),
            value: publicEmail,
            href: `mailto:${publicEmail}`,
            ariaLabel: t("findUsEmailAria", { email: publicEmail }),
            icon: <EnvelopeIcon className="w-6 h-6" />,
        })
    }

    const INFO_CARDS: {
        key: string
        icon: ReactNode
        title: string
        lines: string[]
        href: string
        external?: boolean
        ariaLabel: string
    }[] = []

    if (hourLines.length > 0) {
        INFO_CARDS.push({
            key: "hours",
            icon: <ClockRightAngleIcon className="w-6 h-6" />,
            title: t("hoursTitle"),
            lines: hourLines,
            href: "#reservation-form",
            ariaLabel: t("infoStripHoursAria"),
        })
    }
    if (address) {
        INFO_CARDS.push({
            key: "location",
            icon: <MapPinIcon className="w-6 h-6" />,
            title: t("findUsLocationLabel"),
            lines: [address],
            href: googleMapsExternalUrl(address),
            external: true,
            ariaLabel: t("findUsAddressAria", { address }),
        })
    } else if (phone && telHref) {
        INFO_CARDS.push({
            key: "phone",
            icon: <PhoneIcon className="w-6 h-6" />,
            title: t("findUsPhoneLabel"),
            lines: [phone],
            href: `tel:${telHref}`,
            ariaLabel: t("findUsPhoneAria", { phone }),
        })
    }
    INFO_CARDS.push({
        key: "walkins",
        icon: <UserGroupIcon className="w-6 h-6" />,
        title: t("walkInsTitle"),
        lines: [t("walkInsCardLine")],
        href: "#reservation-form",
        ariaLabel: t("infoStripWalkInsAria"),
    })

    const infoCardCount = INFO_CARDS.length
    const { sm: infoSmCols, lg: infoLgCols } = getContactChannelColumnCounts(infoCardCount)

    const POLICIES: { icon: ReactNode; title: string; text: string }[] = [
        { icon: <ClockRightAngleIcon className="w-6 h-6" />, title: t("policyArrivalTitle"), text: t("policyArrivalText") },
        { icon: <UserGroupIcon className="w-6 h-6" />, title: t("policyLargePartiesTitle"), text: t("policyLargePartiesText") },
        { icon: <TagIcon className="w-6 h-6" />, title: t("policyDietaryTitle"), text: t("policyDietaryText") },
        { icon: <BellIcon className="w-6 h-6" />, title: t("policyCancellationTitle"), text: t("policyCancellationText") },
    ]

    return (
        <>
            <ScrollAnimator />

            {/* -- Hero ------------------------------------------------- */}
            <PageHero
                imageSrc="/webp/reservations-table.webp"
                imageAlt={t("imageAlt")}
                subtitle={t("heroSubtitle")}
                title={t("heroTitle")}
            />

            {/* -- Quick info (hours, location, walk-ins) ---------------- */}
            {infoCardCount > 0 && (
                <SectionWrapper
                    className="bg-wg-surface dark:bg-wg-dark-surface !pt-8 !pb-10 md:!pt-10 md:!pb-12"
                    animate={false}
                >
                    <div className={contactChannelGridClass(infoLgCols)}>
                        {INFO_CARDS.map((card, index) => (
                            <ContactChannelCard
                                key={card.key}
                                href={card.href}
                                external={card.external}
                                ariaLabel={card.ariaLabel}
                                index={index}
                                smCols={infoSmCols}
                                lgCols={infoLgCols}
                                icon={card.icon}
                                title={card.title}
                                lines={card.lines}
                            />
                        ))}
                    </div>
                </SectionWrapper>
            )}

            {/* -- Reservation Form ------------------------------------- */}
            <SectionWrapper id="reservation-form" className="bg-wg-bg dark:bg-wg-dark-bg">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16">
                    {/* Left -- Form */}
                    <div className="lg:col-span-3" data-animate="">
                        <div className="mb-8">
                            <p className="text-wg-accent dark:text-wg-dark-accent text-sm font-medium uppercase tracking-[0.15em] mb-3">
                                {t("formSubtitle")}
                            </p>
                            <h2 className="font-display text-3xl font-bold text-wg-text dark:text-wg-dark-text mb-2">
                                {t("formTitle")}
                            </h2>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                                {t("formDescription")}
                            </p>
                        </div>

                        <div className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                            <ReservationFormGate
                                calendarEventLocation={address}
                                advanceNoticeMs={settings.advanceReservationMs}
                                maxPartySize={settings.maxPartySize}
                                largeGroupWarningFrom={settings.largeGroupWarningFrom}
                                timeSlotIncrement={settings.timeSlotIncrement}
                                operatingDays={settings.operatingDays}
                                openingTime={settings.openingTime}
                                closingTime={settings.closingTime}
                                maxDaysAhead={settings.maxDaysAhead}
                                closedTimeRanges={settings.closedTimeRanges}
                                displayTimeFormat={normalizeTimeFormatPreference(settings.timeFormat)}
                            />
                        </div>
                    </div>

                    {/* Right -- Sidebar Info */}
                    <div className="lg:col-span-2 space-y-8" data-animate="" style={{ transitionDelay: "150ms" }}>
                        {/* Location / contact — from CMS (phone, address, email, social networks) */}
                        {showFindUsCard && (
                            <FindUsCard
                                title={t("findUsTitle")}
                                items={findUsItems}
                                socials={socialLinks}
                                socialsLabel={t("findUsFollowLabel")}
                                hideSocialHandles={settings.socialLinks.hideHandles}
                            />
                        )}

                        {/* Promo/Discount Hint */}
                        <div className="p-6 pl-5 rounded-card bg-gradient-to-br from-wg-primary/5 to-wg-accent/5 dark:from-wg-dark-primary/10 dark:to-wg-dark-accent/10 border border-wg-primary/10 dark:border-wg-dark-primary/20 border-l-[3px] border-l-wg-accent dark:border-l-wg-dark-accent">
                            <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-2">
                                {t("promoTitle")}
                            </h3>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                {t.rich("promoDescription", {
                                    accent: (chunks) => <span className="font-semibold text-wg-primary dark:text-wg-dark-primary">{chunks}</span>,
                                })}
                            </p>
                        </div>

                        {/* Quick Note */}
                        <div className="p-6 pl-5 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border border-l-[3px] border-l-wg-primary/50 dark:border-l-wg-dark-primary/60">
                            <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-3">
                                {t("walkInsTitle")}
                            </h3>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                {t("walkInsDescription")}
                            </p>
                        </div>
                    </div>
                </div>
            </SectionWrapper>

            <ReservationReviewsSection />

            {/* -- Policies ---------------------------------------------- */}
            <SectionWrapper className="bg-wg-surface dark:bg-wg-dark-surface">
                <div className="text-center mb-6 sm:mb-10">
                    <p className="text-wg-accent dark:text-wg-dark-accent text-sm font-medium uppercase tracking-[0.15em] mb-3">
                        {t("policiesSubtitle")}
                    </p>
                    <h2 className="font-display text-3xl font-bold text-wg-text dark:text-wg-dark-text">
                        {t("policiesTitle")}
                    </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
                    {POLICIES.map((pol, index) => (
                        <div
                            key={pol.title}
                            className="flex items-start gap-3 p-4 sm:p-5 rounded-card bg-wg-bg dark:bg-wg-dark-raised border border-wg-border/50 dark:border-wg-dark-border"
                            data-animate=""
                            style={{ transitionDelay: `${index * 80}ms` }}
                        >
                            <div className="min-w-0 flex-1">
                                <h3 className="font-display text-sm sm:text-base font-semibold text-wg-text dark:text-wg-dark-text mb-1.5 sm:mb-2">
                                    {pol.title}
                                </h3>
                                <p className="text-xs sm:text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed text-justify">
                                    {pol.text}
                                </p>
                            </div>
                            <ReservationIconBadge icon={pol.icon} className="mb-0 shrink-0 !w-10 !h-10 sm:!w-11 sm:!h-11" />
                        </div>
                    ))}
                </div>
            </SectionWrapper>

            {/* -- Bottom CTA ------------------------------------------- */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-wg-primary via-[#2E5A35] to-wg-accent dark:from-[#1A3A20] dark:via-[#2A4A30] dark:to-[#8A6020]" />
                <div className="absolute inset-0 opacity-[0.06]">
                    <div className="w-full h-full" style={{ backgroundImage: "url('/svg/noise.svg')", backgroundRepeat: "repeat" }} />
                </div>
                <div className="relative z-10 content-wrapper section-padding text-center">
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-4">
                        {t("ctaTitle")}
                    </h2>
                    <p className="text-white/70 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
                        {t("ctaDescription")}
                    </p>
                    <Link
                        href="/contact"
                        className="inline-flex items-center justify-center px-7 py-3 text-base font-medium rounded-brand bg-white text-wg-primary hover:bg-white/90 shadow-elevated transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {t("ctaButton")}
                    </Link>
                </div>
            </section>
        </>
    )
}
