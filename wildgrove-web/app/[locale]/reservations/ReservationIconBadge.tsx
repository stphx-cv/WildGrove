import type { ReactNode } from "react"

type ReservationIconBadgeProps = {
    icon: ReactNode
    className?: string
}

export function ReservationIconBadge({ icon, className = "mb-3" }: ReservationIconBadgeProps) {
    return (
        <div
            className={`w-11 h-11 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/15 flex items-center justify-center text-wg-accent dark:text-wg-dark-accent ${className}`}
        >
            {icon}
        </div>
    )
}
