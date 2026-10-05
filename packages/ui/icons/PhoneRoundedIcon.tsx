import { LineIcon, type IconProps } from "./LineIcon"

/** Phone handset drawn with arcs, rounder than PhoneIcon. */
export function PhoneRoundedIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.956 1.293a11.042 11.042 0 01-5.516-5.516l1.293-.956a1.125 1.125 0 00.417-1.173l-1.106-4.423A1.125 1.125 0 006.853 3.75H5.48A2.25 2.25 0 003.25 6v2.25z" />
        </LineIcon>
    )
}
