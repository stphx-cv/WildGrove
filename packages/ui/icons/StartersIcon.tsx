import { LineIcon, type IconProps } from "./LineIcon"

/** Bowl with two leaves: starters. */
export function StartersIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M3 12h18" />
            <path d="M4 12a8 7.5 0 0 0 16 0" />
            <path d="M9.5 20h5" />
            <path d="M8.6 12c-.6-2.7.4-4.9 3.1-6 .6 2.7-.4 4.9-3.1 6Z" />
            <path d="M13.2 12c.3-2.2 1.9-3.6 4.3-3.9-.2 2.2-1.8 3.6-4.3 3.9Z" />
        </LineIcon>
    )
}
