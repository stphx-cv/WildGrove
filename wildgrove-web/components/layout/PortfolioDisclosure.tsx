import { getTranslations } from "next-intl/server"

interface PortfolioDisclosureProps {
    variant: "hero" | "footer"
}

/** The one notice that says Wild Grove is a demo: a block in the home hero and a line in every footer. */
export async function PortfolioDisclosure({ variant }: PortfolioDisclosureProps) {
    const t = await getTranslations("common")
    const text = t("portfolioDisclosure")

    if (variant === "footer") {
        return (
            <p className="text-center text-xs text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                {text}
            </p>
        )
    }

    return (
        <p
            className="mx-auto mb-10 max-w-md rounded-brand border border-white/20 bg-[#0E1A12]/55 px-4 py-3 text-sm leading-relaxed text-white animate-fade-up"
            style={{ animationDelay: "0.6s" }}
        >
            {text}
        </p>
    )
}
