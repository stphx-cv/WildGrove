import { LineIcon, type IconProps } from "./LineIcon"

/** Three lines, the last one shorter. */
export function BarsBottomLeftIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </LineIcon>
    )
}
