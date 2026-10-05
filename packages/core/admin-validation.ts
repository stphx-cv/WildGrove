// ══════════════════════════════════════════════════════════════════
// Admin Validation Schemas — Zod schemas for all admin API routes
// Centralized for reuse in both server-side and client-side validation
// ══════════════════════════════════════════════════════════════════

import { z } from "zod"
import { isStoredReviewPhotoUrl, REVIEW_PHOTO_URL_MESSAGE } from "./reviews/photo-urls"

// ── Pagination (shared across all list endpoints) ──

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
})

// ── Menu ──

const skuBaseSchema = z
    .string()
    .min(2, "Product ID must be at least 2 characters")
    .max(30, "Product ID must be 30 characters or less")
    .regex(/^[A-Z0-9-]+$/, "Product ID must be uppercase letters, numbers, and hyphens only")

export const createMenuItemSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only").optional(),
    description: z.string().min(10, "Description must be at least 10 characters").max(500),
    prices: z.object({
        PEN: z.coerce.number().positive("PEN price must be a positive number").max(9999.99),
        USD: z.coerce.number().positive("USD price must be a positive number").max(9999.99),
    }),
    categoryId: z.string().min(1, "Category is required"),
    imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    images: z.array(z.string().url()).default([]),
    tags: z.array(z.string()).default([]),
    available: z.boolean().default(true),
    featured: z.boolean().default(false),
    featuredOrder: z.coerce.number().int().min(0).default(0),
    order: z.coerce.number().int().min(0).default(0),
    sku: skuBaseSchema,
    // Spanish (ES) translations — all optional
    nameEs:        z.string().min(2).max(100).optional(),
    descriptionEs: z.string().min(10).max(500).optional(),
    tagsEs:        z.array(z.string()).default([]).optional(),
    tagColors:     z.record(z.string(), z.string()).optional(),
    slugEs:        z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug ES must be lowercase with hyphens only").optional(),
    // Ingredients — per language, optional
    ingredients:   z.array(z.string().min(1).max(100)).default([]).optional(),
    ingredientsEs: z.array(z.string().min(1).max(100)).default([]).optional(),
})

export const updateMenuItemSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only").optional(),
    description: z.string().min(10).max(500).optional(),
    prices: z.object({
        PEN: z.coerce.number().positive().max(9999.99),
        USD: z.coerce.number().positive().max(9999.99),
    }).optional(),
    categoryId: z.string().min(1).optional(),
    imageUrl: z.string().url().optional().or(z.literal("")),
    images: z.array(z.string().url()).optional(),
    tags: z.array(z.string()).optional(),
    available: z.boolean().optional(),
    featured: z.boolean().optional(),
    featuredOrder: z.coerce.number().int().min(0).optional(),
    order: z.coerce.number().int().min(0).optional(),
    sku: skuBaseSchema.optional(),
    // Spanish (ES) translations — all optional
    nameEs:        z.string().min(2).max(100).optional(),
    descriptionEs: z.string().min(10).max(500).optional(),
    tagsEs:        z.array(z.string()).optional(),
    tagColors:     z.record(z.string(), z.string()).optional(),
    slugEs:        z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug ES must be lowercase with hyphens only").optional(),
    // Ingredients — per language
    ingredients:   z.array(z.string().min(1).max(100)).optional(),
    ingredientsEs: z.array(z.string().min(1).max(100)).optional(),
})

export const menuListQuerySchema = paginationSchema.extend({
    search: z.string().optional(),
    category: z.string().optional(),
    available: z.enum(["true", "false"]).optional(),
    draft: z.enum(["true", "false"]).optional(),
    /** Filter by parent. Pass "null" (string) to require parentId IS NULL. */
    parent: z.string().optional(),
})

// ── Draft-row operations (clone / duplicate) ──

export const createDraftFromParentSchema = z.object({
    label: z.string().min(1).max(120).optional(),
})

