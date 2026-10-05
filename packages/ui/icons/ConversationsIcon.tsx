import { LineIcon, type IconProps } from "./LineIcon"

/** Two overlapping bubbles: the conversation list. */
export function ConversationsIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M9.4 6.2C10.6 4.6 12.6 3.5 15 3.5c3.31 0 6 2.24 6 5 0 1.36-.65 2.6-1.72 3.5l.72 2.5-2.62-1.12" />
            <path d="M9.5 8.5c3.59 0 6.5 2.35 6.5 5.25S13.09 19 9.5 19c-.74 0-1.45-.1-2.11-.28L4 20.5l.84-2.72C3.7 16.84 3 15.36 3 13.75 3 10.85 5.91 8.5 9.5 8.5Z" />
        </LineIcon>
    )
}
