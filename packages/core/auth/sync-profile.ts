import { AuthProvider } from "@wildgrove/db"
import { prisma } from "@wildgrove/db"
import { WalletService } from "../wallet/WalletService"
import { creditInitialBalance, type InitialBalanceCredits } from "../wallet/initial-balance"
import type { AuthUser } from "./types"

type SyncedProfile = Awaited<ReturnType<typeof prisma.profile.update>>

interface SyncProfileResult {
  profile: SyncedProfile
  existedProfile: boolean
  /** What this call credited to the new account. Null when it credited nothing: the profile already existed, or both amounts are 0. */
  initialBalance: InitialBalanceCredits | null
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function inferLocaleFromUser(user: AuthUser): "en" | "es" {
  const locale = user.user_metadata?.locale
  return locale === "es" ? "es" : "en"
}

export function getUserLocaleFromAuthUser(user: AuthUser): "en" | "es" {
  return inferLocaleFromUser(user)
}

export async function syncProfileFromAuthUser(user: AuthUser): Promise<SyncProfileResult> {
  const meta = user.user_metadata ?? {}
  const fullNameFromMeta = asStringOrNull(meta.full_name)
  const firstName =
    asStringOrNull(meta.first_name) ??
    (fullNameFromMeta ? asStringOrNull(fullNameFromMeta.split(" ")[0]) : null)
  const lastName =
    asStringOrNull(meta.last_name) ??
    (fullNameFromMeta ? asStringOrNull(fullNameFromMeta.split(" ").slice(1).join(" ")) : null)
  const username = asStringOrNull(meta.username)?.toLowerCase() ?? null
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null

  const identityConnections: AuthProvider[] = []
  if (user.identities?.some((id) => id.provider === "email")) {
    identityConnections.push(AuthProvider.EMAIL)
  }
  if (user.identities?.some((id) => id.provider === "google")) {
    identityConnections.push(AuthProvider.GOOGLE)
  }

  const readExisting = () =>
    prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true, avatarUrl: true },
    })

  const createData = {
    id: user.id,
    email: user.email,
    name: fullName,
    firstName,
    lastName,
    username,
    avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
    connections: identityConnections,
  }

  let existing = await readExisting()

  if (!existing) {
    // The Profile and its starting balance are written together, so the profile
    // exists if and only if the balance was credited. When two calls race for a
    // new user, the second insert waits for the first transaction and then
    // fails on the primary key: that call rolls back whole and carries on as an
    // update of the profile the first one created.
    try {
      const created = await prisma.$transaction(
        async (tx) => {
          const profile = await tx.profile.create({ data: createData })
          const initialBalance = await creditInitialBalance(tx, profile.id)
          return { profile, initialBalance }
        },
        { maxWait: 5_000, timeout: 10_000 },
      )
      const credited = Object.keys(created.initialBalance).length > 0
      return {
        profile: created.profile,
        existedProfile: false,
        initialBalance: credited ? created.initialBalance : null,
      }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      existing = await readExisting()
      // Another unique column (the email or the username) collided, not the id.
      if (!existing) throw error
    }
  }

  const shouldSyncAvatar =
    typeof meta.avatar_url === "string" &&
    (!existing.avatarUrl || existing.avatarUrl.includes("googleusercontent.com"))

  const profile = await prisma.profile.update({
    where: { id: user.id },
    data: {
      email: user.email,
      ...(fullName && { name: fullName }),
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(username && { username }),
      ...(shouldSyncAvatar && { avatarUrl: meta.avatar_url as string }),
      ...(identityConnections.length > 0 && { connections: identityConnections }),
    },
  })

  // Phase G2 — ensure PEN + USD wallet rows exist (idempotent upsert). Non-blocking for auth.
  void Promise.all([
    WalletService.getOrCreateWallet(user.id, "PEN"),
    WalletService.getOrCreateWallet(user.id, "USD"),
  ]).catch(() => {})

  return { profile, existedProfile: true, initialBalance: null }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}