export const duplicateDraftSchema = z.object({
    mode: z.enum(["sibling", "orphan"]),
    label: z.string().min(1).max(120).optional(),
})

// ── Categories ──

export const createCategorySchema = z.object({
    name:   z.string().min(2, "Name must be at least 2 characters").max(50),
    nameEs: z.string().min(2, "Spanish name must be at least 2 characters").max(50),
    slug:   z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only").optional(),
    slugEs: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only").optional(),
    icon:   z.string().max(30).default("default").optional(),
    order:  z.coerce.number().int().min(0).default(0),
})

export const updateCategorySchema = z.object({
    name:   z.string().min(2).max(50).optional(),
    nameEs: z.string().min(2).max(50).optional().nullable(),
    slug:   z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only").optional(),
    slugEs: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only").optional().nullable(),
    icon:   z.string().max(30).optional(),
    order:  z.coerce.number().int().min(0).optional(),
})

// ── Discounts ──

export const createDiscountSchema = z
    .object({
        name: z.string().min(2, "Name must be at least 2 characters").max(100),
        description: z.string().max(500).optional(),
        type: z.enum(["COUPON", "AUTOMATIC"]),
        valueType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
        value: z.coerce.number().positive("Value must be positive"),
        valueUsd: z.number().positive().nullish(),
        code: z.string().min(3).max(20).toUpperCase().optional(),
        categoryId: z.string().nullable().optional(),
        categoryIds: z.array(z.string()).default([]),
        menuItemId: z.string().nullable().optional(),
        validFrom: z.string().datetime().optional(),
        validUntil: z.string().datetime().optional(),
        usageLimit: z.coerce.number().int().positive().optional(),
        perUserLimit: z.coerce.number().int().positive().optional(),
        active: z.boolean().default(true),
        applyToNone: z.boolean().default(false),
        excludedItemIds: z.array(z.string()).default([]),
    })
    .superRefine((data, ctx) => {
        if (data.type === "COUPON" && !data.code) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Coupon discounts require a code",
                path: ["code"],
            })
        }
        if (data.valueType === "PERCENTAGE" && data.value > 100) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Percentage cannot exceed 100", path: ["value"] })
        }
        if (data.valueType === "FIXED_AMOUNT" && (data.valueUsd == null || data.valueUsd <= 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "USD amount is required",
                path: ["valueUsd"],
            })
        }
    })

export const updateDiscountSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    type: z.enum(["COUPON", "AUTOMATIC"]).optional(),
    valueType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional(),
    value: z.coerce.number().positive().optional(),
    valueUsd: z.number().positive().nullish(),
    code: z.string().min(3).max(20).toUpperCase().optional(),
    categoryId: z.string().nullable().optional(),
    categoryIds: z.array(z.string()).optional(),
    menuItemId: z.string().nullable().optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
    usageLimit: z.coerce.number().int().positive().optional(),
    perUserLimit: z.coerce.number().int().positive().optional(),
    active: z.boolean().optional(),
    applyToNone: z.boolean().optional(),
    excludedItemIds: z.array(z.string()).optional(),
})

export const discountListQuerySchema = paginationSchema.extend({
    search: z.string().optional(),
    type: z.enum(["COUPON", "AUTOMATIC"]).optional(),
    active: z.enum(["true", "false"]).optional(),
})

// ── Reservations ──

export const reservationListQuerySchema = paginationSchema.extend({
    search: z.string().optional(),
    status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
    date: z.string().optional(), // ISO date string
    visibility: z.enum(["visible", "hidden", "all"]).optional().default("visible"),
})

export const updateReservationStatusSchema = z.object({
    status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
})

export const updateReservationSchema = z.object({
    date: z.string().datetime().optional(),
    partySize: z.coerce.number().int().min(1, "At least 1 guest").max(100, "Maximum 100 guests").optional(),
    notes: z.string().max(1000).optional().nullable(),
    status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
    hiddenByAdmin: z.boolean().optional(),
})

