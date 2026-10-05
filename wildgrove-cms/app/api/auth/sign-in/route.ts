// ══════════════════════════════════════════════════════════════════
// CMS password sign-in. The shared handler checks the password; this route then
// checks the role, as /api/auth/callback does for Google. An account that is not
// staff gets a 403 and no session cookie, so the form can say so instead of
// signing in and being sent back by the proxy without a word.
// ══════════════════════════════════════════════════════════════════
import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@wildgrove/db"
import { handleSignIn } from "@wildgrove/core/auth/handlers"
import { isAdminRole } from "@/lib/admin-auth"

export async function POST(request: NextRequest) {
  const response = await handleSignIn(request)
  if (!response.ok) return response

  try {
    const body = (await response.clone().json()) as { user?: { id?: string } }
    const userId = body.user?.id
    const profile = userId
      ? await prisma.profile.findUnique({ where: { id: userId }, select: { role: true } })
      : null

    if (!isAdminRole(profile?.role)) {
      return NextResponse.json(
        { error: "AUTH_FORBIDDEN", message: "Admin access required" },
        { status: 403 },
      )
    }
  } catch (err) {
    console.error("[auth/sign-in] role lookup failed:", err)
    return NextResponse.json(
      { error: "AUTH_FAILED", message: "Sign in failed" },
      { status: 500 },
    )
  }

  return response
}
