import { LineIcon, type IconProps } from "./LineIcon"

/** Chevron pointing left, a little smaller than ChevronLeftIcon. */
export function ChevronLeftMidIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M15 19l-7-7 7-7" />
        </LineIcon>
    )
}
