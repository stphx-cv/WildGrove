import { LineIcon, type IconProps } from "./LineIcon"

/** Same cross as CloseIcon, strokes drawn in the opposite order. */
export function CloseReversedIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M6 6l12 12M18 6L6 18" />
        </LineIcon>
    )
}
