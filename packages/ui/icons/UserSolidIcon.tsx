import { SolidIcon } from "./SolidIcon"
import type { IconProps } from "./iconProps"

/** Filled person on a 20px grid. */
export function UserSolidIcon(props: IconProps) {
    return (
        <SolidIcon {...props}>
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
        </SolidIcon>
    )
}
