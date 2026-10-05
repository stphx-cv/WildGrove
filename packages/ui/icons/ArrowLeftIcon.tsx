import { LineIcon, type IconProps } from "./LineIcon"

/** Arrow pointing left: back. */
export function ArrowLeftIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </LineIcon>
    )
}
