import { LineIcon, type IconProps } from "./LineIcon"

/** Chevron pointing down, between ChevronDownIcon and ChevronDownCompactIcon in size. */
export function ChevronDownMidIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M19 9l-7 7-7-7" />
        </LineIcon>
    )
}
