import { PageHeroSkeleton } from "@/components/ui/PageHeroSkeleton"
import { Skeleton } from "@/components/ui/Skeleton"

export default function AboutLoading() {
    return (
        <>
            {/* Hero skeleton (about uses 50vh) */}
            <PageHeroSkeleton size="tall" />

            {/* Story section skeleton */}
            <div className="section-padding bg-wg-bg dark:bg-wg-dark-bg">
                <div className="content-wrapper">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                        <div className="space-y-4">
                            <Skeleton className="h-8 w-72" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/6" />
                            <Skeleton className="h-4 w-full mt-2" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                        <Skeleton className="h-80 lg:h-[480px] w-full rounded-card" />
                    </div>
                </div>
            </div>

            {/* Values section skeleton */}
            <div className="section-padding bg-wg-surface dark:bg-wg-dark-surface">
                <div className="content-wrapper">
                    <div className="text-center mb-12 space-y-3">
                        <Skeleton className="h-3.5 w-20 mx-auto" />
                        <Skeleton className="h-8 w-52 mx-auto" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="text-center p-6 rounded-card bg-wg-bg dark:bg-wg-dark-raised border border-wg-border/50 dark:border-wg-dark-border"
                            >
                                <Skeleton className="w-16 h-16 rounded-full mx-auto mb-5" />
                                <Skeleton className="h-5 w-32 mx-auto mb-3" />
                                <Skeleton className="h-3.5 w-full" />
                                <Skeleton className="h-3.5 w-5/6 mx-auto mt-1" />
                                <Skeleton className="h-3.5 w-4/6 mx-auto mt-1" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Team section skeleton */}
            <div className="section-padding bg-wg-bg dark:bg-wg-dark-bg">
                <div className="content-wrapper">
                    <div className="text-center mb-12 space-y-3">
                        <Skeleton className="h-3.5 w-16 mx-auto" />
                        <Skeleton className="h-8 w-44 mx-auto" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="p-6 bg-wg-surface dark:bg-wg-dark-raised rounded-card border border-wg-border/50 dark:border-wg-dark-border text-center"
                            >
                                <Skeleton className="w-20 h-20 rounded-full mx-auto mb-4" />
                                <Skeleton className="h-5 w-28 mx-auto" />
                                <Skeleton className="h-3.5 w-20 mx-auto mt-2" />
                                <Skeleton className="h-3 w-full mt-3" />
                                <Skeleton className="h-3 w-5/6 mx-auto mt-1" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}
