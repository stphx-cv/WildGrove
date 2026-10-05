import { Skeleton } from "@/components/ui/Skeleton"

export default function AccountReservationsLoading() {
    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-28 pb-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-8 items-start">
                    <aside className="hidden lg:block rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border p-4 space-y-4">
                        <div className="flex flex-col items-center gap-3">
                            <Skeleton className="w-16 h-16 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="space-y-2 pt-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-9 w-full rounded-brand" />
                            ))}
                        </div>
                    </aside>

                    <main className="space-y-4">
                        <Skeleton className="h-8 w-48" />
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border p-5 space-y-3"
                            >
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-36" />
                            </div>
                        ))}
                    </main>
                </div>
            </div>
        </div>
    )
}
