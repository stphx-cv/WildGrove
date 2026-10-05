import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Loading ring with an arrow head, for retrying. */
export function SpinnerArrowsIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden={hiddenFromReaders(props)} {...props}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
    )
}
