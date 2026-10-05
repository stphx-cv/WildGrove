import { FadeInImage } from "./FadeInImage"

/** Intrinsic size of public/svg/wildgrove_logo.svg (square viewBox). */
const LOGO_SIZE = 500

type WildGroveLogoSize = "sm" | "md" | "lg"

const SIZE_PX: Record<WildGroveLogoSize, number> = {
    sm: 16,
    md: 20,
    lg: 24,
}

interface WildGroveLogoProps {
    size?: WildGroveLogoSize
    className?: string
    priority?: boolean
}

/**
 * Brand mark — square aspect ratio to match the SVG viewBox.
 * Use `size` for layout; pass `className` only for non-size effects (e.g. hover, opacity).
 */
export function WildGroveLogo({ size = "md", className = "", priority }: WildGroveLogoProps) {
    const px = SIZE_PX[size]

    return (
        <FadeInImage
            src="/svg/wildgrove_logo.svg"
            alt="Wild Grove logo"
            width={LOGO_SIZE}
            height={LOGO_SIZE}
            priority={priority}
            className={`shrink-0 ${className}`.trim()}
            style={{ width: px, height: px }}
        />
    )
}
