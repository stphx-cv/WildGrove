// GET /api/reviews/config — public, returns review settings
import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"

export async function GET() {
    const settings = await prisma.appSettings.findUnique({ where: { key: "global" } })
    return NextResponse.json({
        maxPhotos: settings?.reviewPhotoLimit ?? 3,
        reviewsEnabled: settings?.reviewsEnabled ?? true,
    })
}
