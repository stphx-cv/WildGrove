import { Skeleton } from "@/components/ui/Skeleton"

export default function CompleteProfileLoading() {
    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg flex items-start justify-center px-4 py-12 pt-20 sm:pt-24">
            <div className="w-full max-w-md">
                <div className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card space-y-7">
                    {/* Heading */}
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-full" />
                    </div>

                    {/* Form fields */}
                    <div className="space-y-5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-3.5 w-20" />
                                <Skeleton className="h-10 w-full rounded-brand" />
                            </div>
                        ))}
                        <Skeleton className="h-11 w-full rounded-brand" />
                    </div>
                </div>

                <div className="flex justify-center mt-6">
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
        </div>
    )
}
