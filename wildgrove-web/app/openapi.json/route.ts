// ══════════════════════════════════════════════════════════════════
// GET /openapi.json — the contract for /api/agent/v1.
//
// Describes exactly what exists and nothing aspirational: every path
// here answers.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wildgrove.cv"

const LOCALE_PARAM = {
    name: "locale",
    in: "query",
    required: false,
    description: "Language for names and descriptions. Defaults to en.",
    schema: { type: "string", enum: ["en", "es"], default: "en" },
} as const

const envelope = (dataSchema: unknown) => ({
    type: "object",
    required: ["success", "data"],
    properties: { success: { type: "boolean", const: true }, data: dataSchema },
})

const ERROR_RESPONSE = {
    description: "The request was rejected.",
    content: {
        "application/json": {
            schema: {
                type: "object",
                required: ["success", "error"],
                properties: {
                    success: { type: "boolean", const: false },
                    error: { type: "string" },
                },
            },
        },
    },
}

export async function GET() {
    const document = {
        openapi: "3.1.0",
        info: {
            title: "Wild Grove agent API",
            version: "1.0.0",
            description:
                "Public read-only data about the restaurant: the menu, opening hours and contact details, reservation availability, and approved guest reviews. No authentication, no writes. Wild Grove is a fictional restaurant built as a portfolio project.",
            license: { name: "Proprietary", url: `${SITE_URL}/en/terms` },
        },
        servers: [{ url: SITE_URL }],
        paths: {
            "/api/agent/v1/menu": {
                get: {
                    operationId: "getMenu",
                    summary: "The published menu, by category.",
                    parameters: [LOCALE_PARAM],
                    responses: {
                        "200": {
                            description: "The menu.",
                            content: {
                                "application/json": {
                                    schema: envelope({
                                        type: "object",
                                        properties: {
                                            locale: { type: "string" },
                                            currency: { type: "string" },
                                            categories: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        slug: { type: "string" },
                                                        name: { type: "string" },
                                                        items: {
                                                            type: "array",
                                                            items: {
                                                                type: "object",
                                                                properties: {
                                                                    slug: { type: "string" },
                                                                    name: { type: "string" },
                                                                    description: { type: "string" },
                                                                    price: {
                                                                        type: "object",
                                                                        properties: {
                                                                            amount: {
                                                                                type: ["number", "null"],
                                                                                description:
                                                                                    "What a guest pays today, after any automatic discount. Null when the dish has no price in this currency.",
                                                                            },
                                                                            listAmount: {
                                                                                type: ["number", "null"],
                                                                                description:
                                                                                    "The undiscounted price. Null unless a discount applies.",
                                                                            },
                                                                            discount: {
                                                                                type: ["string", "null"],
                                                                                description:
                                                                                    'Why amount differs from listAmount, e.g. "40% OFF". Null unless a discount applies.',
                                                                            },
                                                                            currency: { type: "string" },
                                                                        },
                                                                    },
                                                                    tags: {
                                                                        type: "array",
                                                                        items: { type: "string" },
                                                                    },
                                                                    url: {
                                                                        type: "string",
                                                                        format: "uri",
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    }),
                                },
                            },
                        },
                    },
                },
            },
            "/api/agent/v1/venue": {
                get: {
                    operationId: "getVenue",
                    summary: "Opening hours, address and contact details.",
                    parameters: [LOCALE_PARAM],
                    responses: {
                        "200": {
                            description: "Venue details.",
                            content: {
                                "application/json": {
                                    schema: envelope({
                                        type: "object",
                                        properties: {
                                            locale: { type: "string" },
                                            name: { type: "string" },
                                            timezone: { type: "string" },
                                            openingHours: {
                                                type: "array",
                                                items: { type: "string" },
                                            },
                                            address: { type: ["string", "null"] },
                                            phone: { type: ["string", "null"] },
                                            email: { type: ["string", "null"] },
                                            socials: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        network: { type: "string" },
                                                        handle: { type: "string" },
                                                        url: { type: "string" },
                                                    },
                                                },
                                            },
                                        },
                                    }),
                                },
                            },
                        },
                    },
                },
            },
            "/api/agent/v1/availability": {
                get: {
                    operationId: "getAvailability",
                    summary: "Whether a party can still book a given slot.",
                    description:
                        "Returns availability only. It never exposes any reservation, and it does not hold or create a booking.",
                    parameters: [
                        {
                            name: "date",
                            in: "query",
                            required: true,
                            schema: { type: "string", format: "date", examples: ["2026-10-01"] },
                        },
                        {
                            name: "time",
                            in: "query",
                            required: true,
                            schema: { type: "string", pattern: "^\\d{2}:\\d{2}$", examples: ["19:30"] },
                        },
                        {
                            name: "partySize",
                            in: "query",
                            required: true,
                            schema: { type: "integer", minimum: 1, examples: [2] },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Availability for that slot.",
                            content: {
                                "application/json": {
                                    schema: envelope({
                                        type: "object",
                                        properties: {
                                            date: { type: "string" },
                                            time: { type: "string" },
                                            partySize: { type: "integer" },
                                            available: { type: "boolean" },
                                            slotsLeft: { type: "integer" },
                                        },
                                    }),
                                },
                            },
                        },
                        "400": ERROR_RESPONSE,
                    },
                },
            },
            "/api/agent/v1/reviews": {
                get: {
                    operationId: "getReviews",
                    summary: "Approved guest reviews, newest first.",
                    parameters: [
                        {
                            name: "limit",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Reviews.",
                            content: {
                                "application/json": {
                                    schema: envelope({
                                        type: "object",
                                        properties: {
                                            total: { type: "integer" },
                                            count: { type: "integer" },
                                            reviews: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        rating: { type: "integer" },
                                                        comment: { type: ["string", "null"] },
                                                        createdAt: {
                                                            type: "string",
                                                            format: "date-time",
                                                        },
                                                        name: { type: "string" },
                                                    },
                                                },
                                            },
                                        },
                                    }),
                                },
                            },
                        },
                    },
                },
            },
        },
    }

    return NextResponse.json(document, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    })
}
