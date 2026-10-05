import { FadeInImage } from "@wildgrove/ui/FadeInImage"

interface ReviewerAvatarProps {
    name: string
    avatarUrl: string | null
    size?: "sm" | "md" | "lg"
    shape?: "rounded" | "circle"
    className?: string
}

const SIZES = {
    sm: { box: "w-10 h-10", text: "text-xs" },
    md: { box: "w-12 h-12", text: "text-sm" },
    lg: { box: "w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem]", text: "text-base" },
} as const

function initialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function ReviewerAvatar({
    name,
    avatarUrl,
    size = "md",
    shape = "rounded",
    className,
}: ReviewerAvatarProps) {
    const { box, text } = SIZES[size]
    const radius = shape === "circle" ? "rounded-full" : "rounded-brand"
    const ring =
        "ring-2 ring-wg-accent/35 dark:ring-wg-dark-accent/45 ring-offset-2 ring-offset-wg-surface dark:ring-offset-wg-dark-raised"
    const imageSizes = size === "lg" ? "72px" : size === "md" ? "48px" : "40px"

    if (avatarUrl) {
        return (
            <div className={`relative shrink-0 overflow-hidden ${radius} ${box} ${ring} ${className ?? ""}`}>
                <FadeInImage
                    src={avatarUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes={imageSizes}
                />
            </div>
        )
    }

    return (
        <div
            className={`shrink-0 flex items-center justify-center font-semibold text-white ${radius} ${box} ${text} ${ring} ${className ?? ""}`}
            style={{ background: "linear-gradient(135deg, #3A5A40, #C17F3A)" }}
            aria-hidden="true"
        >
            {initialsFromName(name)}
        </div>
    )
}
