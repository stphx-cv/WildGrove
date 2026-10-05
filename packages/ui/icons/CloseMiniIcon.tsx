import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Small cross on a 12px grid. */
export function CloseMiniIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 12 12" fill="none" aria-hidden={hiddenFromReaders(props)} {...props}>
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
}
