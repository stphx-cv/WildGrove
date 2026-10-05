import { LineIcon, type IconProps } from "./LineIcon"

/** Check mark. */
export function CheckIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M4.5 12.75l6 6 9-13.5" />
        </LineIcon>
    )
}
