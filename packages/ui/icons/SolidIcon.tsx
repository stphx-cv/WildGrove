import type { ReactNode } from "react"
import { hiddenFromReaders, type IconProps } from "./iconProps"

// Base for the filled icons on a 20px grid: no stroke, painted with `currentColor`.

export function SolidIcon({ children, ...rest }: IconProps & { children: ReactNode }) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden={hiddenFromReaders(rest)} {...rest}>
            {children}
        </svg>
    )
}
