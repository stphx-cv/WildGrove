import type { UserSchema } from "@insforge/shared-schemas"

/**
 * App-facing auth user shape (kept close to the former Supabase User
 * so sync-profile / pages keep working during the InsForge cutover).
 */
export type AuthUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  created_at?: string | null
  user_metadata: Record<string, unknown>
  app_metadata: Record<string, unknown>
  identities: Array<{ provider: string; id?: string }>
  providers?: string[]
}

export function toAuthUser(user: UserSchema | null | undefined): AuthUser | null {
  if (!user) return null

  const profile =
    user.profile && typeof user.profile === "object"
      ? (user.profile as Record<string, unknown>)
      : {}
  const metadata =
    user.metadata && typeof user.metadata === "object"
      ? (user.metadata as Record<string, unknown>)
      : {}

  const providers = Array.isArray(user.providers) ? user.providers : []

  return {
    id: user.id,
    email: user.email,
    email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
    created_at: user.createdAt ?? null,
    user_metadata: {
      ...metadata,
      ...profile,
      avatar_url:
        (typeof profile.avatar_url === "string" && profile.avatar_url) ||
        (typeof metadata.avatar_url === "string" && metadata.avatar_url) ||
        undefined,
      full_name:
        (typeof profile.name === "string" && profile.name) ||
        (typeof metadata.full_name === "string" && metadata.full_name) ||
        undefined,
    },
    app_metadata: {
      provider: providers[0] ?? (user.email ? "email" : undefined),
      providers,
    },
    identities: providers.map((provider) => ({ provider })),
    providers,
  }
}
