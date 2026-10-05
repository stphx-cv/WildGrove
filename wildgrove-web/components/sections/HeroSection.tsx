import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { getTranslations } from "next-intl/server"
import { HeroOverlay } from "@wildgrove/ui/HeroOverlay"
import { PortfolioDisclosure } from "@/components/layout/PortfolioDisclosure"

export async function HeroSection() {
    const t = await getTranslations("hero")
    const tc = await getTranslations("common")

    return (
        <section className="relative min-h-[75svh] sm:min-h-[90vh] flex items-center justify-center overflow-hidden">
            {/* Background image */}
            <div className="absolute inset-0 z-0 hero-image-wrap">
                <Image
                    src="/webp/home-dishes.webp"
                    alt={t("imageAlt")}
                    fill
                    className="object-cover"
                    priority
                    sizes="100vw"
                />
                <HeroOverlay />
            </div>

            {/* Soft transition to next section */}
            <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-40 sm:h-48
                bg-[linear-gradient(to_bottom,rgba(14,26,18,0)_0%,rgba(14,26,18,0.20)_52%,rgba(205,216,199,0.92)_76%,rgba(243,246,240,1)_90%,rgba(243,246,240,1)_100%)]
                dark:bg-[linear-gradient(to_bottom,rgba(14,26,18,0)_0%,rgba(14,26,18,0.55)_48%,rgba(14,26,18,0.92)_84%,rgba(14,26,18,1)_100%)]"
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-10 sm:h-12
                bg-[radial-gradient(110%_70%_at_50%_0%,rgba(233,238,228,0.08)_0%,rgba(233,238,228,0)_78%)]
                dark:bg-[radial-gradient(110%_70%_at_50%_0%,rgba(14,26,18,0.32)_0%,rgba(14,26,18,0)_72%)]"
                aria-hidden="true"
            />

            {/* Grain texture */}
            <div className="absolute inset-0 z-[1] opacity-[0.04]">
                <Image
                    src="/svg/noise.svg"
                    alt=""
                    fill
                    className="object-cover"
                    aria-hidden="true"
                />
            </div>

            {/* Content */}
            <div className="relative z-10 text-center px-4 sm:px-6 max-w-3xl mx-auto pt-28 pb-28 sm:pt-24 sm:pb-32">
                <p
                    className="text-white text-sm sm:text-base font-medium uppercase tracking-[0.2em] mb-6 animate-fade-up"
                    style={{ animationDelay: "0.1s" }}
                >
                    {t("subtitle")}
                </p>

                <h1
                    className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6 animate-fade-up"
                    style={{ animationDelay: "0.3s" }}
                >
                    {t("title1")}
                    <br />
                    <span className="italic text-wg-secondary">{t("title2")}</span>
                </h1>

                <p
                    className="text-white text-base sm:text-lg max-w-xl mx-auto mb-6 leading-relaxed animate-fade-up"
                    style={{ animationDelay: "0.5s" }}
                >
                    {t("description")}
                </p>

                <PortfolioDisclosure variant="hero" />

                <div
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up"
                    style={{ animationDelay: "0.7s" }}
                >
                    <Button href="/reservations" size="lg">
                        {t("tryReservation")}
                    </Button>
                    <Button href="/menu" variant="ghost" size="lg" className="text-white/90 hover:text-white hover:bg-white/10 border border-white/20">
                        {tc("viewMenu")}
                    </Button>
                </div>
            </div>
        </section>
    )
}
