import { LineIcon, type IconProps } from "./LineIcon"

/** Warning triangle with a bar and no dot. */
export function ExclamationTriangleBarIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.236c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0l8.354 14.498z" />
        </LineIcon>
    )
}