// ── Customers ──

export const customerListQuerySchema = paginationSchema.extend({
    search: z.string().optional(),
    status: z.enum(["all", "complete", "incomplete"]).default("all"),
})

// ADMIN can edit: name, username, phone
export const updateCustomerSchema = z.object({
    firstName: z.string().min(1).max(50).regex(/^[\p{L}\s'-]+$/u, "Invalid name characters").optional(),
    lastName: z.string().min(1).max(50).regex(/^[\p{L}\s'-]+$/u, "Invalid name characters").optional(),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid username characters").transform(v => v.toLowerCase()).optional(),
    phoneCountryCode: z.string().max(4).regex(/^\d+$/, "Must be digits only").optional().nullable(),
    phoneNumber: z.string().min(6).max(15).regex(/^\d+$/, "Must be digits only").optional().nullable(),
})

// OWNER can edit: everything ADMIN can + email + role + recovery
export const ownerUpdateCustomerSchema = updateCustomerSchema.extend({
    email: z.string().email("Invalid email address").optional(),
    role: z.enum(["CUSTOMER", "ADMIN", "OWNER"]).optional(),
    recoveryEmails: z.array(z.string().email("Invalid email")).optional(),
    recoveryPhones: z.array(z.string().min(8).max(20)).optional(),
})

// DELETE body — which related data to also delete
export const deleteCustomerSchema = z.object({
    deleteReservations: z.boolean().default(false),
    deleteChatSessions: z.boolean().default(false),
})

// ── Delivery Zones ──

const decimalPositive = z.coerce.number().nonnegative().max(99999.99)

const deliveryZoneBaseSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    type: z.enum(["AREA", "POLYGON", "RADIUS"]),
    fee: decimalPositive,
    feeUsd: decimalPositive,
    minOrder: decimalPositive.default(0),
    minOrderUsd: decimalPositive.default(0),
    estimatedMinutes: z.coerce.number().int().min(1).max(480).default(45),
    active: z.boolean().default(true),
    priority: z.coerce.number().int().min(0).max(100).default(0),
    // AREA fields
    country: z.string().max(100).optional().nullable(),
    region: z.string().max(100).optional().nullable(),
    province: z.string().max(100).optional().nullable(),
    district: z.string().max(100).optional().nullable(),
    // POLYGON/RADIUS fields
    centerLat: z.coerce.number().min(-90).max(90).optional().nullable(),
    centerLng: z.coerce.number().min(-180).max(180).optional().nullable(),
    radiusMeters: z.coerce.number().int().min(100).max(100000).optional().nullable(),
    polygon: z.array(z.tuple([z.number(), z.number()])).optional().nullable(),
})

export const createDeliveryZoneSchema = deliveryZoneBaseSchema.superRefine((data, ctx) => {
    if (data.type === "AREA" && !data.country && !data.region && !data.province && !data.district) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one area field (country, region, province, or district) is required", path: ["country"] })
    }
    if (data.type === "RADIUS") {
        if (data.centerLat == null || data.centerLng == null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Center coordinates are required for RADIUS zones", path: ["centerLat"] })
        }
        if (!data.radiusMeters) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Radius is required for RADIUS zones", path: ["radiusMeters"] })
        }
    }
    if (data.type === "POLYGON" && (!data.polygon || data.polygon.length < 3)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A polygon with at least 3 points is required", path: ["polygon"] })
    }
})

// PATCH accepts partial fields — no cross-field validation needed server-side for updates
export const updateDeliveryZoneSchema = deliveryZoneBaseSchema.partial()

export const deliveryZoneListQuerySchema = paginationSchema.extend({
    search: z.string().optional(),
    type: z.enum(["AREA", "POLYGON", "RADIUS"]).optional(),
    active: z.enum(["true", "false"]).optional(),
})

