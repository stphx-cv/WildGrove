import Image from "next/image"
import type { ReactNode } from "react"
import { HeroOverlay } from "@wildgrove/ui/HeroOverlay"

const SIZE_CLASS = {
    default: "h-[45vh] min-h-[360px]",
    tall: "h-[50vh] min-h-[400px]",
} as const

type PageHeroProps = {
    imageSrc: string
    imageAlt: string
    size?: keyof typeof SIZE_CLASS
    /** Eyebrow above the title; does not affect vertical centering of the title. */
    subtitle?: ReactNode
    title: ReactNode
}

/** Full-bleed page hero; title vertically centered in the image (subtitle floats above). */
export function PageHero({
    imageSrc,
    imageAlt,
    size = "default",
    subtitle,
    title,
}: PageHeroProps) {
    return (
        <section className={`relative overflow-hidden ${SIZE_CLASS[size]}`}>
            <div className="absolute inset-0 hero-image-wrap">
                <Image
                    src={imageSrc}
                    alt={imageAlt}
                    fill
                    className="object-cover"
                    priority
                    sizes="100vw"
                />
                <HeroOverlay />
            </div>
            <div className="absolute inset-0 z-10 flex items-center justify-center px-4 pt-16">
                <div className="relative text-center w-full max-w-5xl mx-auto">
                    <h1
                        className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white animate-fade-up"
                        style={{ animationDelay: "0.2s" }}
                    >
                        {title}
                    </h1>
                    {subtitle ? (
                        <p className="absolute bottom-full left-0 right-0 mb-4 text-white text-sm font-medium uppercase tracking-[0.2em] animate-fade-up">
                            {subtitle}
                        </p>
                    ) : null}
                </div>
            </div>
        </section>
    )
}
