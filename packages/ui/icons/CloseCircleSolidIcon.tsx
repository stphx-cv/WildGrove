import { SolidIcon } from "./SolidIcon"
import type { IconProps } from "./iconProps"

/** Filled circle with a cross cut out, on a 20px grid. */
export function CloseCircleSolidIcon(props: IconProps) {
    return (
        <SolidIcon {...props}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </SolidIcon>
    )
}
