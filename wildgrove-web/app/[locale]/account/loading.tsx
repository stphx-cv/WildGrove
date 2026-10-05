import { Skeleton } from "@/components/ui/Skeleton"

export default function AccountLoading() {
    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-24 pb-16 px-4 sm:px-6">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Avatar + name */}
                <div className="flex flex-col items-center gap-4">
                    <Skeleton className="w-24 h-24 rounded-full" />
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-4 w-52" />
                </div>

                {/* Form card */}
                <div className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border space-y-6">
                    <Skeleton className="h-6 w-32" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-3.5 w-20" />
                            <Skeleton className="h-10 w-full rounded-brand" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-3.5 w-20" />
                            <Skeleton className="h-10 w-full rounded-brand" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-3.5 w-20" />
                        <Skeleton className="h-10 w-full rounded-brand" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-3.5 w-16" />
                        <Skeleton className="h-10 w-full rounded-brand" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-10 w-full rounded-brand" />
                    </div>
                </div>

                {/* Connected accounts card */}
                <div className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border space-y-5">
                    <Skeleton className="h-6 w-40" />
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/30 first:border-t-0">
                            <Skeleton className="w-8 h-8 rounded-full" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-40" />
                            </div>
                            <Skeleton className="h-8 w-20 rounded-brand" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
