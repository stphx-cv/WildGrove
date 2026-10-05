import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Loading indicator: a faint ring with a quarter arc on top. The use adds `animate-spin` and the size. */
export function Spinner(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden={hiddenFromReaders(props)} {...props}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    )
}
