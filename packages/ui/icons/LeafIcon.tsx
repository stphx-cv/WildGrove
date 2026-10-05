import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Leaf drawn with two translucent layers and a midrib, on a 32px grid. */
export function LeafIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden={hiddenFromReaders(props)} {...props}>
            <path d="M16 2C16 2 6 10 6 18c0 5.523 4.477 10 10 10s10-4.477 10-10C26 10 16 2 16 2z" fill="currentColor" opacity="0.15" />
            <path d="M16 6c0 0-6 5.5-6 11a6 6 0 0012 0c0-5.5-6-11-6-11z" fill="currentColor" opacity="0.3" />
            <path d="M16 28V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    )
}
