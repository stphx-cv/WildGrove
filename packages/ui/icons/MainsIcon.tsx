import { LineIcon, type IconProps } from "./LineIcon"

/** Plate between a fork and a knife: mains. */
export function MainsIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <circle cx="12.5" cy="12" r="4.6" />
            <path d="M3 3.5V8a1.75 1.75 0 0 0 3.5 0V3.5M4.75 3.5v17" />
            <path d="M21 20.5v-17c-1.5.8-2.2 3-2.2 5.5v3.5H21" />
        </LineIcon>
    )
}
