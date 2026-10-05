import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Filled five-point star with straight edges, on a 24px grid. */
export function StarSharpIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={hiddenFromReaders(props)} {...props}>
            <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
    )
}
