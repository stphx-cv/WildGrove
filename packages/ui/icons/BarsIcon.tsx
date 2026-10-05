import { LineIcon, type IconProps } from "./LineIcon"

/** Three horizontal bars: menu. */
export function BarsIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </LineIcon>
    )
}
