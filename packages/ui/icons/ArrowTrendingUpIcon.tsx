import { LineIcon, type IconProps } from "./LineIcon"

/** Zig-zag line rising to an arrow head. */
export function ArrowTrendingUpIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
        </LineIcon>
    )
}
