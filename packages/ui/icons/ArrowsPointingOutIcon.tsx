import { LineIcon, type IconProps } from "./LineIcon"

/** Two arrows pointing to opposite corners: enlarge. */
export function ArrowsPointingOutIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M13.5 10.5 21 3m0 0h-5.25M21 3v5.25M10.5 13.5 3 21m0 0h5.25M3 21v-5.25" />
        </LineIcon>
    )
}
