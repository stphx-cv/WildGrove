import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"

export async function PATCH() {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const now = new Date()
    await prisma.adminNotification.updateMany({
      where: {
        adminId: auth.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/notifications/read-all] PATCH error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to mark notifications as read." },
      { status: 500 }
    )
  }
}
