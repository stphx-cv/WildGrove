import { PageHeroSkeleton } from "@/components/ui/PageHeroSkeleton"
import { Skeleton } from "@/components/ui/Skeleton"

export default function Loading() {
    return (
        <>
            {/* Hero skeleton */}
            <PageHeroSkeleton />

            {/* Content skeleton */}
            <div className="content-wrapper section-padding">
                <div className="space-y-6 max-w-3xl mx-auto">
                    <Skeleton className="h-5 w-24 mx-auto" />
                    <Skeleton className="h-8 w-64 mx-auto" />
                    <div className="space-y-3 pt-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-4/6" />
                    </div>
                </div>
            </div>
        </>
    )
}
