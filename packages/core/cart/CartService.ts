// ══════════════════════════════════════════════════════════════════
// CartService — server-side cart operations
//
// • Authenticated users: cart stored in DB (persistent)
// • Guests: cart lives in localStorage on the client (key: wg:cart)
//   and is merged into DB on login via mergeGuestCart()
// • All amounts use Prisma.Decimal
// ══════════════════════════════════════════════════════════════════

import { Prisma } from "@wildgrove/db"
import { prisma } from "@wildgrove/db"
import type { ActiveMenuDiscount } from '../menu-discounts'
import { getDiscountForItem, computeDiscountedPrice } from '../menu-discounts'
import { onSaleMenuItemWhere } from '../menu-visibility'

// ─── Types ────────────────────────────────────────────────────────

export interface CartItemInput {
  menuItemId: string
  quantity: number
  notes?: string | null
}

/** Minimal guest cart item from localStorage */
export interface GuestCartItem {
  menuItemId: string
  quantity: number
  notes?: string | null
}

export interface CartTotals {
  subtotal: Prisma.Decimal
  discountTotal: Prisma.Decimal
  discountedSubtotal: Prisma.Decimal
  itemCount: number
}

export interface PricedCart extends CartTotals {
  cartId: string
  currency: string
  items: PricedCartItem[]
}

export interface PricedCartItem {
  id: string
  menuItemId: string
  name: string
  imageUrl: string | null
  quantity: number
  unitPrice: Prisma.Decimal
  effectiveUnitPrice: Prisma.Decimal
  lineTotal: Prisma.Decimal
  notes: string | null
  discountLabel?: string
}

// ─── Cart select shape ────────────────────────────────────────────

const cartWithItems = {
  id: true,
  currency: true,
  items: {
    select: {
      id: true,
      menuItemId: true,
      quantity: true,
      unitPrice: true,
      notes: true,
      menuItem: {
        select: {
          id: true,
          name: true,
          nameEs: true,
          imageUrl: true,
          prices: true,
          available: true,
          categoryId: true,
        },
      },
    },
  },
} as const

// ─── Service ──────────────────────────────────────────────────────

