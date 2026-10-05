import { handleSessionProbe } from "@wildgrove/core/auth/handlers"

export const dynamic = "force-dynamic"

export async function GET() {
  return handleSessionProbe()
}
