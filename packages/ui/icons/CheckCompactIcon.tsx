import { LineIcon, type IconProps } from "./LineIcon"

/** Check mark with a shorter stem than CheckIcon. */
export function CheckCompactIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M5 13l4 4L19 7" />
        </LineIcon>
    )
}
