import { Skeleton } from "@/components/ui/Skeleton"

export default function PortalLoading() {
    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            {/* Left panel - hero skeleton */}
            <div className="relative lg:w-[55%] xl:w-[60%] min-h-[260px] sm:min-h-[320px] lg:min-h-screen bg-wg-surface dark:bg-wg-dark-surface animate-pulse" />

            {/* Right panel - form skeleton */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-wg-bg dark:bg-wg-dark-bg">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center space-y-3">
                        <Skeleton className="h-8 w-48 mx-auto" />
                        <Skeleton className="h-4 w-64 mx-auto" />
                    </div>

                    {/* Social buttons */}
                    <div className="space-y-3">
                        <Skeleton className="h-11 w-full rounded-brand" />
                        <Skeleton className="h-11 w-full rounded-brand" />
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-px flex-1" />
                        <Skeleton className="h-3.5 w-6" />
                        <Skeleton className="h-px flex-1" />
                    </div>

                    {/* Email form fields */}
                    <div className="space-y-4">
                        <Skeleton className="h-11 w-full rounded-brand" />
                        <Skeleton className="h-11 w-full rounded-brand" />
                        <Skeleton className="h-11 w-full rounded-brand" />
                    </div>
                </div>
            </div>
        </div>
    )
}
