import { createBrowserClient } from "@insforge/sdk/ssr"
import { getInsforgeAnonKey, getInsforgeUrl } from "./env"
import { toAuthUser, type AuthUser } from "../auth/types"
import { createDeferredRealtimeChannel, warnDeferredOnServer } from "./realtime"
import type { CompatSession } from "./auth-compat"

type AuthChangeCallback = (
  event: string,
  session: CompatSession | null,
) => void | Promise<void>

const AUTH_CHANGED_EVENT = "insforge:auth-changed"

/** Notify browser listeners after cookie-based sign-in / sign-out. */
export function notifyAuthChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

async function fetchSessionUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
    if (!res.ok) return null
    const body = (await res.json()) as { user?: AuthUser | null }
    return body.user ?? null
  } catch {
    return null
  }
}

/**
 * Browser InsForge client (SSR helpers).
 * Auth mutations that set httpOnly cookies go through `/api/auth/*`.
 * Session reads go through `/api/auth/session` so cart/checkout see the user.
 * Realtime is stubbed (deferred).
 */
export function createClient() {
  const client = createBrowserClient({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    refreshUrl: "/api/auth/refresh",
  })

  const auth = {
    getCurrentUser: client.auth.getCurrentUser.bind(client.auth),
    getProfile: client.auth.getProfile.bind(client.auth),
    getPublicAuthConfig: client.auth.getPublicAuthConfig.bind(client.auth),

    getUser: async () => {
      const user = await fetchSessionUser()
      return { data: { user }, error: null }
    },

    getSession: async () => {
      const user = await fetchSessionUser()
      return {
        data: {
          session: user
            ? ({ user, access_token: "insforge" } satisfies CompatSession)
            : null,
        },
        error: null,
      }
    },

    onAuthStateChange: (callback: AuthChangeCallback) => {
      let cancelled = false
      let lastId: string | null | undefined
      let first = true

      const emit = async () => {
        if (cancelled) return
        const user = await fetchSessionUser()
        if (cancelled) return
        const id = user?.id ?? null
        const session = user
          ? ({ user, access_token: "insforge" } satisfies CompatSession)
          : null

        if (first) {
          first = false
          lastId = id
          await callback("INITIAL_SESSION", session)
          return
        }

        if (id === lastId) return
        lastId = id
        await callback(
          id ? "SIGNED_IN" : "SIGNED_OUT",
          session,
        )
      }

      void emit()
      const timer = setInterval(() => void emit(), 15_000)

      const onChanged = () => {
        void emit()
      }
      const onFocus = () => {
        void emit()
      }

      if (typeof window !== "undefined") {
        window.addEventListener(AUTH_CHANGED_EVENT, onChanged)
        window.addEventListener("focus", onFocus)
      }

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              cancelled = true
              clearInterval(timer)
              if (typeof window !== "undefined") {
                window.removeEventListener(AUTH_CHANGED_EVENT, onChanged)
                window.removeEventListener("focus", onFocus)
              }
            },
          },
        },
      }
    },

    signOut: async () => {
      const res = await fetch("/api/auth/sign-out", { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return {
          error: {
            message: (body as { error?: string }).error ?? "Sign out failed",
          },
        }
      }
      notifyAuthChanged()
      return { error: null }
    },

    signInWithPassword: async (creds: { email: string; password: string }) => {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        return {
          data: { user: null, session: null },
          error: { message: (body as { error?: string }).error ?? "Sign in failed" },
        }
      }
      notifyAuthChanged()
      const user = await fetchSessionUser()
      return {
        data: {
          user,
          session: user ? { user, access_token: "insforge" } : null,
        },
        error: null,
      }
    },

    updateUser: async (attrs: {
      password?: string
      email?: string
      data?: Record<string, unknown>
    }) => {
      if (attrs.password && !attrs.email && !attrs.data) {
        const res = await fetch("/api/auth/reset-password/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: attrs.password }),
        })
        if (res.ok) {
          const user = await fetchSessionUser()
          return { data: { user }, error: null }
        }
        const res2 = await fetch("/api/account/password", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: attrs.password }),
        })
        const body = await res2.json().catch(() => ({}))
        if (!res2.ok) {
          return {
            data: { user: null },
            error: { message: (body as { error?: string }).error ?? "updateUser failed" },
          }
        }
        const user = await fetchSessionUser()
        return { data: { user }, error: null }
      }

      if (attrs.email) {
        const res = await fetch("/api/account/email", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: attrs.email }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          return {
            data: { user: null },
            error: { message: (body as { error?: string }).error ?? "Email update failed" },
          }
        }
      }

      const user = await fetchSessionUser()
      return { data: { user }, error: null }
    },

    verifyOtp: async (args: {
      email: string
      token: string
      type?: string
    }) => {
      const verifyUrl =
        args.type === "recovery"
          ? "/api/auth/reset-password/verify"
          : "/api/account/email/verify"
      const verifyBody =
        args.type === "recovery"
          ? { email: args.email, code: args.token }
          : { email: args.email, token: args.token }

      const res = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyBody),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        return {
          data: { user: null, session: null },
          error: { message: (body as { error?: string }).error ?? "OTP failed" },
        }
      }
      notifyAuthChanged()
      const user = await fetchSessionUser()
      return {
        data: {
          user,
          session: user ? { user, access_token: "insforge" } : null,
        },
        error: null,
      }
    },

    linkIdentity: async (_args: {
      provider: string
      options?: { redirectTo?: string; mode?: string; next?: string; locale?: string }
    }) => {
      let mode = _args.options?.mode
      let next = _args.options?.next
      if (_args.options?.redirectTo) {
        try {
          const parsed = new URL(_args.options.redirectTo, window.location.origin)
          mode = mode ?? parsed.searchParams.get("mode") ?? undefined
          const nextParam = parsed.searchParams.get("next")
          if (nextParam) next = decodeURIComponent(nextParam)
        } catch {
          // ignore malformed redirectTo
        }
      }
      const res = await fetch("/api/auth/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: _args.provider,
          mode: mode ?? "link",
          next: next ?? "/account",
          locale: _args.options?.locale ?? "en",
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !(body as { url?: string }).url) {
        return {
          data: null,
          error: { message: (body as { error?: string }).error ?? "OAuth start failed" },
        }
      }
      window.location.href = (body as { url: string }).url
      return { data: { url: (body as { url: string }).url }, error: null }
    },
  }

  return {
    ...client,
    auth,
    channel: (name: string) => createDeferredRealtimeChannel(name),
    removeChannel: async (..._args: unknown[]) => {
      warnDeferredOnServer("[realtime:deferred] removeChannel skipped")
    },
  }
}
