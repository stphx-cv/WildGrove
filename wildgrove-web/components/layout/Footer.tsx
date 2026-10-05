import { Link } from "@/i18n/routing"
import { WildGroveLogo } from "@wildgrove/ui/WildGroveLogo"
import { getTranslations } from "next-intl/server"
import { PortfolioDisclosure } from "@/components/layout/PortfolioDisclosure"
import { getAppSettings } from "@wildgrove/core/settings"
import { resolveSocialLinks } from "@wildgrove/core/social-links"
import { SocialLinks } from "@wildgrove/ui/social/SocialLinks"

export async function Footer() {
    const t = await getTranslations("footer")
    const tNav = await getTranslations("nav")

    const settings = await getAppSettings()
    const hideHandles = settings.socialLinks.hideHandles
    const socialLinks = resolveSocialLinks(settings.socialLinks).map((link) => ({
        ...link,
        ariaLabel: tNav("openSocial", { network: link.label }),
    }))

    const FOOTER_LINKS = {
        wildGrove: [
            { href: "/menu", label: t("menu") },
            { href: "/about", label: t("about") },
        ],
        visitUs: [
            { href: "/reservations", label: t("reservations") },
            { href: "/contact", label: t("contact") },
        ],
        legal: [
            { href: "/privacy", label: t("privacyPolicy") },
            { href: "/terms", label: t("termsOfService") },
        ],
    }

    const columnHeadingClass =
        "text-sm font-semibold uppercase tracking-wider text-wg-text dark:text-wg-dark-text pb-3 mb-4 border-b border-wg-border/60 dark:border-wg-dark-border"

    const linkColumnDividerLg =
        "lg:border-l lg:border-wg-border/70 lg:dark:border-wg-dark-border lg:pl-8"

    const linkColumnDividerSmAndLg =
        "sm:border-l sm:border-wg-border/70 sm:dark:border-wg-dark-border sm:pl-6 lg:border-l lg:pl-8"

    return (
        <footer className="border-t border-wg-border dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface">
            <div className="content-wrapper py-6 sm:py-16 md:py-24">

                {/* Desktop/tablet: full columns layout */}
                <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                    {/* Brand column */}
                    <div className="sm:col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <WildGroveLogo size="sm" />
                            <span className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">
                                Wild Grove
                            </span>
                        </div>
                        {socialLinks.length > 0 && (
                            <div className="mt-6">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-3">
                                    {t("followUs")}
                                </h3>
                                <SocialLinks links={socialLinks} size="sm" hideHandles={hideHandles} />
                            </div>
                        )}
                    </div>

                    {/* Wild Grove links */}
                    <div className={linkColumnDividerLg}>
                        <h3 className={columnHeadingClass}>
                            {t("wildGrove")}
                        </h3>
                        <ul className="space-y-3">
                            {FOOTER_LINKS.wildGrove.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Visit Us links */}
                    <div className={linkColumnDividerSmAndLg}>
                        <h3 className={columnHeadingClass}>
                            {t("visitUs")}
                        </h3>
                        <ul className="space-y-3">
                            {FOOTER_LINKS.visitUs.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal links */}
                    <div
                        className={`${linkColumnDividerLg} sm:col-span-2 lg:col-span-1 sm:border-t sm:border-l-0 sm:pt-8 sm:mt-2 lg:border-t-0 lg:pt-0 lg:mt-0`}
                    >
                        <h3 className={columnHeadingClass}>
                            {t("legal")}
                        </h3>
                        <ul className="space-y-3">
                            {FOOTER_LINKS.legal.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Mobile: compact — social row, legal links, copyright */}
                <div className="sm:hidden flex flex-col items-center gap-4 py-2">
                    {socialLinks.length > 0 && (
                        <SocialLinks links={socialLinks} size="md" className="justify-center" hideHandles={hideHandles} />
                    )}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {FOOTER_LINKS.legal.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 text-sm font-medium rounded-brand border border-wg-primary/35 dark:border-wg-dark-primary/45 text-wg-primary dark:text-wg-dark-primary bg-transparent hover:border-wg-primary dark:hover:border-wg-dark-primary active:scale-[0.98] transition-colors"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                    <PortfolioDisclosure variant="footer" />
                    <p className="text-center text-xs text-wg-muted dark:text-wg-dark-muted">
                        {t("copyright", { year: new Date().getFullYear() })}
                    </p>
                </div>

                {/* Demo notice and copyright — desktop only */}
                <div className="hidden sm:block mt-12 pt-8 border-t border-wg-border dark:border-wg-dark-border space-y-2">
                    <PortfolioDisclosure variant="footer" />
                    <p className="text-center text-xs text-wg-muted dark:text-wg-dark-muted">
                        {t("copyright", { year: new Date().getFullYear() })}
                    </p>
                </div>
            </div>
        </footer>
    )
}
