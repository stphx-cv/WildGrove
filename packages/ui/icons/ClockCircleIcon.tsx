import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Clock drawn as a circle with a hand path. Its circle has butt caps, so it keeps its own svg. */
export function ClockCircleIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden={hiddenFromReaders(props)} {...props}>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
        </svg>
    )
}
