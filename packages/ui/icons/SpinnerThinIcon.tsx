import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Loading indicator with a thinner ring than Spinner. The use adds `animate-spin` and the size. */
export function SpinnerThinIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden={hiddenFromReaders(props)} {...props}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    )
}
