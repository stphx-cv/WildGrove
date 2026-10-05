import type { NextRequest } from "next/server"
import { handleSignIn } from "@wildgrove/core/auth/handlers"

export async function POST(request: NextRequest) {
  return handleSignIn(request)
}
