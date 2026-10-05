// ══════════════════════════════════════════════════════════════════
// @wildgrove/db — the single entry point to Prisma for every app.
// Nothing outside this package imports `generated/prisma/*` directly.
// ══════════════════════════════════════════════════════════════════

export { prisma } from "./client"
export { isPrismaConnectionExhausted } from "./errors"

// Models, enums, input types and the `Prisma` namespace.
export * from "../generated/prisma/client"
