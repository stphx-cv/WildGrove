import { createServerClient } from "@insforge/sdk/ssr"
import { cookies } from "next/headers"
import { getInsforgeAnonKey, getInsforgeUrl } from "./env"
import { toAuthUser } from "../auth/types"
import { createDeferredRealtimeChannel, warnDeferredOnServer } from "./realtime"
import {
  compatGetClaims,
  compatGetUser,
  compatUpdateUser,
  compatVerifyOtp,
} from "./auth-compat"

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    cookies: cookieStore,
  })
}

/** Cookie-authenticated user in the legacy AuthUser shape. */
export async function getAuthUser() {
  const client = await createClient()
  const { data, error } = await client.auth.getCurrentUser()
  if (error) return { user: null, error }
  return { user: toAuthUser(data.user), error: null }
}

/**
 * Server client with Supabase-shaped auth helpers + deferred realtime.
 * Used by `clients/server.ts`.
 */
export async function createCompatServerClient() {
  const client = await createClient()

  return {
    ...client,
    auth: {
      ...client.auth,
      getUser: () => compatGetUser(client),
      getClaims: () => compatGetClaims(client),
      updateUser: (attrs: {
        password?: string
        email?: string
        data?: Record<string, unknown>
      }) => compatUpdateUser(client, attrs),
      verifyOtp: (args: { email: string; token: string; type?: string; otp?: string }) =>
        compatVerifyOtp(client, args),
      // Already on InsForge Auth — keep for password verification in account routes
      signInWithPassword: client.auth.signInWithPassword.bind(client.auth),
      resend: async (args: { type: string; email: string }) => {
        if (args.type === "signup" || args.type === "email") {
          return client.auth.resendVerificationEmail({ email: args.email })
        }
        return {
          data: null,
          error: { message: `Unsupported resend type: ${args.type}` },
        }
      },
    },
    from: (table: string) => client.database.from(table),
    channel: (name: string) => createDeferredRealtimeChannel(name),
    removeChannel: async (..._args: unknown[]) => {
      warnDeferredOnServer("[realtime:deferred] removeChannel skipped")
    },
  }
}
