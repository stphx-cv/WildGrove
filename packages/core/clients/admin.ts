import { createInsforgeAdmin } from "../insforge/admin"
import { createAuthAdmin } from "../insforge/auth-admin"
import { createDeferredRealtimeChannel } from "../insforge/realtime"

type AuthAdmin = ReturnType<typeof createAuthAdmin>

/**
 * Server-only admin / service client (replaces former Supabase service-role client).
 * Mutates the Auth class instance so prototype methods (sendResetPasswordEmail, etc.)
 * remain available — object-spread of a class instance drops methods.
 */
export function createServiceClient() {
  const client = createInsforgeAdmin()
  const authAdmin = createAuthAdmin()
  Object.assign(client.auth, { admin: authAdmin })

  type ClientAuth = typeof client.auth & { admin: AuthAdmin }

  return {
    database: client.database,
    storage: client.storage,
    auth: client.auth as ClientAuth,
    ai: client.ai,
    from: (table: string) => client.database.from(table),
    channel: (name: string) => createDeferredRealtimeChannel(name),
    removeChannel: async (..._args: unknown[]) => {
      console.warn("[realtime:deferred] removeChannel skipped")
    },
  }
}

/** @deprecated Use createServiceClient — alias for migration churn. */
export function createAdminClient() {
  return createServiceClient()
}
