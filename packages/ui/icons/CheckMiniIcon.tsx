import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Small check mark on a 12px grid. */
export function CheckMiniIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 12 12" fill="none" aria-hidden={hiddenFromReaders(props)} {...props}>
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}
