import { LineIcon, type IconProps } from "./LineIcon"

/** Four corner arrows pointing in: shrink. */
export function MinimizeIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
        </LineIcon>
    )
}
