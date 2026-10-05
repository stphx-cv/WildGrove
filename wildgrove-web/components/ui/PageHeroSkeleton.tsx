import { Skeleton } from "@/components/ui/Skeleton"

const SIZE_CLASS = {
    default: "h-[45vh] min-h-[360px]",
    tall: "h-[50vh] min-h-[400px]",
} as const

type PageHeroSkeletonProps = {
    size?: keyof typeof SIZE_CLASS
}

export function PageHeroSkeleton({ size = "default" }: PageHeroSkeletonProps) {
    return (
        <div className={`relative ${SIZE_CLASS[size]} bg-wg-surface dark:bg-wg-dark-surface animate-pulse`}>
            <div className="absolute inset-0 flex items-center justify-center px-4 pt-16">
                <div className="relative text-center w-full max-w-5xl mx-auto">
                    <Skeleton className="h-10 w-64 sm:w-80 mx-auto" />
                    <Skeleton className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 h-3.5 w-32" />
                </div>
            </div>
        </div>
    )
}
