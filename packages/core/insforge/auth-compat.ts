/**
 * Supabase-shaped auth helpers layered on InsForge (session user updates, OTP, etc.).
 */
import type { InsForgeClient } from "@insforge/sdk"
import { prisma } from "@wildgrove/db"
import { toAuthUser, type AuthUser } from "../auth/types"

type Err = { message: string } | null

export type CompatSession = {
  user: AuthUser
  access_token: string
  expires_at?: number
}

export async function compatGetUser(client: InsForgeClient) {
  const { data, error } = await client.auth.getCurrentUser()
  return {
    data: { user: toAuthUser(data?.user ?? null) },
    error,
  }
}

export async function compatGetClaims(client: InsForgeClient) {
  const { data, error } = await client.auth.getCurrentUser()
  const user = toAuthUser(data?.user ?? null)
  return {
    data: user
      ? {
          claims: {
            sub: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
            app_metadata: user.app_metadata,
          },
        }
      : null,
    error,
  }
}

export async function compatGetSession(client: InsForgeClient): Promise<{
  data: { session: CompatSession | null }
  error: Err
}> {
  const { data, error } = await client.auth.getCurrentUser()
  const user = toAuthUser(data?.user ?? null)
  if (!user) return { data: { session: null }, error: error as Err }
  return {
    data: {
      session: {
        user,
        access_token: "insforge",
      },
    },
    error: null,
  }
}

/** Authenticated password / metadata update (no InsForge SDK equivalent). */
export async function compatUpdateUser(
  client: InsForgeClient,
  attrs: {
    password?: string
    email?: string
    data?: Record<string, unknown>
  },
): Promise<{ data: { user: AuthUser | null }; error: Err }> {
  const { data: cur, error: curErr } = await client.auth.getCurrentUser()
  const user = toAuthUser(cur?.user ?? null)
  if (!user) {
    return { data: { user: null }, error: curErr ?? { message: "Not authenticated" } }
  }

  try {
    if (attrs.email && attrs.email !== user.email) {
      return {
        data: { user },
        error: { message: "Use PATCH /api/account/email to change the account email." },
      }
    }

    if (attrs.password) {
      await prisma.$executeRaw`
        UPDATE auth.users
        SET password = crypt(${attrs.password}, gen_salt('bf')),
            updated_at = NOW()
        WHERE id = ${user.id}::uuid
      `
    }

    if (attrs.data && Object.keys(attrs.data).length > 0) {
      await prisma.$executeRaw`
        UPDATE auth.users
        SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(attrs.data)}::jsonb,
            updated_at = NOW()
        WHERE id = ${user.id}::uuid
      `
      // Mirror common profile fields
      const profilePatch: Record<string, unknown> = {}
      if (typeof attrs.data.full_name === "string") profilePatch.name = attrs.data.full_name
      if (typeof attrs.data.avatar_url === "string") profilePatch.avatar_url = attrs.data.avatar_url
      if (Object.keys(profilePatch).length > 0) {
        await client.auth.setProfile(profilePatch)
      }
    }

    const refreshed = await client.auth.getCurrentUser()
    return { data: { user: toAuthUser(refreshed.data?.user ?? null) }, error: null }
  } catch (err) {
    return {
      data: { user: null },
      error: { message: err instanceof Error ? err.message : "updateUser failed" },
    }
  }
}

/**
 * Map Supabase verifyOtp types onto InsForge verifyEmail / verifyOtp / reset exchange.
 */
export async function compatVerifyOtp(
  client: InsForgeClient,
  args: {
    email: string
    token: string
    type?: string
    otp?: string
  },
): Promise<{ data: { user: AuthUser | null; session: CompatSession | null }; error: Err }> {
  const email = args.email
  const token = args.token || args.otp || ""
  const type = args.type ?? "email"

  try {
    if (type === "recovery" || type === "signup" || type === "email") {
      // Email verification code
      if (type === "signup" || type === "email") {
        const { data, error } = await client.auth.verifyEmail({ email, otp: token })
        if (error) return { data: { user: null, session: null }, error }
        const user = toAuthUser(data?.user ?? null)
        return {
          data: {
            user,
            session: user ? { user, access_token: "insforge" } : null,
          },
          error: null,
        }
      }
    }

    if (type === "email_change") {
      return {
        data: { user: null, session: null },
        error: { message: "Use POST /api/account/email/verify to confirm an email change." },
      }
    }

    // Passwordless / generic OTP sign-in
    const { data, error } = await client.auth.verifyOtp({ email, otp: token })
    if (error) return { data: { user: null, session: null }, error }
    const user = toAuthUser(data?.user ?? null)
    return {
      data: {
        user,
        session: user ? { user, access_token: "insforge" } : null,
      },
      error: null,
    }
  } catch (err) {
    return {
      data: { user: null, session: null },
      error: { message: err instanceof Error ? err.message : "verifyOtp failed" },
    }
  }
}