// ── Reviews ──

export const createReviewSchema = z.object({
    reservationId: z.string().min(1, "Reservation is required"),
    rating: z.coerce.number().int().min(1, "Minimum 1 star").max(5, "Maximum 5 stars"),
    comment: z.string().min(10, "Comment must be at least 10 characters").max(1000),
})

export const reviewListQuerySchema = paginationSchema.extend({
    approved: z.enum(["true", "false", "all", "hidden"]).default("all"),
})

export const updateReviewSchema = z.object({
    approved: z.boolean().optional(),
    hidden: z.boolean().optional(),
    pinned: z.boolean().optional(),
})

// ── Product Reviews ──

export const createProductReviewSchema = z.object({
    menuItemId:  z.string().min(1, "Product is required"),
    orderItemId: z.string().min(1, "Order item is required"),
    rating:      z.coerce.number().int().min(1, "Minimum 1 star").max(5, "Maximum 5 stars"),
    comment:     z.string().min(10, "Comment must be at least 10 characters").max(1000),
    photos:      z.array(z.string().url().refine(isStoredReviewPhotoUrl, REVIEW_PHOTO_URL_MESSAGE)).max(10).optional(),
})

export const updateProductReviewSchema = z.object({
    rating:  z.coerce.number().int().min(1).max(5).optional(),
    comment: z.string().min(10).max(1000).optional(),
    photos:  z.array(z.string().url().refine(isStoredReviewPhotoUrl, REVIEW_PHOTO_URL_MESSAGE)).max(10).optional(),
})

export const adminProductReviewListQuerySchema = paginationSchema.extend({
    approved:   z.enum(["true", "false", "all", "hidden"]).default("all"),
    menuItemId: z.string().optional(),
})

export const updateAdminProductReviewSchema = z.object({
    approved: z.boolean().optional(),
    hidden:   z.boolean().optional(),
    pinned:   z.boolean().optional(),
})

// ── Orders ──

