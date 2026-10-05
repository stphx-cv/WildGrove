// ══════════════════════════════════════════════════════════════════
// Account identifiers.
//
// A customer signs in with an email or with their public username, and the
// username is visible on reviews. Turning one into the other happens here, on
// the server, so a route can accept either without handing the address back to
// the browser: what leaves is the masked form, which is enough for someone to
// recognise their own inbox.
// ══════════════════════════════════════════════════════════════════
import { prisma } from "@wildgrove/db"

/**
 * The account email behind an identifier, or null when no account matches.
 *
 * An identifier that already contains `@` is taken as the address itself and
 * costs no query: an email that belongs to no account fails at sign in like any
 * other wrong credential.
 */
export async function resolveIdentifierToEmail(identifier: string): Promise<string | null> {
  const value = identifier.trim().toLowerCase()
  if (!value) return null
  if (value.includes("@")) return value

  const profile = await prisma.profile.findUnique({
    where: { username: value },
    select: { email: true },
  })
  return profile?.email ?? null
}

/** `ma***@example.com` — recognisable by its owner, not usable as a target. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain || !local) return "***"
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1)
  return `${visible}***@${domain}`
}
