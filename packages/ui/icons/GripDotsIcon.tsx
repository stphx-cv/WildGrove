import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Six dots in two columns: a drag handle. */
export function GripDotsIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={hiddenFromReaders(props)} {...props}>
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
        </svg>
    )
}
