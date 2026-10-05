import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Filled pause bars. */
export function PauseSolidIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={hiddenFromReaders(props)} {...props}>
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
    )
}
