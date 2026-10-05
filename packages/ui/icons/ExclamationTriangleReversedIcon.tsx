import { LineIcon, type IconProps } from "./LineIcon"

/** Warning triangle traced from the other corner, same shape as ExclamationTriangleIcon. */
export function ExclamationTriangleReversedIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h-14.71c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0L21.303 16.126zM12 15.75h.007v.008H12v-.008z" />
        </LineIcon>
    )
}
