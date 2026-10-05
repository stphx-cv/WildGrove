import { Link } from "@/i18n/routing"
import { WildGroveLogo } from "@wildgrove/ui/WildGroveLogo"
import { getTranslations } from "next-intl/server"
import { NavLinks } from "@/components/layout/NavLinks"
import { HeaderInteractive } from "@/components/layout/HeaderInteractive"
import { getAppSettings } from "@wildgrove/core/settings"
import {
    formatPhoneForDisplay,
    googleMapsExternalUrl,
    telHrefFromDisplay,
    trimmedContact,
} from "@wildgrove/core/public-contact"
import { resolveSocialLinks } from "@wildgrove/core/social-links"

// This is a Server Component but it no longer reads auth cookies — the signed-in
// user is resolved in the browser by <HeaderInteractive> (via /api/me). That
// keeps the shared layout (and therefore public routes) free of per-request
// dynamic APIs, so they can be statically rendered and prefetched. getAppSettings
// is cache-backed (not a dynamic API), so it does not opt the route into dynamic.
export async function Header() {
    const t = await getTranslations("nav")

    const settings = await getAppSettings()
    const address = trimmedContact(settings.contactAddress)
    const phone = formatPhoneForDisplay(trimmedContact(settings.contactPhone))
    // Labels are resolved here because <MobileNav> renders them in the browser.
    const socials = resolveSocialLinks(settings.socialLinks).map((link) => ({
        ...link,
        ariaLabel: t("openSocial", { network: link.label }),
    }))
    const mobileVisitInfo =
        address || phone || socials.length > 0
            ? {
                  address,
                  mapsUrl: address ? googleMapsExternalUrl(address) : null,
                  phone,
                  telHref: phone ? telHrefFromDisplay(phone) : null,
                  socials,
                  hideSocialHandles: settings.socialLinks.hideHandles,
              }
            : undefined

    const NAV_LINKS = [
        { href: "/menu", label: t("menu") },
        { href: "/reservations", label: t("reservations") },
        { href: "/about", label: t("about") },
        { href: "/contact", label: t("contact") },
    ]

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-wg-border/50 dark:border-wg-dark-border bg-wg-bg/80 dark:bg-wg-dark-bg/80 backdrop-blur-md">
            <div className="content-wrapper flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] h-16">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group md:justify-self-start">
                    <WildGroveLogo
                        size="md"
                        className="transition-transform group-hover:rotate-12"
                        priority
                    />
                    <span className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">
                        Wild Grove
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-8">
                    <NavLinks links={NAV_LINKS} />
                </nav>

                {/* Right section — client island; resolves auth in the browser */}
                <div className="md:justify-self-end">
                    <HeaderInteractive links={NAV_LINKS} visitInfo={mobileVisitInfo} />
                </div>
            </div>
        </header>
    )
}
