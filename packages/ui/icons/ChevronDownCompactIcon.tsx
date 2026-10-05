import { LineIcon, type IconProps } from "./LineIcon"

/** Chevron pointing down, narrower than ChevronDownIcon. */
export function ChevronDownCompactIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="m6 9 6 6 6-6" />
        </LineIcon>
    )
}
