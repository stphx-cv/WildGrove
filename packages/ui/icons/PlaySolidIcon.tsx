import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Filled play triangle. */
export function PlaySolidIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={hiddenFromReaders(props)} {...props}>
            <path d="M8 5.14v13.72a1 1 0 0 0 1.5.87l11-6.86a1 1 0 0 0 0-1.74l-11-6.86A1 1 0 0 0 8 5.14z" />
        </svg>
    )
}
