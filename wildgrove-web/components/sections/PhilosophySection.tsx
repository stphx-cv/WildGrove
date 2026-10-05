import { SectionWrapper } from "@/components/ui/SectionWrapper"
import { getTranslations } from "next-intl/server"
import { CalendarCheckIcon, SageMark, SprigIcon } from "@wildgrove/ui/icons"

export async function PhilosophySection() {
    const t = await getTranslations("philosophy")

    const VALUES = [
        {
            icon: <SprigIcon className="w-8 h-8" />,
            iconBox: "bg-wg-primary/10 dark:bg-wg-dark-primary/15 text-wg-primary dark:text-wg-dark-primary",
            title: t("plantForwardTitle"),
            description: t("plantForwardDesc"),
        },
        {
            icon: <CalendarCheckIcon className="w-8 h-8" />,
            iconBox: "bg-wg-primary/10 dark:bg-wg-dark-primary/15 text-wg-primary dark:text-wg-dark-primary",
            title: t("locallySourcedTitle"),
            description: t("locallySourcedDesc"),
        },
        {
            // Sage keeps the same light tile it wears in the chat.
            icon: <SageMark className="w-8 h-8" />,
            iconBox: "bg-wg-secondary dark:bg-wg-secondary text-wg-primary dark:text-wg-primary",
            title: t("zeroWasteTitle"),
            description: t("zeroWasteDesc"),
        },
    ]

    return (
        <SectionWrapper className="bg-wg-bg dark:bg-wg-dark-surface grain-overlay">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <div>
                    <blockquote className="relative">
                        <span className="absolute -top-6 -left-3 text-7xl font-display text-wg-secondary/30 dark:text-wg-dark-primary/20 leading-none select-none">
                            &ldquo;
                        </span>
                        <p className="font-display text-2xl sm:text-3xl italic text-wg-text dark:text-wg-dark-text leading-snug pl-4 relative z-10">
                            {t("quote")}
                        </p>
                        <footer className="mt-6 pl-4">
                            <p className="text-sm font-medium text-wg-accent dark:text-wg-dark-accent">
                                {t("quoteAttribution")}
                            </p>
                        </footer>
                    </blockquote>
                </div>

                <div className="space-y-8">
                    {VALUES.map((value, index) => (
                        <div
                            key={index}
                            className="flex gap-4"
                            data-animate=""
                            style={{ transitionDelay: `${index * 150}ms` }}
                        >
                            <div className={`flex-shrink-0 w-14 h-14 rounded-brand flex items-center justify-center ${value.iconBox}`}>
                                {value.icon}
                            </div>
                            <div>
                                <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-1">
                                    {value.title}
                                </h3>
                                <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                    {value.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    )
}
