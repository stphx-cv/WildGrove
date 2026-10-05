import { LineIcon, type IconProps } from "./LineIcon"

/** Chevron pointing down. */
export function ChevronDownIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </LineIcon>
    )
}
