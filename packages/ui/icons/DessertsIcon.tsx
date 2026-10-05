import { LineIcon, type IconProps } from "./LineIcon"

/** Layered cake slice with a cherry: desserts. */
export function DessertsIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M3.5 20h17v-7L3.5 8.5Z" />
            <path d="M3.5 14h17" />
            <circle cx="7" cy="6.2" r="1.5" />
            <path d="M8 5.1c.4-1.2 1.2-2 2.3-2.4" />
        </LineIcon>
    )
}
