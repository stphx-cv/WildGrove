import type { ReactNode } from "react"
import { hiddenFromReaders, type IconProps } from "./iconProps"

// Base for the line icons: a 24px grid with a 1.5 stroke, so every icon sits
// next to Sage's mark as one family. All of them follow `currentColor`.
// A use can change the stroke (`strokeWidth`) and pass any other <svg> attribute.

export type { IconProps }

export function LineIcon({ strokeWidth = 1.5, children, ...rest }: IconProps & { children: ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden={hiddenFromReaders(rest)}
            {...rest}
        >
            {children}
        </svg>
    )
}
