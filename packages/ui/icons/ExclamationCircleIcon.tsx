import { LineIcon, type IconProps } from "./LineIcon"

/** Exclamation mark inside a circle: error. */
export function ExclamationCircleIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </LineIcon>
    )
}
