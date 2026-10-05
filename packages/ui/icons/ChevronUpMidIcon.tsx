import { LineIcon, type IconProps } from "./LineIcon"

/** Chevron pointing up, between ChevronUpIcon and a compact one in size. */
export function ChevronUpMidIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M5 15l7-7 7 7" />
        </LineIcon>
    )
}
