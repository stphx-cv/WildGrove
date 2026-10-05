type SageMarkVariant = "full" | "compact"

interface SageMarkProps {
    /** `full` keeps the back leaf for large sizes; `compact` is drawn bolder for 24px and below. */
    variant?: SageMarkVariant
    className?: string
}

/**
 * Sage's mark: a sage leaf with its midrib cut out. Single color, follows `currentColor`.
 * The same drawing ships as public/svg/sage_mark.svg for uses outside React.
 */
export function SageMark({ variant = "full", className = "" }: SageMarkProps) {
    if (variant === "compact") {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                    fill="currentColor"
                    fillRule="evenodd"
                    d="M5.4 18.6C12.74 21.44 21.22 10.42 20.4 3.6C13.58 2.78 2.56 11.26 5.4 18.6ZM7.5 16.5C9.11 17.15 16.03 9.67 17.1 6.9C14.33 7.97 6.85 14.89 7.5 16.5Z"
                />
                <path d="M5.4 18.6 3 21.2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
        )
    }

    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
                fill="currentColor"
                opacity={0.45}
                d="M7.4 16.4C9.57 13.9 6.42 8.61 3.6 7.8C2.3 10.43 4.09 16.32 7.4 16.4Z"
            />
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M6.2 17.8C12.74 20.32 20.31 10.47 19.6 4.4C13.53 3.69 3.68 11.26 6.2 17.8ZM7.81 16.19C8.97 16.44 15.63 9.43 16.92 7.08C14.57 8.37 7.56 15.03 7.81 16.19Z"
            />
            <path d="M6.2 17.8 3.8 20.6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
    )
}
