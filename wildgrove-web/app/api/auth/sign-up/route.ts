import { NextResponse, type NextRequest } from "next/server"
import { createAuthActions } from "@insforge/sdk/ssr"
import { getAppUrl, getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { authCookieSettings } from "@wildgrove/core/insforge/cookies"
import { syncProfileFromAuthUser } from "@wildgrove/core/auth/sync-profile"
import type { InitialBalanceCredits } from "@wildgrove/core/wallet/initial-balance"
import { toAuthUser } from "@wildgrove/core/auth/types"
import { syncVerifyEmailTemplate } from "@wildgrove/core/auth-email-templates"
import { isUsernamePending, savePendingProfile } from "@wildgrove/core/insforge/auth-admin"
import { authLimiter, enforceLimitByIpAndIdentifier } from "@wildgrove/core/rate-limit"
import { NAME_REGEX, USERNAME_REGEX } from "@wildgrove/core/validation"
import { prisma } from "@wildgrove/db"

type ProfileFields = { first_name?: string; last_name?: string; username?: string }
type Rejection = { status: number; error: string; message: string }

/**
 * The profile fields a new account may set, checked with the rules the account
 * page applies later. Anything else in `metadata`, the avatar included, is
 * dropped: Google sets the avatar on its own sign in.
 */
async function profileFieldsFrom(metadata: Record<string, unknown>): Promise<ProfileFields | Rejection> {
  const fields: ProfileFields = {}

  for (const key of ["first_name", "last_name"] as const) {
    const value = metadata[key]
    if (value === undefined) continue
    const clean = typeof value === "string" ? value.trim() : ""
    if (!clean || !NAME_REGEX.test(clean)) {
      return {
        status: 400,
        error: "NAME_INVALID",
        message: "Invalid name. Only letters, spaces, hyphens, and apostrophes allowed.",
      }
    }
    fields[key] = clean
  }

  if (metadata.username !== undefined) {
    const clean = typeof metadata.username === "string" ? metadata.username.trim().toLowerCase() : ""
    if (clean.length < 3 || !USERNAME_REGEX.test(clean)) {
      return {
        status: 400,
        error: "USERNAME_INVALID",
        message: "Username must be at least 3 characters (letters, numbers, _, ., -).",
      }
    }
    const taken = await prisma.profile.findUnique({ where: { username: clean }, select: { id: true } })
    if (taken || (await isUsernamePending(clean))) {
      return { status: 409, error: "USERNAME_TAKEN", message: "Username already taken." }
    }
    fields.username = clean
  }

  return fields
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === "string" ? body.email.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""
  const name = typeof body.name === "string" ? body.name.trim() : undefined
  const locale = body.locale === "es" ? "es" : "en"
  const metadata =
    body.metadata && typeof body.metadata === "object"
      ? (body.metadata as Record<string, unknown>)
      : {}

  if (!email || !password) {
    return NextResponse.json(
      { error: "EMAIL_PASSWORD_REQUIRED", message: "Email and password are required" },
      { status: 400 }
    )
  }

  const limited = await enforceLimitByIpAndIdentifier(authLimiter, request, email)
  if (limited) return limited

  // Checked before the account exists, so a rejected field leaves nothing behind.
  const profileFields = await profileFieldsFrom(metadata)
  if ("status" in profileFields) {
    return NextResponse.json(
      { error: profileFields.error, message: profileFields.message },
      { status: profileFields.status }
    )
  }

  const response = NextResponse.json({ ok: true })
  const auth = createAuthActions({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    requestCookies: request.cookies,
    responseCookies: response.cookies,
    ...authCookieSettings,
  })

  // InsForge renders and sends the code email from a template row that holds
  // one language, so it is pointed at the page's language first. A failure
  // must not stop the sign up: the wrong language beats no email.
  try {
    await syncVerifyEmailTemplate(locale)
  } catch (err) {
    console.error("[auth/sign-up] template sync failed:", err)
  }

  const { data, error } = await auth.signUp({
    email,
    password,
    name,
    redirectTo: `${getAppUrl()}/${locale}/portal`,
  })

  if (error) {
    return NextResponse.json(
      {
        error: error.error ?? "SIGNUP_FAILED",
        message: error.message ?? "Sign up failed",
      },
      { status: error.statusCode ?? 400 }
    )
  }

  // The email still has to be confirmed: there is no user and no session yet.
  // The profile fields wait on the auth row until the code is confirmed.
  if (data?.requireEmailVerification) {
    try {
      await savePendingProfile(email.toLowerCase(), { ...profileFields, locale })
    } catch (err) {
      console.error("[auth/sign-up] pending profile save failed:", err)
    }
  }

  // Persist profile metadata when session is already available
  let initialBalance: InitialBalanceCredits | null = null
  if (data?.user) {
    const user = toAuthUser(data.user)
    if (user) {
      user.user_metadata = { ...user.user_metadata, ...profileFields, locale }
      try {
        initialBalance = (await syncProfileFromAuthUser(user)).initialBalance
      } catch (err) {
        console.error("[auth/sign-up] profile sync failed:", err)
      }
    }
  }

  return NextResponse.json(
    {
      user: data?.user
        ? { id: data.user.id, email: data.user.email }
        : null,
      requireEmailVerification: Boolean(data?.requireEmailVerification),
      initialBalance,
    },
    { headers: response.headers }
  )
}
