// ══════════════════════════════════════════════════════════════════
// OrderService — order lifecycle management
//
// createOrder() pipeline:
//  Outside the transaction: price the cart, check every line is still on sale,
//  resolve the zone, check the balance.
//  Inside one transaction:
//   1. Remove the quoted cart lines, or abort without charging
//   2. Take the next order number
//   3. Assign the billing document number, unless the order has none
//   4. Create the order, its lines, and paidAt
//   5. Charge the provider, with the order id as the reference
//   6. Write the order events
//  After commit: notify staff. Mail is sent by the checkout route.
//
// transition() — state machine with allowed transitions table
// cancel()     — cancel + refund if paid
// ══════════════════════════════════════════════════════════════════

import {
  Prisma,
  OrderStatus,
  FulfillmentMethod,
  PaymentMethod,
  BillingDocumentType,
} from "@wildgrove/db"
import { prisma } from "@wildgrove/db"
import { CartService } from '../cart/CartService'
import {
  ZoneResolver,
  ZoneNotFoundError,
  MinOrderNotMetError,
} from '../delivery/ZoneResolver'
import { getProvider } from '../payments/registry'
import { createAdminNotificationForAllAdmins } from '../admin-notifications'
import { broadcastUserOrderStatus } from './broadcastUserOrderUpdate'
import { maybeSendProductReviewInvite } from './sendProductReviewInvite'
import type { ActiveMenuDiscount } from '../menu-discounts'
import { onSaleMenuItemWhere } from '../menu-visibility'

// ─── Allowed status transitions ──────────────────────────────────

const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COMPLETED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
}

/** Statuses from which a user can self-cancel */
const USER_CANCELLABLE: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.PREPARING]

// ─── Input types ──────────────────────────────────────────────────

// ─── Billing document input ───────────────────────────────────────

/** Common to both document types */
interface BillingBase {
  documentType: BillingDocumentType
}

interface BoletaInput extends BillingBase {
  documentType: 'BOLETA'
  buyerDni?: string
}

interface FacturaInput extends BillingBase {
  documentType: 'FACTURA'
  fiscalRuc: string
  fiscalLegalName: string
  fiscalAddress?: string
}

export type BillingDocumentInput = BoletaInput | FacturaInput

// ─── Main input ───────────────────────────────────────────────────

export interface CreateOrderInput {
  profileId: string
  paymentMethod: PaymentMethod
  fulfillment: FulfillmentMethod
  currency: string
  idempotencyKey: string
  scheduledFor?: Date
  addressId?: string
  customerPhone?: string
  customerName?: string
  notes?: string
  locale?: string
  activeDiscounts?: ActiveMenuDiscount[]
  /**
   * The sales receipt or invoice to issue. Omitted, a sales receipt. `null`
   * when the owner switched both off: the order has no document series or
   * number, and `documentType` keeps the column default the schema requires.
   */
  billing?: BillingDocumentInput | null
}

export interface CreateOrderResult {
  orderId: string
  orderNumber: number
  total: Prisma.Decimal
  currency: string
}

export class OrderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'OrderError'
  }
}

// ─── Service ──────────────────────────────────────────────────────

