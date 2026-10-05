import { PageHeroSkeleton } from "@/components/ui/PageHeroSkeleton"
import { Skeleton } from "@/components/ui/Skeleton"

export default function ReservationsLoading() {
    return (
        <>
            {/* Hero skeleton */}
            <PageHeroSkeleton />

            {/* Quick info strip skeleton */}
            <div className="section-padding bg-wg-surface dark:bg-wg-dark-surface !pt-8 !pb-10 md:!pt-10 md:!pb-12">
                <div className="content-wrapper">
                    <div className="flex flex-wrap justify-center items-stretch gap-3 sm:gap-4 lg:gap-6 max-w-5xl mx-auto">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="w-full min-w-0 min-[440px]:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-3rem)/3)] flex flex-row sm:flex-col sm:items-center gap-3 sm:gap-0 p-4 sm:p-6 rounded-card bg-wg-bg dark:bg-wg-dark-raised border border-wg-border/50 dark:border-wg-dark-border sm:h-[11.5rem]"
                            >
                                <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shrink-0 sm:mb-4" />
                                <div className="flex-1 sm:w-full space-y-2 sm:flex sm:flex-col sm:items-center">
                                    <Skeleton className="h-4 w-24 sm:mx-auto" />
                                    <Skeleton className="h-3.5 w-32 sm:mx-auto" />
                                    <Skeleton className="h-3.5 w-28 sm:mx-auto" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Form skeleton */}
            <div className="section-padding bg-wg-bg dark:bg-wg-dark-bg">
                <div className="content-wrapper">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16">
                        {/* Left - form */}
                        <div className="lg:col-span-3">
                            <div className="mb-8 space-y-3">
                                <Skeleton className="h-3.5 w-24" />
                                <Skeleton className="h-7 w-52" />
                                <Skeleton className="h-3.5 w-72" />
                            </div>
                            <div className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <Skeleton className="h-10 w-full rounded-brand" />
                                    <Skeleton className="h-10 w-full rounded-brand" />
                                </div>
                                <Skeleton className="h-10 w-full rounded-brand" />
                                <Skeleton className="h-10 w-full rounded-brand" />
                                <Skeleton className="h-28 w-full rounded-brand" />
                                <Skeleton className="h-11 w-full rounded-brand" />
                            </div>
                        </div>

                        {/* Right - sidebar */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="p-6 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border space-y-3">
                                <Skeleton className="h-5 w-28" />
                                <Skeleton className="h-3.5 w-full" />
                                <Skeleton className="h-3.5 w-3/4" />
                                <Skeleton className="h-3.5 w-1/2 mt-2" />
                                <Skeleton className="h-3.5 w-2/3" />
                            </div>
                            <div className="p-6 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border space-y-3">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-3.5 w-full" />
                                <Skeleton className="h-3.5 w-5/6" />
                            </div>
                            <div className="p-6 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border space-y-3">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-3.5 w-full" />
                                <Skeleton className="h-3.5 w-4/5" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
