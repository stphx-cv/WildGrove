import { LineIcon, type IconProps } from "./LineIcon"

/** Clock whose hands make a right angle. ClockIcon draws the hands differently. */
export function ClockRightAngleIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </LineIcon>
    )
}
