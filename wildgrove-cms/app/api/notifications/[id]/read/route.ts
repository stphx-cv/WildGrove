import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(_request: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { id } = await params
    const now = new Date()

    const updated = await prisma.adminNotification.updateMany({
      where: {
        id,
        adminId: auth.userId,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    })

    if (updated.count === 0) {
      return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/notifications/[id]/read] PATCH error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to mark notification as read." },
      { status: 500 }
    )
  }
}
