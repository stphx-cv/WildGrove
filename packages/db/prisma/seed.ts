// ══════════════════════════════════════════════════════════════════
// Wild Grove — Database Seed
// Seeds MenuCategory structure only. Menu items are managed via
// the Admin CMS — no fictional items in the seed.
// Run: npx prisma db seed
// Idempotent: safe to run multiple times (uses upsert).
// ══════════════════════════════════════════════════════════════════

import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ── Categories ──────────────────────────────────────────────────
// Base category structure in display order.
// Descriptions and bilingual names should be set via Admin → Menu.
const CATEGORIES = [
    { name: "Starters",           slug: "starters",    order: 0 },
    { name: "Bowls",              slug: "bowls",       order: 1 },
    { name: "Mains",              slug: "mains",       order: 2 },
    { name: "Sandwiches & Wraps", slug: "sandwiches",  order: 3 },
    { name: "Fresh Drinks",       slug: "drinks",      order: 4 },
    { name: "Desserts",           slug: "desserts",    order: 5 },
]

async function main() {
    console.log("🌱 Seeding Wild Grove database...")

    for (const cat of CATEGORIES) {
        await prisma.menuCategory.upsert({
            where: { slug: cat.slug },
            update: { name: cat.name, order: cat.order },
            create: cat,
        })
        console.log(`  ✓ Category: ${cat.name}`)
    }

    console.log("\n✅ Seed complete!")
    console.log(`   ${CATEGORIES.length} categories seeded · Add menu items via Admin → Menu`)
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
