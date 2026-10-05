import { LineIcon, type IconProps } from "./LineIcon"

/** Two people: party size. */
export function GuestsIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <circle cx="9" cy="8.5" r="3.2" />
            <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
            <path d="M15.8 5.6a3.2 3.2 0 0 1 0 5.8" />
            <path d="M17.5 14.4a5.5 5.5 0 0 1 3 5.1" />
        </LineIcon>
    )
}