export const orderListQuerySchema = paginationSchema.extend({
    search: z.string().optional(), // orderNumber or customerName
    status: z.enum(["PENDING", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED", "REFUNDED"]).optional(),
    fulfillment: z.enum(["PICKUP", "DELIVERY"]).optional(),
    date: z.string().optional(), // ISO date — filter by createdAt
    visibility: z.enum(["visible", "hidden", "all"]).optional().default("visible"),
})

export const updateOrderSchema = z.object({
    // Status transition
    status: z.enum(["PENDING", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"]).optional(),
    // Staff note
    note: z.string().min(1).max(280).optional(),
    // Estimated ready time
    estimatedReadyAt: z.string().datetime().optional().nullable(),
    // Hide from the CMS queue (customer view is unchanged)
    hiddenByAdmin: z.boolean().optional(),
})

export const cancelOrderSchema = z.object({
    reason: z.string().min(1, "Reason is required").max(280),
})

export const adminOverrideStatusSchema = z.object({
    status: z.enum(["PENDING", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"]),
    reason: z.string().min(1, "Reason is required").max(280),
})

// ── Wallets ──

export const walletListQuerySchema = paginationSchema.extend({
    search: z.string().optional(),
    currency: z.enum(["PEN", "USD"]).optional(),
})

export const rechargeWalletSchema = z.object({
    currency: z.enum(["PEN", "USD"]),
    amount: z.coerce.number()
        .positive("Amount must be positive")
        .max(99999.99, "Amount cannot exceed 99,999.99"),
    note: z.string().max(280).optional(),
    idempotencyKey: z.string().min(1).max(128),
})

export const adjustWalletSchema = z.object({
    currency: z.enum(["PEN", "USD"]),
    delta: z.coerce.number()
        .refine((v) => v !== 0, "Delta must be non-zero")
        .refine((v) => Math.abs(v) <= 99999.99, "Amount cannot exceed 99,999.99"),
    note: z.string().max(280).optional(),
})

/** OWNER sets wallet balance to an exact amount (not relative add/subtract). */
export const setWalletBalanceSchema = z.object({
    currency: z.enum(["PEN", "USD"]),
    balance: z.coerce.number()
        .min(0, "Balance cannot be negative")
        .max(99999.99, "Balance cannot exceed 99,999.99"),
    note: z.string().max(280).optional(),
})

export const walletLedgerQuerySchema = paginationSchema.extend({
    /** PEN | USD = one wallet; ALL = merged ledger (newest first across both) */
    currency: z.enum(["PEN", "USD", "ALL"]).optional(),
})

// ── Tickets ──

export const updateTicketSchema = z.object({
    status: z.enum(["OPEN", "IN_PROGRESS", "AWAITING_REPLY", "RESOLVED", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    // An empty string unassigns, like null.
    assignedAdminId: z.string().nullable().optional(),
})

// ── Draft guard: "Save & Leave" (publish) must match API rules ──

function firstZodIssueMessage(error: z.ZodError): string {
    const m = error.issues[0]?.message
    return m && m.length > 0 ? m : "Required fields are missing or invalid."
}

/** `null` = publish payload is valid; otherwise first Zod message for UI. */
export function getMenuItemPublishBlockedReason(isEditMode: boolean, payload: unknown): string | null {
    const result = isEditMode
        ? updateMenuItemSchema.safeParse(payload)
        : createMenuItemSchema.safeParse(payload)
    return result.success ? null : firstZodIssueMessage(result.error)
}

export function getCategoryPublishBlockedReason(isEditMode: boolean, payload: unknown): string | null {
    const result = isEditMode
        ? updateCategorySchema.safeParse(payload)
        : createCategorySchema.safeParse(payload)
    return result.success ? null : firstZodIssueMessage(result.error)
}

/** Uses create rules (incl. COUPON code) so incomplete drafts cannot "publish" from the guard. */
export function getDiscountPublishBlockedReason(payload: unknown): string | null {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        return "Required fields are missing or invalid."
    }
    const raw = payload as Record<string, unknown>
    const normalized = {
        ...raw,
        menuItemId: raw.menuItemId === null || raw.menuItemId === "" ? undefined : raw.menuItemId,
    }
    const result = createDiscountSchema.safeParse(normalized)
    return result.success ? null : firstZodIssueMessage(result.error)
}

// ── Type exports (inferred from schemas) ──

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>
export type CreateDraftFromParentInput = z.infer<typeof createDraftFromParentSchema>
export type DuplicateDraftInput = z.infer<typeof duplicateDraftSchema>
export type CreateDiscountInput = z.infer<typeof createDiscountSchema>
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>
export type UpdateReservationStatusInput = z.infer<typeof updateReservationStatusSchema>
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type OwnerUpdateCustomerInput = z.infer<typeof ownerUpdateCustomerSchema>
export type DeleteCustomerInput = z.infer<typeof deleteCustomerSchema>
export type CreateReviewInput = z.infer<typeof createReviewSchema>
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>
export type CreateProductReviewInput = z.infer<typeof createProductReviewSchema>
export type UpdateProductReviewInput = z.infer<typeof updateProductReviewSchema>
export type UpdateAdminProductReviewInput = z.infer<typeof updateAdminProductReviewSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type OrderListQueryInput = z.infer<typeof orderListQuerySchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>
export type AdminOverrideStatusInput = z.infer<typeof adminOverrideStatusSchema>
export type WalletListQueryInput = z.infer<typeof walletListQuerySchema>
export type RechargeWalletInput = z.infer<typeof rechargeWalletSchema>
export type AdjustWalletInput = z.infer<typeof adjustWalletSchema>
export type SetWalletBalanceInput = z.infer<typeof setWalletBalanceSchema>
export type WalletLedgerQueryInput = z.infer<typeof walletLedgerQuerySchema>
