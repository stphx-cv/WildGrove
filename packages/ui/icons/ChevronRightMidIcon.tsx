import { LineIcon, type IconProps } from "./LineIcon"

/** Chevron pointing right, a little smaller than ChevronRightIcon. */
export function ChevronRightMidIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M9 5l7 7-7 7" />
        </LineIcon>
    )
}
