import { LineIcon, type IconProps } from "./LineIcon"

/** Check mark inside a circle: done, success. */
export function CheckCircleIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </LineIcon>
    )
}
