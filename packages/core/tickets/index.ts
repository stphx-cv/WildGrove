// ══════════════════════════════════════════════════════════════════
// Ticket System — Utilities for creating, managing, and querying
// support tickets. Handles atomic number generation, message
// creation, and file attachment uploads.
// ══════════════════════════════════════════════════════════════════

import { prisma } from "@wildgrove/db"
import { createServiceClient } from '../clients/admin'
import { randomUUID } from "crypto"
import type {
    Ticket,
    TicketMessage,
    TicketAttachment,
    TicketCategory,
    TicketPriority,
    TicketMessageSenderRole,
} from "@wildgrove/db"

// ── Constants ────────────────────────────────────────────────────

const BUCKET = "ticket-attachments"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 5

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

// Extensions allowed per declared MIME type. The stored filename
// extension is taken from this allowlist, never from raw user input.
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
    "application/pdf": ["pdf"],
    "text/plain": ["txt"],
    "application/msword": ["doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
}

// Leading "magic bytes" per MIME type. Used to confirm the real file
// content matches the declared type (a client can lie about file.type).
const MAGIC_BYTES: Record<string, number[][]> = {
    "image/jpeg": [[0xff, 0xd8, 0xff]],
    "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    "image/gif": [[0x47, 0x49, 0x46, 0x38]], // "GIF8"
    "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
    "application/msword": [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // OLE
    // .docx is a ZIP container
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        [0x50, 0x4b, 0x03, 0x04],
        [0x50, 0x4b, 0x05, 0x06],
        [0x50, 0x4b, 0x07, 0x08],
    ],
}

/** Confirm the file's real leading bytes match its declared MIME type. */
async function hasValidMagicBytes(file: File): Promise<boolean> {
    const mime = file.type
    // Plain text has no signature; size + MIME + extension are enough.
    if (mime === "text/plain") return true

    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())

    if (mime === "image/webp") {
        // "RIFF" .... "WEBP"
        return (
            header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
            header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
        )
    }

    const signatures = MAGIC_BYTES[mime]
    if (!signatures) return false
    return signatures.some((sig) => sig.every((byte, i) => header[i] === byte))
}

// ── InsForge Admin Client ────────────────────────────────────────

function getInsforgeAdmin() {
    return createServiceClient()
}

// ── Ticket Number ────────────────────────────────────────────────

/**
 * Atomically increment the counter and return the new value. The row is
 * created on first use, as the order counter does, so a database without
 * it hands out #WG-0001 instead of failing.
 */
async function generateTicketNumber(): Promise<number> {
    const counter = await prisma.ticketCounter.upsert({
        where: { id: "global" },
        create: { id: "global", current: 1 },
        update: { current: { increment: 1 } },
    })
    return counter.current
}

/** Format a numeric ticket number for display: #WG-0001 */
export function formatTicketNumber(num: number): string {
    return `#WG-${String(num).padStart(4, "0")}`
}

// ── Create Ticket ────────────────────────────────────────────────

export interface CreateTicketInput {
    profileId: string
    category: TicketCategory
    subject: string
    message: string
    priority?: TicketPriority
    locale?: string
    files?: File[]
}

export interface CreateTicketResult {
    ticket: Ticket
    firstMessage: TicketMessage
    attachments: TicketAttachment[]
}

/**
 * Creates a new ticket with its first message and any file attachments.
 * Uses a raw SQL UPDATE for atomic ticket number generation.
 */
export async function createTicketWithMessage(
    input: CreateTicketInput,
): Promise<CreateTicketResult> {
    const ticketNumber = await generateTicketNumber()

    const ticket = await prisma.ticket.create({
        data: {
            ticketNumber,
            profileId: input.profileId,
            category: input.category,
            subject: input.subject,
            status: "OPEN",
            priority: input.priority ?? "MEDIUM",
            locale: input.locale ?? "en",
        },
    })

    const firstMessage = await prisma.ticketMessage.create({
        data: {
            ticketId: ticket.id,
            senderId: input.profileId,
            senderRole: "USER",
            content: input.message,
        },
    })

    // Upload attachments if any
    let attachments: TicketAttachment[] = []
    if (input.files && input.files.length > 0) {
        attachments = await uploadTicketAttachments(
            ticket.id,
            firstMessage.id,
            input.files,
        )
    }

    return { ticket, firstMessage, attachments }
}

