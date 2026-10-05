import { type ReactNode } from "react"
import { Link } from "@/i18n/routing"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { PageHero } from "@/components/ui/PageHero"
import { SectionWrapper } from "@/components/ui/SectionWrapper"
import { ScrollAnimator } from "@/components/ui/ScrollAnimator"
import { FAQAccordion } from "@/components/ui/FAQAccordion"
import { ContactChannelCard } from "./ContactChannelCard"
import { TicketFormGate } from "./TicketFormGate"
import { TicketHistoryInline } from "./TicketDynamicSections"
import { SageChatCTA } from "./SageChatCTA"
import { getContactFaqForLocale } from "@wildgrove/core/contact-faq"
import { getAppSettings } from "@wildgrove/core/settings"
import {
    formatPhoneForDisplay,
    googleMapsEmbedSrc,
    googleMapsExternalUrl,
    telHrefFromDisplay,
    trimmedContact,
} from "@wildgrove/core/public-contact"
import { resolveSocialLinks } from "@wildgrove/core/social-links"
import { SocialLinks } from "@wildgrove/ui/social/SocialLinks"
import { contactChannelGridClass, getContactChannelColumnCounts } from "@wildgrove/core/contact-channel-layout"
import { formatPublicOpeningHoursLines } from "@wildgrove/core/public-opening-hours"
import { buildAlternates } from "@wildgrove/core/seo/alternates"
import type { Locale } from "@/i18n/routing"
import {
    ClockRightAngleIcon,
    EnvelopeIcon,
    ExternalLinkIcon,
    MapPinIcon,
    PhoneIcon,
} from "@wildgrove/ui/icons"

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
    const { locale } = await params
    const t = await getTranslations({ locale, namespace: "contact" })
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
        alternates: buildAlternates("/contact", locale),
    }
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("contact")
    const tNav = await getTranslations("nav")
    const isEs = locale === "es"

    const settings = await getAppSettings()
    const address = trimmedContact(settings.contactAddress)
    const phone = formatPhoneForDisplay(trimmedContact(settings.contactPhone))
    const publicEmail = trimmedContact(settings.publicContactEmail)
    const phoneHoursNote = trimmedContact(
        locale === "es" ? settings.contactPhoneHoursNoteEs : settings.contactPhoneHoursNoteEn
    )
    const telHref = phone ? telHrefFromDisplay(phone) : ""
    const hourLines = formatPublicOpeningHoursLines(
        settings.operatingDays,
        settings.openingTime,
        settings.closingTime,
        settings.closedTimeRanges,
        settings.timeFormat,
        locale === "es" ? "es" : "en"
    )

    const visitIcon = (
        <MapPinIcon className="w-6 h-6" />
    )
    const callIcon = (
        <PhoneIcon className="w-6 h-6" />
    )
    const emailIcon = (
        <EnvelopeIcon className="w-6 h-6" />
    )
    const hoursIcon = (
        <ClockRightAngleIcon className="w-6 h-6" />
    )
    // Every active network, in catalog order, as its own block below the
    // channel cards: eight of them would crowd out the four that matter.
    const socialLinks = resolveSocialLinks(settings.socialLinks).map((link) => ({
        ...link,
        ariaLabel: tNav("openSocial", { network: link.label }),
    }))

    const CONTACT_CHANNELS: {
        key: string
        icon: ReactNode
        title: string
        lines: string[]
        href: string
        external?: boolean
        ariaLabel: string
    }[] = []
    if (address) {
        CONTACT_CHANNELS.push({
            key: "visit",
            icon: visitIcon,
            title: t("channelVisitTitle"),
            lines: [address],
            href: googleMapsExternalUrl(address),
            external: true,
            ariaLabel: t("channelVisitAria", { address }),
        })
    }
    if (phone && telHref) {
        CONTACT_CHANNELS.push({
            key: "call",
            icon: callIcon,
            title: t("channelCallTitle"),
            lines: phoneHoursNote ? [phone, phoneHoursNote] : [phone],
            href: `tel:${telHref}`,
            ariaLabel: t("channelCallAria", { phone }),
        })
    }
    if (publicEmail) {
        CONTACT_CHANNELS.push({
            key: "email",
            icon: emailIcon,
            title: t("channelEmailTitle"),
            lines: [publicEmail],
            href: `mailto:${publicEmail}`,
            ariaLabel: t("channelEmailAria", { email: publicEmail }),
        })
    }
    if (hourLines.length > 0) {
        CONTACT_CHANNELS.push({
            key: "hours",
            icon: hoursIcon,
            title: t("channelHoursTitle"),
            lines: [...hourLines],
            href: "/reservations",
            ariaLabel: t("channelHoursAria"),
        })
    }

    // The phone, the email and the networks are real; the address and the
    // hours belong to the fictional restaurant. Each group has its own title.
    const REAL_CHANNELS = CONTACT_CHANNELS.filter((ch) => ch.key === "call" || ch.key === "email")
    const IMAGINED_CHANNELS = CONTACT_CHANNELS.filter((ch) => ch.key === "visit" || ch.key === "hours")
    const realCols = getContactChannelColumnCounts(REAL_CHANNELS.length)
    const imaginedCols = getContactChannelColumnCounts(IMAGINED_CHANNELS.length)

    const FAQ_ITEMS = getContactFaqForLocale(locale)

    return (
        <>
            <ScrollAnimator />

            {/* -- Hero ------------------------------------------------- */}
            <PageHero
                imageSrc="/webp/contact-entrance.webp"
                imageAlt={t("imageAlt")}
                subtitle={t("heroSubtitle")}
                title={t("heroTitle")}
            />

            {/* -- Real channels: phone, email and networks ------------------ */}
            {(REAL_CHANNELS.length > 0 || socialLinks.length > 0) && (
                <SectionWrapper className="bg-wg-surface dark:bg-wg-dark-surface">
                    <div className="max-w-5xl mx-auto text-center mb-8 sm:mb-10" data-animate="">
                        <h2 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text mb-2">
                            {t("writeTitle")}
                        </h2>
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                            {t("writeDescription")}
                        </p>
                    </div>

                    {REAL_CHANNELS.length > 0 && (
                        <div className={contactChannelGridClass(realCols.lg)}>
                            {REAL_CHANNELS.map((ch, index) => (
                                <ContactChannelCard
                                    key={ch.key}
                                    href={ch.href}
                                    external={ch.external}
                                    ariaLabel={ch.ariaLabel}
                                    index={index}
                                    smCols={realCols.sm}
                                    lgCols={realCols.lg}
                                    icon={ch.icon}
                                    title={ch.title}
                                    lines={ch.lines}
                                />
                            ))}
                        </div>
                    )}

                    {socialLinks.length > 0 && (
                        <div className="mt-10 sm:mt-12 max-w-5xl mx-auto text-center" data-animate="">
                            <h3 className="font-display text-xl font-bold text-wg-text dark:text-wg-dark-text mb-2">
                                {t("followTitle")}
                            </h3>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-6">
                                {t("followDescription")}
                            </p>
                            <SocialLinks
                                links={socialLinks}
                                variant="pill"
                                hideHandles={settings.socialLinks.hideHandles}
                            />
                        </div>
                    )}
                </SectionWrapper>
            )}

            {/* -- Contact form + sidebar ------------------------------------ */}
            <SectionWrapper className="bg-wg-bg dark:bg-wg-dark-bg">
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
                            <TicketFormGate />
                        </div>
                    </div>

                    {/* Right -- Sidebar Info */}
                    <div className="lg:col-span-2 space-y-8" data-animate="" style={{ transitionDelay: "150ms" }}>
                        {/* Chat card — opens the chat widget, which the layout
                            mounts only while the chat is on. With the chat
                            answered only by the team it does not mention Sage */}
                        {settings.chatMode !== "off" && (
                            settings.chatMode === "staff" ? (
                                <SageChatCTA title={t("staffChatTitle")} description={t("staffChatDescription")} startLabel={t("sageStart")} />
                            ) : (
                                <SageChatCTA title={t("sageTitle")} description={t("sageDescription")} startLabel={t("sageStart")} />
                            )
                        )}

                        {/* My inquiries, inline below the chat card */}
                        <TicketHistoryInline />
                    </div>
                </div>
            </SectionWrapper>

            {/* -- The imagined restaurant: address, hours and map ----------- */}
            {(IMAGINED_CHANNELS.length > 0 || address) && (
                <SectionWrapper className="bg-wg-surface dark:bg-wg-dark-surface">
                    <div className="max-w-5xl mx-auto text-center mb-8 sm:mb-10" data-animate="">
                        <h2 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text mb-2">
                            {t("imaginedTitle")}
                        </h2>
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                            {t("imaginedDescription")}
                        </p>
                    </div>

                    {IMAGINED_CHANNELS.length > 0 && (
                        <div className={contactChannelGridClass(imaginedCols.lg)}>
                            {IMAGINED_CHANNELS.map((ch, index) => (
                                <ContactChannelCard
                                    key={ch.key}
                                    href={ch.href}
                                    external={ch.external}
                                    ariaLabel={ch.ariaLabel}
                                    index={index}
                                    smCols={imaginedCols.sm}
                                    lgCols={imaginedCols.lg}
                                    icon={ch.icon}
                                    title={ch.title}
                                    lines={ch.lines}
                                />
                            ))}
                        </div>
                    )}

                    <div className="mt-8 max-w-3xl mx-auto" data-animate="">
                        {/* Google Maps — only when address is configured in CMS */}
                        {address && (
                        <div className="rounded-card overflow-hidden border border-wg-border/50 dark:border-wg-dark-border">
                            <div className="relative aspect-[4/3]">
                                <iframe
                                    title={t("mapIframeTitle")}
                                    src={googleMapsEmbedSrc(address)}
                                    width="100%"
                                    height="100%"
                                    className="absolute inset-0 w-full h-full dark:[filter:invert(90%)_hue-rotate(180deg)_brightness(85%)_saturate(70%)]"
                                    style={{ border: 0 }}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                />
                            </div>
                            <div className="flex items-center justify-between px-4 py-3 bg-wg-surface dark:bg-wg-dark-surface border-t border-wg-border/50 dark:border-wg-dark-border">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text whitespace-pre-line break-words">
                                        {address}
                                    </p>
                                </div>
                                <a
                                    href={googleMapsExternalUrl(address)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-3 flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-brand bg-wg-primary/10 text-wg-primary hover:bg-wg-primary/20 dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary dark:hover:bg-wg-dark-primary/25 transition-colors"
                                >
                                    <ExternalLinkIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                    {t("openInMaps")}
                                </a>
                            </div>
                        </div>
                        )}
                    </div>
                </SectionWrapper>
            )}

            {/* -- FAQ (static, lib/contact-faq.ts) ------------------- */}
            <SectionWrapper className="bg-wg-bg dark:bg-wg-dark-bg">
                    <div className="max-w-3xl mx-auto">
                        <div className="text-center mb-10">
                            <p className="text-wg-accent dark:text-wg-dark-accent text-sm font-medium uppercase tracking-[0.15em] mb-3">
                                {t("faqSubtitle")}
                            </p>
                            <h2 className="font-display text-3xl font-bold text-wg-text dark:text-wg-dark-text">
                                {t("faqTitle")}
                            </h2>
                        </div>

                        <FAQAccordion items={FAQ_ITEMS} />
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
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                        <Link
                            href="/reservations"
                            className="inline-flex w-full sm:w-auto items-center justify-center px-7 py-3 text-base font-medium rounded-brand bg-white text-wg-primary hover:bg-white/90 shadow-elevated transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {t("ctaButton")}
                        </Link>
                        <Link
                            href="/menu"
                            className="inline-flex w-full sm:w-auto items-center justify-center px-7 py-3 text-base font-medium rounded-brand border border-white/70 text-white hover:bg-white/10 hover:border-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {t("ctaMenuButton")}
                        </Link>
                    </div>
                </div>
            </section>
        </>
    )
}
