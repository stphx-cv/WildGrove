import { LineIcon, type IconProps } from "./LineIcon"

/** Plus sign with shorter arms than PlusIcon. */
export function PlusCompactIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M12 5v14M5 12h14" />
        </LineIcon>
    )
}
