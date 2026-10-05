import { LineIcon, type IconProps } from "./LineIcon"

/** Curved arrow turning back: reply. */
export function ArrowUturnLeftIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
        </LineIcon>
    )
}
