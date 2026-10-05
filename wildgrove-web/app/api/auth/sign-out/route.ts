import type { NextRequest } from "next/server"
import { handleSignOut } from "@wildgrove/core/auth/handlers"

export async function POST(request: NextRequest) {
  return handleSignOut(request)
}
