"use client"

// ══════════════════════════════════════════════════════════════════
// The SWR cache for the whole panel.
//
// A client component wrapping `children`, so `app/(panel)/layout.tsx` stays a
// server component and the prerendered list pages stay prerendered: it reads no
// cookies and no headers, it only provides a context.
// ══════════════════════════════════════════════════════════════════

import { SWRConfig } from "swr"
import { CMS_QUERY_DEFAULTS } from "@/lib/cms-query"

export function CmsQueryProvider({ children }: { children: React.ReactNode }) {
    return <SWRConfig value={CMS_QUERY_DEFAULTS}>{children}</SWRConfig>
}
