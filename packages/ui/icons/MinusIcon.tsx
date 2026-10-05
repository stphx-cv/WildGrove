import { LineIcon, type IconProps } from "./LineIcon"

/** Minus sign: remove one. */
export function MinusIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M5 12h14" />
        </LineIcon>
    )
}
