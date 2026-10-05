import { PageHeroSkeleton } from "@/components/ui/PageHeroSkeleton"
import { Skeleton } from "@/components/ui/Skeleton"
import {
    contactChannelCardWidthClass,
    contactChannelGridClass,
    getContactChannelColumnCounts,
} from "@wildgrove/core/contact-channel-layout"

export default function ContactLoading() {
    const skeletonCount = 4
    const { sm, lg } = getContactChannelColumnCounts(skeletonCount)
    const skeletonWidthClass = contactChannelCardWidthClass(sm, lg)

    return (
        <>
            {/* Hero skeleton */}
            <PageHeroSkeleton />

            {/* Contact channels skeleton */}
            <div className="section-padding bg-wg-surface dark:bg-wg-dark-surface">
                <div className="content-wrapper">
                    <div className={contactChannelGridClass(lg)}>
                        {Array.from({ length: skeletonCount }).map((_, i) => (
                            <div
                                key={i}
                                className={`flex flex-row sm:flex-col items-start sm:items-center gap-3 sm:gap-0 p-4 sm:p-6 rounded-card bg-wg-bg dark:bg-wg-dark-raised border border-wg-border/50 dark:border-wg-dark-border ${skeletonWidthClass}`}
                            >
                                <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shrink-0 sm:mb-4" />
                                <div className="min-w-0 flex-1 sm:w-full space-y-2">
                                    <Skeleton className="h-4 w-20 sm:mx-auto" />
                                    <Skeleton className="h-3 w-full max-w-[8rem] sm:mx-auto" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Form + Map skeleton */}
            <div className="section-padding bg-wg-bg dark:bg-wg-dark-bg">
                <div className="content-wrapper">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16">
                        {/* Left - form */}
                        <div className="lg:col-span-3">
                            <div className="mb-8 space-y-3">
                                <Skeleton className="h-3.5 w-20" />
                                <Skeleton className="h-7 w-48" />
                                <Skeleton className="h-3.5 w-64" />
                            </div>
                            <div className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card space-y-5">
                                <Skeleton className="h-10 w-full rounded-brand" />
                                <Skeleton className="h-10 w-full rounded-brand" />
                                <div className="grid grid-cols-2 gap-4">
                                    <Skeleton className="h-10 w-full rounded-brand" />
                                    <Skeleton className="h-10 w-full rounded-brand" />
                                </div>
                                <Skeleton className="h-28 w-full rounded-brand" />
                                <Skeleton className="h-11 w-full rounded-brand" />
                            </div>
                        </div>

                        {/* Right - map + info */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="rounded-card overflow-hidden border border-wg-border/50 dark:border-wg-dark-border">
                                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                                <div className="px-4 py-3 bg-wg-surface dark:bg-wg-dark-surface border-t border-wg-border/50 dark:border-wg-dark-border">
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-3 w-24 mt-1" />
                                </div>
                            </div>
                            <div className="p-6 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border space-y-3">
                                <Skeleton className="h-5 w-36" />
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
