// ══════════════════════════════════════════════════════════════════
// Account Avatar — POST to upload a profile photo to InsForge Storage
// Uses the service-role key to bypass RLS on the 'avatars' bucket.
// ══════════════════════════════════════════════════════════════════

import { createClient } from '@wildgrove/core/clients/server'
import { prisma } from "@wildgrove/db"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@wildgrove/core/clients/admin'
import { isGoogleAvatarUrl } from '@wildgrove/core/auth/google-avatar'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED  = ['image/jpeg', 'image/png', 'image/webp']
const BUCKET   = 'avatars'

function adminClient() {
    return createServiceClient()
}

export async function POST(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File | null

    if (!file) {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
        return NextResponse.json(
            { error: 'Only JPEG, PNG, or WebP images are allowed.' },
            { status: 400 },
        )
    }
    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'Image must be under 5 MB.' }, { status: 400 })
    }

    const admin = adminClient()

    // Buckets were created during migration; skip listBuckets/createBucket
    // (not on InsForge Storage SDK surface the same way as Supabase).

    const ext  = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    const path = `${user.id}.${ext}`

    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    const { error: uploadErr } = await admin.storage
        .from(BUCKET)
        .upload(path, blob)

    if (uploadErr) {
        return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    const publicRes = admin.storage.from(BUCKET).getPublicUrl(path)
    const publicUrl = publicRes.data?.publicUrl
    if (!publicUrl) {
        return NextResponse.json({ error: 'Could not resolve public URL' }, { status: 500 })
    }

    // Append a timestamp so the browser always fetches the new image
    const avatarUrl = `${publicUrl}?t=${Date.now()}`

    await prisma.profile.update({
        where: { id: user.id },
        data:  { avatarUrl },
    })

    return NextResponse.json({ success: true, avatarUrl })
}

export async function PATCH() {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const googleAvatarUrl = user.user_metadata?.avatar_url
    const isGoogleUser = user.identities?.some((i: { provider: string }) => i.provider === 'google')

    if (!isGoogleUser || !isGoogleAvatarUrl(googleAvatarUrl)) {
        return NextResponse.json({ error: 'No Google account linked.' }, { status: 400 })
    }

    const admin = adminClient()

    // Delete custom storage avatar (best-effort)
    await Promise.allSettled([
        admin.storage.from(BUCKET).remove([`${user.id}.jpg`]),
        admin.storage.from(BUCKET).remove([`${user.id}.png`]),
        admin.storage.from(BUCKET).remove([`${user.id}.webp`]),
    ])

    await prisma.profile.update({
        where: { id: user.id },
        data: { avatarUrl: googleAvatarUrl },
    })

    return NextResponse.json({ success: true, avatarUrl: googleAvatarUrl })
}

export async function DELETE() {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = adminClient()

    // Remove all possible extensions from storage (best-effort)
    await Promise.allSettled([
        admin.storage.from(BUCKET).remove([`${user.id}.jpg`]),
        admin.storage.from(BUCKET).remove([`${user.id}.png`]),
        admin.storage.from(BUCKET).remove([`${user.id}.webp`]),
    ])

    await prisma.profile.update({
        where: { id: user.id },
        data: { avatarUrl: null },
    })

    return NextResponse.json({ success: true })
}
