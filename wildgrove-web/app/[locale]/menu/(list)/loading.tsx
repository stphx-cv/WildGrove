import { PageHeroSkeleton } from "@/components/ui/PageHeroSkeleton"
import { Skeleton } from "@/components/ui/Skeleton"

export default function MenuLoading() {
    return (
        <>
            {/* Hero skeleton */}
            <PageHeroSkeleton />

            {/* Menu content skeleton */}
            <div className="py-16">
                <div className="content-wrapper">
                    {/* Category tabs */}
                    <div className="flex w-max max-w-full mx-auto gap-1 p-1 mb-10 overflow-hidden rounded-brand bg-wg-border/30 dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-9 w-24 rounded-[0.5rem] flex-shrink-0" />
                        ))}
                    </div>

                    {/* Menu grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-card border border-wg-border/50 dark:border-wg-dark-border overflow-hidden bg-wg-surface dark:bg-wg-dark-surface"
                            >
                                <Skeleton className="h-56 w-full rounded-none" />
                                <div className="p-5 space-y-3">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-5 w-16" />
                                    </div>
                                    <Skeleton className="h-3.5 w-full" />
                                    <Skeleton className="h-3.5 w-3/4" />
                                    <div className="flex gap-2 pt-1">
                                        <Skeleton className="h-5 w-14 rounded-full" />
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}
