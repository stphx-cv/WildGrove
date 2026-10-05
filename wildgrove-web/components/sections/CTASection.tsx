import { Button } from "@/components/ui/Button"
import { getTranslations } from "next-intl/server"

export async function CTASection() {
    const t = await getTranslations("cta")
    const tc = await getTranslations("common")

    return (
        <section className="relative overflow-hidden">
            {/* Gradient background — works in both light and dark */}
            <div className="absolute inset-0 bg-gradient-to-br from-wg-primary via-[#2E5A35] to-wg-accent dark:from-[#1A3A20] dark:via-[#2A4A30] dark:to-[#8A6020]" />

            {/* Grain overlay */}
            <div className="absolute inset-0 opacity-[0.06]">
                <div className="w-full h-full" style={{ backgroundImage: "url('/svg/noise.svg')", backgroundRepeat: "repeat" }} />
            </div>

            {/* Content */}
            <div className="relative z-10 content-wrapper section-padding text-center">
                <p className="text-white/60 text-sm font-medium uppercase tracking-[0.15em] mb-4">
                    {t("subtitle")}
                </p>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                    {t("title1")}
                    <br />
                    <span className="italic">{t("title2")}</span>
                </h2>
                <p className="text-white/70 text-base sm:text-lg max-w-lg mx-auto mb-10 leading-relaxed">
                    {t("description")}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button href="/reservations" size="lg" className="bg-white !text-wg-primary hover:bg-white/90 dark:bg-white dark:!text-wg-primary dark:hover:bg-white/90 shadow-elevated">
                        {tc("reserveTable")}
                    </Button>
                    <Button href="/menu" variant="ghost" size="lg" className="text-white/90 hover:text-white border border-white/25 hover:bg-white/10">
                        {tc("exploreMenu")}
                    </Button>
                </div>
            </div>
        </section>
    )
}
