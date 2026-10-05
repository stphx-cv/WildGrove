import { LineIcon, type IconProps } from "./LineIcon"

/** Two vertical bars, outlined. */
export function PauseIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
        </LineIcon>
    )
}