export const CartService = {
  /**
   * Get the cart for a logged-in user.
   * Returns null if no cart exists yet.
   */
  async getCart(profileId: string) {
    return prisma.cart.findUnique({
      where: { profileId },
      select: cartWithItems,
    })
  },

  /**
   * Add or increment an item in the cart.
   * Creates the cart if it doesn't exist.
   * The currency is locked at cart creation (cannot mix currencies).
   */
  async addItem(profileId: string, input: CartItemInput, currency: string) {
    const { menuItemId, quantity, notes } = input

    // Fetch current price for snapshot
    const menuItem = await prisma.menuItem.findUniqueOrThrow({
      where: { id: menuItemId },
      select: { prices: true, name: true },
    })

    // A draft, or a dish that is not available, is not on sale.
    const onSale = await prisma.menuItem.count({
      where: { AND: [onSaleMenuItemWhere, { id: menuItemId }] },
    })
    if (onSale === 0) {
      throw new Error('This item is currently unavailable')
    }

    const prices = menuItem.prices as Record<string, number>
    const unitPrice = new Prisma.Decimal(prices[currency] ?? 0)

    return prisma.$transaction(async (tx) => {
      // Upsert cart
      let cart = await tx.cart.findUnique({
        where: { profileId },
        select: { id: true, currency: true },
      })

      if (!cart) {
        cart = await tx.cart.create({
          data: { profileId, currency },
          select: { id: true, currency: true },
        })
      }

      // Upsert cart item (increment if already exists)
      const existing = await tx.cartItem.findUnique({
        where: { cartId_menuItemId: { cartId: cart.id, menuItemId } },
        select: { id: true, quantity: true },
      })

      if (existing) {
        return tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + quantity,
            notes: notes ?? undefined,
          },
        })
      }

      return tx.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId,
          quantity,
          unitPrice,
          notes,
        },
      })
    })
  },

  /**
   * Update the quantity of a cart item.
   * Set quantity = 0 to remove.
   */
  async updateQuantity(cartItemId: string, profileId: string, quantity: number) {
    if (quantity <= 0) {
      return CartService.removeItem(cartItemId, profileId)
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: cartItemId, cart: { profileId } },
      select: { id: true },
    })
    if (!item) throw new Error('Cart item not found')

    return prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    })
  },

  /**
   * Remove a single item from the cart.
   */
  async removeItem(cartItemId: string, profileId: string) {
    const item = await prisma.cartItem.findFirst({
      where: { id: cartItemId, cart: { profileId } },
      select: { id: true },
    })
    if (!item) throw new Error('Cart item not found')

    return prisma.cartItem.delete({ where: { id: cartItemId } })
  },

  /**
   * Remove exactly the lines that were quoted, with the quoted quantity.
   * Runs on the caller's transaction so a failed payment puts the lines back.
   * `empty` means every quoted line is already gone. `changed` means at least
   * one line is missing or no longer has the quoted quantity.
   */
  async removeQuotedLines(
    profileId: string,
    lines: { menuItemId: string; quantity: number }[],
    tx: Prisma.TransactionClient,
  ): Promise<'removed' | 'empty' | 'changed'> {
    if (lines.length === 0) return 'empty'

    const cart = await tx.cart.findUnique({
      where: { profileId },
      select: { id: true },
    })
    if (!cart) return 'empty'

    let missing = 0
    for (const line of lines) {
      const deleted = await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          menuItemId: line.menuItemId,
          quantity: line.quantity,
        },
      })
      if (deleted.count === 0) missing += 1
    }
    if (missing === 0) return 'removed'
    if (missing !== lines.length) return 'changed'

    const stillThere = await tx.cartItem.count({
      where: {
        cartId: cart.id,
        menuItemId: { in: lines.map((line) => line.menuItemId) },
      },
    })
    return stillThere === 0 ? 'empty' : 'changed'
  },

  /**
   * Merge guest cart (from localStorage) into the user's DB cart on login.
   * Existing items are incremented, new items are added.
   * The guest cart currency is used if no server cart exists yet.
   */
  async mergeGuestCart(guestItems: GuestCartItem[], profileId: string, currency: string) {
    for (const item of guestItems) {
      try {
        await CartService.addItem(profileId, item, currency)
      } catch {
        // Skip unavailable items silently — guest cart may be stale
      }
    }
  },

  /**
   * Update the currency of an existing cart.
   * Does nothing if no cart exists yet, or if it is already in that currency.
   * While dual currency is off, the cart routes call this to move a cart kept
   * in the other currency to the store's.
   */
  async changeCurrency(profileId: string, newCurrency: string) {
    const cart = await prisma.cart.findUnique({
      where: { profileId },
      select: { id: true, currency: true },
    })
    if (!cart || cart.currency === newCurrency) return

    await prisma.cart.update({
      where: { id: cart.id },
      data: { currency: newCurrency },
    })
  },

  /**
   * Calculate cart totals with optional active (automatic) discounts.
   * Returns a fully priced cart ready for checkout preview.
   */
  async priceCart(
    profileId: string,
    opts: {
      discounts?: ActiveMenuDiscount[]
    } = {},
  ): Promise<PricedCart | null> {
    const cart = await prisma.cart.findUnique({
      where: { profileId },
      select: cartWithItems,
    })

    if (!cart || cart.items.length === 0) return null

    const { discounts = [] } = opts

    const allDiscounts = [...discounts]

    let subtotal = new Prisma.Decimal(0)
    let discountTotal = new Prisma.Decimal(0)

    const items: PricedCartItem[] = cart.items.map((item) => {
      const prices = item.menuItem.prices as Record<string, number>
      const unitPrice = new Prisma.Decimal(prices[cart.currency] ?? item.unitPrice)
      const discount = getDiscountForItem(
        { id: item.menuItemId, categoryId: item.menuItem.categoryId },
        allDiscounts,
      )

      const effectiveUnitPrice = discount
        ? new Prisma.Decimal(computeDiscountedPrice(Number(unitPrice), discount, cart.currency))
        : unitPrice

      const lineTotal = effectiveUnitPrice.mul(item.quantity)
      const lineDiscount = unitPrice.sub(effectiveUnitPrice).mul(item.quantity)

      subtotal = subtotal.add(unitPrice.mul(item.quantity))
      discountTotal = discountTotal.add(lineDiscount)

      return {
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.menuItem.name,
        imageUrl: item.menuItem.imageUrl,
        quantity: item.quantity,
        unitPrice,
        effectiveUnitPrice,
        lineTotal,
        notes: item.notes,
      }
    })

    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

    return {
      cartId: cart.id,
      currency: cart.currency,
      subtotal,
      discountTotal,
      discountedSubtotal: subtotal.sub(discountTotal),
      itemCount,
      items,
    }
  },
}