// ── Add Message ──────────────────────────────────────────────────

export async function addTicketMessage(
    ticketId: string,
    senderId: string,
    senderRole: TicketMessageSenderRole,
    content: string,
    isInternal: boolean = false,
): Promise<TicketMessage> {
    // Update ticket timestamp
    await prisma.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
    })

    return prisma.ticketMessage.create({
        data: {
            ticketId,
            senderId,
            senderRole,
            content,
            isInternal,
        },
    })
}

// ── File Attachments ─────────────────────────────────────────────

export async function validateFiles(files: File[]): Promise<string | null> {
    if (files.length > MAX_FILES) {
        return `Maximum ${MAX_FILES} files allowed`
    }
    for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
            return `File "${file.name}" exceeds 10 MB limit`
        }
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return `File type "${file.type}" is not allowed`
        }
        // Declared extension must match the declared MIME type.
        const ext = (file.name.split(".").pop() || "").toLowerCase()
        if (!(ALLOWED_EXTENSIONS[file.type] ?? []).includes(ext)) {
            return `File "${file.name}" has an extension that does not match its type`
        }
        // Real content must match the declared type (anti-spoofing).
        if (!(await hasValidMagicBytes(file))) {
            return `File "${file.name}" content does not match its declared type`
        }
    }
    return null
}

export async function uploadTicketAttachments(
    ticketId: string,
    messageId: string,
    files: File[],
): Promise<TicketAttachment[]> {
    const admin = getInsforgeAdmin()

    // Bucket `ticket-attachments` is created during InsForge storage migration.

    const attachments: TicketAttachment[] = []

    for (const file of files) {
        // Derive the extension from the allowlist for the declared MIME
        // type — never trust the raw user-supplied filename for the path.
        const declaredExt = (file.name.split(".").pop() || "").toLowerCase()
        const allowedExts = ALLOWED_EXTENSIONS[file.type] ?? []
        const ext = allowedExts.includes(declaredExt) ? declaredExt : (allowedExts[0] ?? "bin")
        const storagePath = `${ticketId}/${messageId}/${randomUUID()}.${ext}`

        const blob = new Blob([await file.arrayBuffer()], { type: file.type })
        const { error: uploadErr } = await admin.storage
            .from(BUCKET)
            .upload(storagePath, blob)

        if (uploadErr) {
            console.error(`[tickets] Upload failed for ${file.name}:`, uploadErr)
            continue
        }

        // Bucket is private: persist the storage PATH (not a public URL).
        // The apps serve it through their own attachment routes.
        const attachment = await prisma.ticketAttachment.create({
            data: {
                messageId,
                fileName: file.name,
                fileUrl: storagePath,
                fileSize: file.size,
                mimeType: file.type,
            },
        })

        attachments.push(attachment)
    }

    return attachments
}

// ── Attachment access (private bucket) ───────────────────────────

/**
 * Resolve the storage path from a stored fileUrl. New rows store the
 * bare path; legacy rows may hold a full public URL like
 * ".../storage/v1/object/public/ticket-attachments/<path>". Either way
 * we extract the path so the server can read it from the private bucket.
 */
export function extractStoragePath(stored: string): string {
    const marker = `/${BUCKET}/`
    const idx = stored.indexOf(marker)
    if (idx !== -1) return stored.slice(idx + marker.length)
    return stored
}

/**
 * Same-origin URL of the route that serves one attachment. Both apps
 * expose it under the same path, each with its own access check.
 */
export function ticketAttachmentUrl(ticketId: string, attachmentId: string): string {
    return `/api/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`
}

export interface AttachmentLink {
    id: string
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
}

/**
 * Map ticket attachment records to a response shape whose fileUrl
 * points at the app's attachment route instead of the storage path.
 * Used by the user + admin ticket detail endpoints.
 */
