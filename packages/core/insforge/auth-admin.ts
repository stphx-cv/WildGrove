/**
 * Admin auth helpers — InsForge has no `auth.admin.*` SDK namespace.
 * Implements the subset WildGrove needs via REST + SQL (password/email).
 */
import type { UserSchema } from "@insforge/shared-schemas"
import { prisma } from "@wildgrove/db"
import { toAuthUser, type AuthUser } from "../auth/types"
import { getInsforgeApiKey, getInsforgeUrl } from "./env"

type InsForgeErrorLike = { message: string; statusCode?: number }

type AdminUserRow = {
  id: string
  email: string
  emailVerified?: boolean
  email_verified?: boolean
  providers?: string[]
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  profile?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${getInsforgeUrl()}${path}`
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${getInsforgeApiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
}

function rowToAuthUser(row: AdminUserRow): AuthUser {
  const providers = Array.isArray(row.providers) ? row.providers : []
  const mapped = {
    id: row.id,
    email: row.email,
    emailVerified: Boolean(row.emailVerified ?? row.email_verified),
    providers,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
    profile: row.profile ?? null,
    metadata: row.metadata ?? null,
  } as UserSchema
  return toAuthUser(mapped)!
}

export type UpdateUserByIdAttrs = {
  email?: string
  password?: string
  user_metadata?: Record<string, unknown>
  data?: Record<string, unknown>
  email_confirm?: boolean
}

export function createAuthAdmin() {
  return {
    async getUserById(userId: string): Promise<{
      data: { user: AuthUser | null }
      error: InsForgeErrorLike | null
    }> {
      try {
        const res = await adminFetch(`/api/auth/users/${encodeURIComponent(userId)}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          return {
            data: { user: null },
            error: {
              message: (body as { message?: string }).message ?? `HTTP ${res.status}`,
              statusCode: res.status,
            },
          }
        }
        const body = (await res.json()) as AdminUserRow | { user: AdminUserRow }
        const row = "user" in body && body.user ? body.user : (body as AdminUserRow)

        // Enrich providers from auth.user_providers when API omits them
        if (!row.providers || row.providers.length === 0) {
          const providers = await prisma.$queryRaw<Array<{ provider: string }>>`
            SELECT provider FROM auth.user_providers WHERE user_id = ${userId}::uuid
          `
          row.providers = providers.map((p) => p.provider)
          // Passworded accounts count as email provider for identity checks
          const pw = await prisma.$queryRaw<Array<{ has_pw: boolean }>>`
            SELECT (password IS NOT NULL AND password <> '') AS has_pw
            FROM auth.users WHERE id = ${userId}::uuid
          `
          if (pw[0]?.has_pw && !row.providers.includes("email")) {
            row.providers = [...row.providers, "email"]
          }
        }

        return { data: { user: rowToAuthUser(row) }, error: null }
      } catch (err) {
        return {
          data: { user: null },
          error: { message: err instanceof Error ? err.message : "getUserById failed" },
        }
      }
    },

    async updateUserById(
      userId: string,
      attrs: UpdateUserByIdAttrs,
    ): Promise<{ data: { user: AuthUser | null }; error: InsForgeErrorLike | null }> {
      try {
        if (attrs.password) {
          await prisma.$executeRaw`
            UPDATE auth.users
            SET password = crypt(${attrs.password}, gen_salt('bf')),
                updated_at = NOW()
            WHERE id = ${userId}::uuid
          `
        }

        if (attrs.email) {
          await prisma.$executeRaw`
            UPDATE auth.users
            SET email = ${attrs.email.toLowerCase()},
                email_verified = COALESCE(${attrs.email_confirm ?? true}, TRUE),
                updated_at = NOW()
            WHERE id = ${userId}::uuid
          `
        }

        const meta = attrs.user_metadata ?? attrs.data
        if (meta && Object.keys(meta).length > 0) {
          await prisma.$executeRaw`
            UPDATE auth.users
            SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(meta)}::jsonb,
                updated_at = NOW()
            WHERE id = ${userId}::uuid
          `
        }

        return this.getUserById(userId)
      } catch (err) {
        return {
          data: { user: null },
          error: { message: err instanceof Error ? err.message : "updateUserById failed" },
        }
      }
    },

    async deleteUser(userId: string): Promise<{ data: null; error: InsForgeErrorLike | null }> {
      try {
        const res = await adminFetch(`/api/auth/users`, {
          method: "DELETE",
          body: JSON.stringify({ userIds: [userId] }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          return {
            data: null,
            error: {
              message: (body as { message?: string }).message ?? `HTTP ${res.status}`,
              statusCode: res.status,
            },
          }
        }
        return { data: null, error: null }
      } catch (err) {
        return {
          data: null,
          error: { message: err instanceof Error ? err.message : "deleteUser failed" },
        }
      }
    },

    /**
     * Supabase `generateLink` has no InsForge equivalent that returns OTP/action_link.
     * Call sites that need branded OTP should use `sendResetPasswordEmail` / custom tokens.
     */
    async generateLink(_args: {
      type: string
      email: string
      options?: { redirectTo?: string }
    }): Promise<{
      data: { properties: { email_otp?: string; action_link?: string } } | null
      error: InsForgeErrorLike | null
    }> {
      return {
        data: null,
        error: {
          message:
            "generateLink is not supported on InsForge. Use sendResetPasswordEmail / custom verification.",
        },
      }
    },
  }
}

