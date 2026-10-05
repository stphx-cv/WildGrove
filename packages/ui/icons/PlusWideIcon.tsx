import { LineIcon, type IconProps } from "./LineIcon"

/** Plus sign with long arms. */
export function PlusWideIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M12 4v16m8-8H4" />
        </LineIcon>
    )
}
