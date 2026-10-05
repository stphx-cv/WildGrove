"use client"

import { useEffect, useState } from "react"
import { createClient } from "../clients/client"
import type { UserProfile } from "../types"

type FormUserResponse = { user: UserProfile | null }

/**
 * Resolves the signed-in user (in the UserProfile shape used to prefill public
 * forms) in the browser via /api/form-user, so the host page never reads auth
 * cookies on the server and can stay statically rendered / prefetchable. Mirrors
 * the header island: fetches on mount and re-fetches on auth state changes.
 */
export function useFormUser(): { user: UserProfile | null; loading: boolean } {
    const [user, setUser] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true

        async function load() {
            try {
                const res = await fetch("/api/form-user", { cache: "no-store" })
                if (!res.ok) throw new Error("form-user failed")
                const data: FormUserResponse = await res.json()
                if (!active) return
                setUser(data.user)
            } catch {
                if (active) setUser(null)
            } finally {
                if (active) setLoading(false)
            }
        }

        load()

        const insforge = createClient()
        const { data: sub } = insforge.auth.onAuthStateChange(() => {
            load()
        })

        return () => {
            active = false
            sub.subscription.unsubscribe()
        }
    }, [])

    return { user, loading }
}