/**
 * Whether the account already holds a password credential.
 *
 * Reads the password column of the auth row, which is the only place that
 * answers the question on its own: a provider row says which sign-in methods
 * are linked, and an account can carry an email provider row from a magic
 * link without ever having set a password.
 *
 * Returns `null` when the answer cannot be established (no such row, or the
 * query failed) so callers decide with a value that is never a silent "no".
 */
export async function accountHasPassword(userId: string): Promise<boolean | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ has_password: boolean }>>`
      SELECT (password IS NOT NULL AND password <> '') AS has_password
      FROM auth.users WHERE id = ${userId}::uuid
    `
    const row = rows[0]
    if (!row) return null
    return row.has_password === true
  } catch (err) {
    console.error("[auth-admin] accountHasPassword failed:", err)
    return null
  }
}

/**
 * Keeps the profile fields of an account that still has to confirm its email.
 *
 * InsForge stores only `name` at sign up and returns no user while the email is
 * unconfirmed, so the first name, last name, username and language the person
 * typed would be lost before there is a session to carry them. They go into
 * the `profile` of the auth row, which `toAuthUser` already merges into
 * `user_metadata`, and the Profile row is created from there once the code is
 * confirmed. Only an unconfirmed row is touched, so this can never rewrite the
 * profile of an account that is in use.
 */
export async function savePendingProfile(
  email: string,
  fields: Record<string, string>,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE auth.users
    SET profile = COALESCE(profile, '{}'::jsonb) || ${JSON.stringify(fields)}::jsonb
    WHERE lower(email) = ${email.toLowerCase()} AND email_verified = false
  `
}

/** How long an unconfirmed sign up keeps the username it asked for. */
const PENDING_USERNAME_HOURS = 1

/**
 * Whether an account that has not confirmed its email is holding `username`.
 *
 * The Profile row of a new account only exists once its code is confirmed, so
 * `Profile.username` alone would let two people pass the check with the same
 * name and make the second one lose it at confirmation. A name stays reserved
 * for an hour, which outlasts the code (15 minutes) and frees the name of a
 * sign up that was abandoned or typed with the wrong email.
 */
export async function isUsernamePending(username: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ held: number }>>`
    SELECT 1 AS held FROM auth.users
    WHERE email_verified = false
      AND created_at > now() - make_interval(hours => ${PENDING_USERNAME_HOURS}::int)
      AND lower(profile->>'username') = ${username.toLowerCase()}
    LIMIT 1
  `
  return rows.length > 0
}
