import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Globe: language. Its circle has butt caps, so it keeps its own svg. */
export function GlobeIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden={hiddenFromReaders(props)} {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    )
}
