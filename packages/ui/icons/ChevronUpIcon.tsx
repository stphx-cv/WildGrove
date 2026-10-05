import { LineIcon, type IconProps } from "./LineIcon"

/** Chevron pointing up. */
export function ChevronUpIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </LineIcon>
    )
}
