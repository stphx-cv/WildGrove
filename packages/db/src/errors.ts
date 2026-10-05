/**
 * Detect Prisma / driver errors caused by Postgres rejecting new clients
 * (`too many clients already`, Prisma P2037). This is contention for connection
 * slots, not a broken query, so the caller can wait and try again.
 */
export function isPrismaConnectionExhausted(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  const err = error as {
    code?: string
    message?: string
    meta?: { driverAdapterError?: { message?: string; name?: string } }
  }

  if (err.code === "P2037") return true

  const haystack = [
    err.message,
    err.meta?.driverAdapterError?.message,
    err.meta?.driverAdapterError?.name,
  ]
    .filter((s): s is string => typeof s === "string")
    .join(" ")
    .toLowerCase()

  return (
    haystack.includes("too many clients") ||
    haystack.includes("toomanyconnections") ||
    haystack.includes("too many database connections")
  )
}
