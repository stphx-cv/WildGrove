import { LineIcon, type IconProps } from "./LineIcon"

/** Plus sign: add. */
export function PlusIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M12 4.5v15m7.5-7.5h-15" />
        </LineIcon>
    )
}
