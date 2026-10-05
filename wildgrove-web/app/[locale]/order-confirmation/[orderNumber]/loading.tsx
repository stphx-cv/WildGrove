import { Skeleton } from "@/components/ui/Skeleton"

export default function OrderConfirmationLoading() {
    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-28 pb-20">
            <div className="max-w-xl mx-auto px-4 sm:px-6">
                {/* Success header */}
                <div className="flex flex-col items-center text-center gap-4 mb-8">
                    <Skeleton className="w-16 h-16 rounded-full" />
                    <Skeleton className="h-7 w-56" />
                    <Skeleton className="h-4 w-64" />
                </div>

                {/* Order summary card */}
                <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-6 w-24 rounded-full" />
                    </div>

                    <div className="space-y-3 border-t border-wg-border/30 dark:border-wg-dark-border/30 pt-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-4 w-14" />
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-wg-border/30 dark:border-wg-dark-border/30 pt-4">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mt-6">
                    <Skeleton className="h-11 flex-1 rounded-brand" />
                    <Skeleton className="h-11 flex-1 rounded-brand" />
                </div>
            </div>
        </div>
    )
}
