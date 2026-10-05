import { LineIcon, type IconProps } from "./LineIcon"

/** Chevron pointing left. */
export function ChevronLeftIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M15.75 19.5L8.25 12l7.5-7.5" />
        </LineIcon>
    )
}
