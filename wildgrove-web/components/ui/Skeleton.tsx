export function Skeleton({ className = "" }: { className?: string }) {
    return (
        <div
            className={`animate-pulse bg-wg-border/30 dark:bg-wg-dark-border/60 rounded ${className}`}
        />
    )
}
