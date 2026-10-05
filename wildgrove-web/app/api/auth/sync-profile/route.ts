import { NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { syncProfileFromAuthUser } from "@wildgrove/core/auth/sync-profile"

export async function POST() {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await syncProfileFromAuthUser(user)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[auth/sync-profile] Failed to sync profile:", error)
    return NextResponse.json({ error: "Could not sync profile" }, { status: 500 })
  }
}
