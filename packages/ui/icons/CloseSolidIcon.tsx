import { SolidIcon } from "./SolidIcon"
import type { IconProps } from "./iconProps"

/** Filled cross on a 20px grid. */
export function CloseSolidIcon(props: IconProps) {
    return (
        <SolidIcon {...props}>
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </SolidIcon>
    )
}
