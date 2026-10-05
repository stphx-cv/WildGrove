import { LineIcon, type IconProps } from "./LineIcon"

/** Serving cloche: a dish without a photo, or a menu still on its way. */
export function ClocheIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M3 18h18" />
            <path d="M4.5 18a7.5 7.5 0 0 1 15 0" />
            <path d="M12 10.5V8.5" />
            <path d="M10.5 8h3" />
            <path d="M8.2 14.2a4.6 4.6 0 0 1 2.3-1.6" />
        </LineIcon>
    )
}