export function toAttachmentLinks(
    ticketId: string,
    attachments: { id: string; fileName: string; fileUrl: string; fileSize: number; mimeType: string }[],
): AttachmentLink[] {
    return attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: ticketAttachmentUrl(ticketId, a.id),
        fileSize: a.fileSize,
        mimeType: a.mimeType,
    }))
}

// Types the browser may render in place; anything else is downloaded.
const INLINE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
])

/**
 * Read one attachment from the private bucket with the server client
 * and return it as an HTTP response. Callers must check access first.
 * The stored mimeType is only trusted when it is on the upload allowlist.
 */
export async function ticketAttachmentResponse(
    attachment: { fileName: string; fileUrl: string; mimeType: string },
): Promise<Response> {
    const path = extractStoragePath(attachment.fileUrl)
    const { data, error } = await getInsforgeAdmin().storage.from(BUCKET).download(path)

    if (error || !data) {
        const status = error?.statusCode === 404 ? 404 : 502
        if (status !== 404) console.error("[tickets] Attachment read failed:", error)
        return Response.json(
            { success: false, error: status === 404 ? "Attachment not found" : "Attachment unavailable" },
            { status, headers: { "Cache-Control": "private, no-store" } },
        )
    }

    const mimeType = ALLOWED_MIME_TYPES.has(attachment.mimeType)
        ? attachment.mimeType
        : "application/octet-stream"
    const disposition = INLINE_MIME_TYPES.has(mimeType) ? "inline" : "attachment"
    const asciiName = attachment.fileName.replace(/[^\x20-\x7e]|["\\]/g, "_")

    return new Response(data.stream(), {
        status: 200,
        headers: {
            "Content-Type": mimeType,
            "Content-Length": String(data.size),
            "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    })
}

// The storage API returns at most 1000 keys per page and deletes at most
// 1000 keys per call.
const STORAGE_PAGE_SIZE = 1000

type ListedObject = { key?: unknown }

/**
 * Keys of one page of a storage listing. The SDK types the body as
 * `{ objects }`, but the backend sends `{ data }`; accept either so the
 * cleanup keeps working when one side catches up with the other.
 */
function listedKeys(body: unknown): string[] {
    const page = body as { objects?: ListedObject[]; data?: ListedObject[] } | null
    const objects = page?.objects ?? page?.data ?? []
    return objects
        .map((o) => o.key)
        .filter((k): k is string => typeof k === "string" && k.length > 0)
}

/** Every key under a prefix, following the listing's pages. */
async function listAllKeys(prefix: string): Promise<string[]> {
    const bucket = getInsforgeAdmin().storage.from(BUCKET)
    const keys: string[] = []

    for (;;) {
        const { data, error } = await bucket.list({ prefix, limit: STORAGE_PAGE_SIZE, offset: keys.length })
        if (error) throw error

        const page = listedKeys(data)
        keys.push(...page)

        const total = (data as { pagination?: { total?: number } } | null)?.pagination?.total
        if (page.length === 0 || (typeof total === "number" && keys.length >= total)) return keys
    }
}

/** Delete all storage files for a ticket (used when deleting a ticket). */
export async function deleteTicketStorage(ticketId: string): Promise<void> {
    try {
        // Collect first, delete after: deleting while paging by offset
        // would shift later pages and skip files.
        const keys = await listAllKeys(`${ticketId}/`)
        const bucket = getInsforgeAdmin().storage.from(BUCKET)

        for (let i = 0; i < keys.length; i += STORAGE_PAGE_SIZE) {
            const { data, error } = await bucket.remove(keys.slice(i, i + STORAGE_PAGE_SIZE))
            if (error) throw error

            const results = (data as { results?: { key?: string; status?: string }[] } | null)?.results ?? []
            const failed = results.filter((r) => r.status !== "deleted")
            if (failed.length > 0) {
                console.error(`[tickets] ${failed.length} file(s) not deleted for ticket ${ticketId}`)
            }
        }
    } catch (err) {
        console.error("[tickets] Storage cleanup error:", err)
    }
}
