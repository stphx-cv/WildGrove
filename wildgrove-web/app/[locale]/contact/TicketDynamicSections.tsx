"use client"

import { SectionWrapper } from "@/components/ui/SectionWrapper"
import { TicketHistory } from "@/components/history/TicketHistory"

export function TicketDynamicHistory() {
    return (
        <SectionWrapper className="bg-wg-surface dark:bg-wg-dark-surface">
            <TicketHistory />
        </SectionWrapper>
    )
}

export function TicketHistoryInline() {
    return <TicketHistory />
}
