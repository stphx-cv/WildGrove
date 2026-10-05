import { LineIcon, type IconProps } from "./LineIcon"

/** Bin with a lid and vertical slats. */
export function TrashSlatsIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="m14.74 9-.346 9m-4.008 0L9.25 9m4.008 0h3.748M5.25 9h13.5m-14.25 0l-.621 10.5A2.25 2.25 0 007.29 21h9.42a2.25 2.25 0 002.214-1.96L18.75 9M5.25 9l1.06-4.77A2.25 2.25 0 018.515 3h6.97a2.25 2.25 0 012.205 1.77L18.75 9M9 9v10.5m6-10.5V19.5" />
        </LineIcon>
    )
}
