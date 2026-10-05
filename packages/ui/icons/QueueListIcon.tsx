import { LineIcon, type IconProps } from "./LineIcon"

/** Three lines and a rounded bar: a list of items. */
export function QueueListIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
        </LineIcon>
    )
}
