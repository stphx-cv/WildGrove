import { SolidIcon } from "./SolidIcon"
import type { IconProps } from "./iconProps"

/** Filled push pin on a 20px grid. */
export function PinSolidIcon(props: IconProps) {
    return (
        <SolidIcon {...props}>
            <path d="M9.63 1.09a1.5 1.5 0 0 1 2.12.26l1.12 1.4a1.5 1.5 0 0 1-.26 2.12l-.7.56v1.07a4 4 0 0 1-1.06 2.72L8.5 12.5v4.25a.75.75 0 0 1-1.5 0V12.5L3.19 9.22A4 4 0 0 1 2.13 6.5V5.43l-.7-.56a1.5 1.5 0 0 1-.26-2.12l1.12-1.4a1.5 1.5 0 0 1 2.12-.26l.7.56h2.18l.7-.56Z" />
        </SolidIcon>
    )
}
