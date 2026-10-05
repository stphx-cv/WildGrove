import { SolidIcon } from "./SolidIcon"
import type { IconProps } from "./iconProps"

/** Same person as UserSolidIcon, filled with the even-odd rule. */
export function UserSolidEvenOddIcon(props: IconProps) {
    return (
        <SolidIcon {...props}>
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </SolidIcon>
    )
}