export const OrderService = {
  /**
   * Turns the quoted cart into a paid order in one transaction.
   * The cart lines, the order number, the order, and the charge commit
   * together. If any of those steps fails, none of them remain.
   */
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const {
      profileId,
      paymentMethod,
      fulfillment,
      currency,
      idempotencyKey,
      scheduledFor,
      addressId,
      customerPhone,
      customerName,
      notes,
      locale = 'en',
      activeDiscounts = [],
      billing = { documentType: 'BOLETA' } as BillingDocumentInput,
    } = input

    // 1. Price the cart
    const pricedCart = await CartService.priceCart(profileId, {
      discounts: activeDiscounts,
    })

    if (!pricedCart || pricedCart.items.length === 0) {
      throw new OrderError('Your cart is empty', 'CART_EMPTY')
    }

    // A dish switched off, or a draft, is not charged, as when adding it.
    const quotedIds = [...new Set(pricedCart.items.map((item) => item.menuItemId))]
    const onSale = await prisma.menuItem.count({
      where: { AND: [onSaleMenuItemWhere, { id: { in: quotedIds } }] },
    })
    if (onSale !== quotedIds.length) {
      throw new OrderError('An item in your cart is no longer available', 'ITEM_UNAVAILABLE')
    }

    // 2. Resolve delivery zone
    let deliveryZoneId: string | undefined
    let deliveryZoneName: string | undefined
    let deliveryFee = new Prisma.Decimal(0)
    let deliveryAddress: string | undefined
    let deliveryAddressDetail: string | undefined
    let deliveryLat: Prisma.Decimal | undefined
    let deliveryLng: Prisma.Decimal | undefined

    if (fulfillment === FulfillmentMethod.DELIVERY) {
      if (!addressId) throw new OrderError('Delivery address is required', 'ADDRESS_REQUIRED')

      const address = await prisma.userAddress.findFirst({
        where: { id: addressId, profileId },
        select: {
          fullAddress: true,
          detail: true,
          lat: true,
          lng: true,
          district: true,
          province: true,
          region: true,
          country: true,
        },
      })

      if (!address) throw new OrderError('Address not found', 'ADDRESS_NOT_FOUND')

      const zone = await ZoneResolver.resolveZone({
        lat: address.lat ? Number(address.lat) : null,
        lng: address.lng ? Number(address.lng) : null,
        components: {
          district: address.district,
          province: address.province,
          region: address.region,
          country: address.country,
        },
      })

      ZoneResolver.validateMinOrder(zone, currency, pricedCart.discountedSubtotal)

      deliveryZoneId = zone.id
      deliveryZoneName = zone.name
      deliveryFee = ZoneResolver.getFee(zone, currency)
      deliveryAddress = address.fullAddress
      deliveryAddressDetail = address.detail ?? undefined
      deliveryLat = address.lat ?? undefined
      deliveryLng = address.lng ?? undefined
    }

    const total = pricedCart.discountedSubtotal.add(deliveryFee)

    // 3. Check payment provider availability
    const provider = getProvider(paymentMethod)
    const available = await provider.isAvailable({ profileId, currency, total })
    if (!available) {
      throw new OrderError(
        'Insufficient balance. Please ask the owner to top up your wallet.',
        'INSUFFICIENT_BALANCE',
      )
    }

    // 4. Cart lines, order number, order, and charge, in that lock order.
    const order = await prisma.$transaction(async (tx) => {
      const removal = await CartService.removeQuotedLines(
        profileId,
        pricedCart.items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        })),
        tx,
      )
      if (removal === 'empty') throw new OrderError('Your cart is empty', 'CART_EMPTY')
      if (removal === 'changed') throw new OrderError('Your cart changed before payment', 'CART_CHANGED')

      const counter = await tx.orderCounter.upsert({
        where: { id: 'global' },
        create: { id: 'global', current: 1 },
        update: { current: { increment: 1 } },
      })
      const orderNumber = counter.current

      // Billing document: series, correlative and buyer fields. An order
      // without a document takes no number, so the counter is not touched.
      let documentFields: {
        documentType?: BillingDocumentType
        documentSeries?: string
        documentNumber?: string
        buyerDni?: string
        fiscalRuc?: string
        fiscalLegalName?: string
        fiscalAddress?: string
      } = {}
      if (billing) {
        // Determine billing series from AppSettings (fallback to schema defaults)
        const settings = await tx.appSettings.findUnique({
          where: { key: 'global' },
          select: { boletaSeries: true, facturaSeries: true },
        })

        const isFactura = billing.documentType === BillingDocumentType.FACTURA
        const series = isFactura
          ? (settings?.facturaSeries ?? 'F001')
          : (settings?.boletaSeries ?? 'B001')

        // Atomic correlative — upsert to handle first-ever document in this series
        const docCounter = await tx.documentCounter.upsert({
          where: { id: series },
          create: { id: series, current: 1 },
          update: { current: { increment: 1 } },
        })
        const documentNumber = String(docCounter.current).padStart(8, '0')

        // Billing-specific fields
        const billingFields =
          billing.documentType === BillingDocumentType.BOLETA
            ? { buyerDni: billing.buyerDni }
            : {
                fiscalRuc: billing.fiscalRuc,
                fiscalLegalName: billing.fiscalLegalName,
                fiscalAddress: billing.fiscalAddress,
              }

        documentFields = {
          documentType: billing.documentType,
          documentSeries: series,
          documentNumber,
          ...billingFields,
        }
      }

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          profileId,
          status: OrderStatus.PENDING,
          fulfillment,
          currency,
          subtotal: pricedCart.subtotal,
          discountTotal: pricedCart.discountTotal,
          deliveryFee,
          total,
          paymentMethod,
          paidAt: new Date(),
          scheduledFor,
          deliveryAddress,
          deliveryAddressDetail,
          deliveryLat,
          deliveryLng,
          deliveryZoneId,
          deliveryZoneName,
          customerPhone,
          customerName,
          notes,
          locale,
          ...documentFields,
          items: {
            create: pricedCart.items.map((item) => ({
              menuItemId: item.menuItemId,
              nameSnapshot: item.name,
              quantity: item.quantity,
              listUnitPrice: item.unitPrice,
              unitPrice: item.effectiveUnitPrice,
              lineTotal: item.lineTotal,
              notes: item.notes,
            })),
          },
        },
        select: { id: true, orderNumber: true, total: true, currency: true },
      })

      await provider.charge({
        profileId,
        currency,
        amount: total,
        orderId: newOrder.id,
        idempotencyKey,
        tx,
      })

      await tx.orderEvent.create({
        data: {
          orderId: newOrder.id,
          type: 'CREATED',
          message: `Order #${orderNumber} created`,
        },
      })

      await tx.orderEvent.create({
        data: {
          orderId: newOrder.id,
          type: 'PAID',
          message: `Payment received via ${paymentMethod}`,
        },
      })

      return newOrder
    })

    // 5. Notify admins (fire-and-forget)
    createAdminNotificationForAllAdmins({
      type: 'ORDER_CREATED',
      entityType: 'ORDER',
      entityId: order.id,
      title: `New order #${order.orderNumber}`,
      message: `A new order has been placed (${currency} ${order.total.toFixed(2)})`,
      href: `/orders/${order.id}`,
    }).catch(() => null)

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
    }
  },

  /**
   * Advance an order through the status machine.
   * actorId = admin/staff profile ID performing the action.
   */
  async transition(orderId: string, nextStatus: OrderStatus, actorId: string) {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, status: true, profileId: true, orderNumber: true },
    })

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? []
    if (!allowed.includes(nextStatus)) {
      throw new OrderError(
        `Cannot transition from ${order.status} to ${nextStatus}`,
        'INVALID_TRANSITION',
      )
    }

    // Cancel through the refund path, and do it before opening another transaction.
    if (nextStatus === OrderStatus.CANCELLED) {
      return this.cancel(orderId, 'Cancelled by staff', actorId)
    }

    const updated = await prisma.$transaction(async (tx) => {
      // The write only lands if the order is still in the status this call read.
      const written = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: nextStatus },
      })
      if (written.count === 0) {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        })
        const found = current?.status ?? order.status
        throw new OrderError(
          `Cannot transition from ${found} to ${nextStatus}`,
          'INVALID_TRANSITION',
        )
      }

      await tx.orderEvent.create({
        data: {
          orderId,
          type: 'STATUS_CHANGED',
          message: `Status changed to ${nextStatus}`,
          actorId,
        },
      })

      return { id: order.id, status: nextStatus, orderNumber: order.orderNumber }
    })

    void broadcastUserOrderStatus(order.profileId, {
      orderId: updated.id,
      status: updated.status,
    }).catch(() => null)

    if (nextStatus === OrderStatus.COMPLETED) {
      void maybeSendProductReviewInvite(orderId)
    }

    return updated
  },

  /**
   * Cancel an order and automatically refund the wallet.
   * Users can only cancel their own order, and only PENDING or PREPARING.
   * Admins can cancel any non-terminal state.
   *
   * With `byUser`, an order that belongs to someone else answers exactly like
   * one that does not exist (NOT_FOUND), so the two cases cannot be told apart.
   */
  async cancel(
    orderId: string,
    reason: string,
    actorId: string,
    opts: { byUser?: boolean } = {},
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: opts.byUser ? { id: orderId, profileId: actorId } : { id: orderId },
        select: {
          id: true,
          status: true,
          profileId: true,
          total: true,
          currency: true,
          paymentMethod: true,
          paidAt: true,
          orderNumber: true,
        },
      })

      if (!order) {
        throw new OrderError('Order not found', 'NOT_FOUND')
      }

      // A closed order answers ALREADY_TERMINAL before the customer-only check,
      // including an order that was already refunded.
      const terminal: OrderStatus[] = [
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
      ]
      if (terminal.includes(order.status)) {
        throw new OrderError(`Order is already ${order.status}`, 'ALREADY_TERMINAL')
      }

      if (opts.byUser && !USER_CANCELLABLE.includes(order.status)) {
        throw new OrderError(
          'This order can no longer be cancelled by the customer',
          'CANCEL_NOT_ALLOWED',
        )
      }

      const allowed: OrderStatus[] = opts.byUser
        ? USER_CANCELLABLE
        : [
            OrderStatus.PENDING,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.OUT_FOR_DELIVERY,
          ]
      const nextStatus = order.paidAt ? OrderStatus.REFUNDED : OrderStatus.CANCELLED

      // Lock the order before the wallet. A second cancel waits, re-reads the
      // condition, and touches nothing.
      const written = await tx.order.updateMany({
        where: { id: order.id, status: { in: allowed } },
        data: { status: nextStatus, cancelReason: reason },
      })
      if (written.count === 0) {
        const current = await tx.order.findUnique({
          where: { id: order.id },
          select: { status: true },
        })
        if (!current) throw new OrderError('Order not found', 'NOT_FOUND')
        if (terminal.includes(current.status)) {
          throw new OrderError(`Order is already ${current.status}`, 'ALREADY_TERMINAL')
        }
        throw new OrderError(
          'This order can no longer be cancelled by the customer',
          'CANCEL_NOT_ALLOWED',
        )
      }

      if (order.paidAt) {
        const provider = getProvider(order.paymentMethod)
        await provider.refund({
          profileId: order.profileId,
          currency: order.currency,
          amount: order.total,
          orderId: order.id,
          reason,
          idempotencyKey: `refund:${order.id}:${order.paidAt.toISOString()}`,
          tx,
        })
      }

      await tx.orderEvent.create({
        data: {
          orderId,
          type: nextStatus === OrderStatus.REFUNDED ? 'REFUNDED' : 'CANCELLED',
          message: reason,
          actorId,
        },
      })

      return {
        id: order.id,
        status: nextStatus,
        orderNumber: order.orderNumber,
        profileId: order.profileId,
      }
    })

    // Notify admins (fire-and-forget)
    createAdminNotificationForAllAdmins({
      type: 'ORDER_CANCELLED',
      entityType: 'ORDER',
      entityId: orderId,
      title: `Order #${updated.orderNumber} cancelled`,
      message: reason || 'Order was cancelled',
      href: `/orders/${orderId}`,
    }).catch(() => null)

    void broadcastUserOrderStatus(updated.profileId, {
      orderId: updated.id,
      status: updated.status,
    }).catch(() => null)

    return { id: updated.id, status: updated.status, orderNumber: updated.orderNumber }
  },

  /**
   * Force an order to any valid status, bypassing the normal transition table.
   * REFUNDED is never a valid origin or target. Leaving REFUNDED is reactivate(),
   * which charges again. If the target is CANCELLED and the order was paid,
   * this delegates to cancel() so the refund still happens.
   */
  async adminOverride(
    orderId: string,
    newStatus: OrderStatus,
    actorId: string,
    reason: string,
  ) {
    if (newStatus === OrderStatus.REFUNDED) {
      throw new OrderError('Cannot manually set REFUNDED status', 'INVALID_OVERRIDE')
    }

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        profileId: true,
        total: true,
        currency: true,
        paymentMethod: true,
        paidAt: true,
        orderNumber: true,
      },
    })

    if (order.status === OrderStatus.REFUNDED) {
      throw new OrderError(
        'A refunded order can only leave that status by being reactivated',
        'INVALID_OVERRIDE',
      )
    }

    if (newStatus === OrderStatus.CANCELLED && order.paidAt) {
      return this.cancel(orderId, reason, actorId)
    }

    const updated = await prisma.$transaction(async (tx) => {
      const written = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: newStatus,
          ...(order.status === OrderStatus.CANCELLED ? { cancelReason: null } : {}),
        },
      })
      if (written.count === 0) {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        })
        if (current?.status === OrderStatus.REFUNDED) {
          throw new OrderError(
            'A refunded order can only leave that status by being reactivated',
            'INVALID_OVERRIDE',
          )
        }
        throw new OrderError(
          `Cannot override an order that is now ${current?.status ?? 'missing'}`,
          'INVALID_STATUS',
        )
      }
      await tx.orderEvent.create({
        data: {
          orderId,
          type: 'STATUS_CHANGED',
          message: `[Admin override] ${reason}`,
          actorId,
        },
      })
      return { id: order.id, status: newStatus, orderNumber: order.orderNumber }
    })

    void broadcastUserOrderStatus(order.profileId, {
      orderId: updated.id,
      status: updated.status,
    }).catch(() => null)

    if (newStatus === OrderStatus.COMPLETED) {
      void maybeSendProductReviewInvite(orderId)
    }

    return updated
  },

  /**
   * Reactivate a REFUNDED order by re-charging the customer's wallet.
   * Throws WalletInsufficientFundsError (with .available / .required / .currency)
   * if the customer does not have enough balance — caller should surface
   * the balance details so the OWNER knows to top up.
   */
  async reactivate(orderId: string, actorId: string) {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          profileId: true,
          total: true,
          currency: true,
          paymentMethod: true,
          orderNumber: true,
          paidAt: true,
        },
      })

      if (order.status !== OrderStatus.REFUNDED || !order.paidAt) {
        throw new OrderError('Only REFUNDED orders can be reactivated', 'INVALID_STATUS')
      }

      // Lock the order before the wallet. The second call waits and matches nothing.
      const written = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.REFUNDED },
        data: {
          status: OrderStatus.PENDING,
          cancelReason: null,
          paidAt: new Date(),
        },
      })
      if (written.count === 0) {
        throw new OrderError('Only REFUNDED orders can be reactivated', 'INVALID_STATUS')
      }

      const provider = getProvider(order.paymentMethod)
      await provider.charge({
        profileId: order.profileId,
        currency: order.currency,
        amount: order.total,
        orderId: order.id,
        idempotencyKey: `reactivate:${order.id}:${order.paidAt.toISOString()}`,
        tx,
      })

      await tx.orderEvent.create({
        data: {
          orderId,
          type: 'STATUS_CHANGED',
          message: '[Admin reactivation] Order recharged and reactivated',
          actorId,
        },
      })

      return { id: order.id, status: OrderStatus.PENDING, orderNumber: order.orderNumber, profileId: order.profileId }
    })

    void broadcastUserOrderStatus(updated.profileId, {
      orderId: updated.id,
      status: updated.status,
    }).catch(() => null)

    return { id: updated.id, status: updated.status, orderNumber: updated.orderNumber }
  },

  /**
   * Add a staff note to the order timeline.
   */
  async addNote(orderId: string, message: string, actorId: string) {
    return prisma.orderEvent.create({
      data: { orderId, type: 'NOTE_ADDED', message, actorId },
    })
  },

  /**
   * Get paginated order history for a user.
   */
  async getUserOrders(profileId: string, opts: { page?: number; perPage?: number } = {}) {
    const { page = 1, perPage = 20 } = opts

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { profileId, hiddenByUser: false },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          fulfillment: true,
          currency: true,
          total: true,
          paymentMethod: true,
          scheduledFor: true,
          createdAt: true,
          documentType: true,
          documentSeries: true,
          documentNumber: true,
          items: {
            select: { nameSnapshot: true, quantity: true },
            take: 3,
          },
        },
      }),
      prisma.order.count({ where: { profileId, hiddenByUser: false } }),
    ])

    return { orders, total }
  },

  /**
   * Get full order detail for a user.
   *
   * The timeline carries no staff notes and no event text: a note, or the
   * reason typed for a manual status change, is for the panel only. The
   * customer's cancellation reason travels in `cancelReason`.
   */
  async getOrderDetail(orderId: string, profileId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, profileId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        fulfillment: true,
        currency: true,
        subtotal: true,
        discountTotal: true,
        deliveryFee: true,
        total: true,
        paymentMethod: true,
        paidAt: true,
        scheduledFor: true,
        estimatedReadyAt: true,
        deliveryAddress: true,
        deliveryAddressDetail: true,
        deliveryZoneName: true,
        customerPhone: true,
        customerName: true,
        notes: true,
        cancelReason: true,
        locale: true,
        createdAt: true,
        documentType: true,
        documentSeries: true,
        documentNumber: true,
        items: {
          select: {
            id: true,
            nameSnapshot: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            notes: true,
          },
        },
        appliedDiscounts: {
          select: { amount: true, codeUsed: true, discount: { select: { name: true } } },
        },
        events: {
          where: { type: { not: 'NOTE_ADDED' } },
          select: { id: true, type: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  },
}

export { ZoneNotFoundError, MinOrderNotMetError, BillingDocumentType }
export { WalletInsufficientFundsError } from '../wallet/WalletService'
