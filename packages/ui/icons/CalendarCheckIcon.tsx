import { LineIcon, type IconProps } from "./LineIcon"

/** Calendar with a tick: a reservation. */
export function CalendarCheckIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
            <path d="M3.5 9.5h17M8 3v4M16 3v4M9 15l2 2 4-4" />
        </LineIcon>
    )
}
