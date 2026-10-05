import { LineIcon, type IconProps } from "./LineIcon"

/** Cross: close, remove, dismiss. */
export function CloseIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M6 18L18 6M6 6l12 12" />
        </LineIcon>
    )
}
