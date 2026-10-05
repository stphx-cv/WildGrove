import { WildGroveLogo } from "@wildgrove/ui/WildGroveLogo"
import { Skeleton } from "@/components/ui/Skeleton"

export function HeaderSkeleton() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-wg-border/50 dark:border-wg-dark-border bg-wg-bg/80 dark:bg-wg-dark-bg/80 backdrop-blur-md">
            <div className="content-wrapper flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] h-16">
                {/* Logo */}
                <div className="flex items-center gap-2 md:justify-self-start">
                    <WildGroveLogo size="md" />
                    <span className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">
                        Wild Grove
                    </span>
                </div>

                {/* Desktop nav skeleton */}
                <nav className="hidden md:flex items-center gap-8">
                    <Skeleton className="h-3.5 w-12" />
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3.5 w-12" />
                    <Skeleton className="h-3.5 w-14" />
                </nav>

                {/* Right section skeleton */}
                <div className="flex items-center gap-2 md:justify-self-end">
                    <Skeleton className="hidden md:block h-8 w-8 rounded-full" />
                    <Skeleton className="hidden md:block h-9 w-24 rounded-brand" />
                    <Skeleton className="hidden md:block h-9 w-32 rounded-brand" />
                </div>
            </div>
        </header>
    )
}
