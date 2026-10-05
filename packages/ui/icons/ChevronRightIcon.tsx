import { LineIcon, type IconProps } from "./LineIcon"

/** Chevron pointing right. */
export function ChevronRightIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </LineIcon>
    )
}
