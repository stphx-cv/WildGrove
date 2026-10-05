import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Four corners: view full size, on a 16px grid. */
export function ExpandIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden={hiddenFromReaders(props)} {...props}>
            <path strokeLinecap="round" d="M6 2H2v4M10 2h4v4M10 14h4v-4M6 14H2v-4" />
        </svg>
    )
}
