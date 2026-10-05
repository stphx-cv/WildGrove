import { LineIcon, type IconProps } from "./LineIcon"

/** Magnifying glass drawn with a circle and a straight handle. */
export function MagnifyingGlassPlainIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
        </LineIcon>
    )
}
