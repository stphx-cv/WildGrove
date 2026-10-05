import type { Prisma, AdminNotificationEntityType, AdminNotificationType } from "@wildgrove/db"
import { prisma } from "@wildgrove/db"
import { createServiceClient } from './clients/admin'
import { cmsPanelPath } from './urls'

function getInsforgeAdmin() {
  return createServiceClient()
}

interface CreateAdminNotificationInput {
  type: AdminNotificationType
  entityType: AdminNotificationEntityType
  entityId: string
  title: string
  message: string
  href?: string
  metadata?: Prisma.InputJsonValue
}

export async function createAdminNotificationForAllAdmins(
  input: CreateAdminNotificationInput
) {
  const admins = await prisma.profile.findMany({
    where: { role: { in: ["ADMIN", "OWNER"] } },
    select: { id: true },
  })

  if (admins.length === 0) return

  await prisma.adminNotification.createMany({
    data: admins.map((admin) => ({
      adminId: admin.id,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      message: input.message,
      href: input.href ? cmsPanelPath(input.href) : null,
      metadata: input.metadata ?? undefined,
    })),
  })

  // Broadcast to each admin's real-time channel so the bell updates instantly
  const insforge = getInsforgeAdmin()
  await Promise.allSettled(
    admins.map((admin) =>
      insforge.channel(`admin:notifications:${admin.id}`).send({
        type: "broadcast",
        event: "new_notification",
        payload: { type: input.type, title: input.title, message: input.message },
      })
    )
  )
}
