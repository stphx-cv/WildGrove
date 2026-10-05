import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { z } from "zod"

const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(["read", "unread"]),
})

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const parsed = bulkActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 }
      )
    }

    const { ids, action } = parsed.data
    const now = new Date()

    await prisma.adminNotification.updateMany({
      where: {
        id: { in: ids },
        adminId: auth.userId,
      },
      data:
        action === "read"
          ? { isRead: true, readAt: now }
          : { isRead: false, readAt: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/notifications/bulk] PATCH error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update notifications." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const parsed = bulkDeleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 }
      )
    }

    const { ids } = parsed.data

    await prisma.adminNotification.deleteMany({
      where: {
        id: { in: ids },
        adminId: auth.userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/notifications/bulk] DELETE error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete notifications." },
      { status: 500 }
    )
  }
}
