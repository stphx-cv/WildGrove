import { LineIcon, type IconProps } from "./LineIcon"

export function ClockIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
        </LineIcon>
    )
}
