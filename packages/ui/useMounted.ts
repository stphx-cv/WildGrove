"use client"

import { useSyncExternalStore } from "react"

const subscribeNothing = () => () => {}

/**
 * False on the server and in the hydrating render, true after.
 *
 * Use it to keep client-only state (the saved theme, the saved currency) out of
 * markup the server also renders. React does not patch attribute mismatches
 * when it hydrates, so a button that renders "active" from state the server
 * could not know keeps the server's class until something else changes it.
 */
export function useMounted() {
    return useSyncExternalStore(subscribeNothing, () => true, () => false)
}
