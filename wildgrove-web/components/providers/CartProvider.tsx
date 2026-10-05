"use client"

// ══════════════════════════════════════════════════════════════════
// CartProvider — unified cart context
//
// Guest users: cart stored in localStorage (key: wg:cart)
// Auth users:  cart stored in DB, synced via /api/cart
//
// On login: guest cart is merged into the server cart via
// POST /api/cart/merge, then localStorage is cleared.
//
// Currency:
// - Defaults to the user's preferred display currency (wg:preferred-currency)
// - Locked to the first item's currency in DB (for auth users)
// - Can be changed at any time via changeCurrency()
// - While the store has a single currency (dual currency off), the cart is in
//   that one: a guest cart kept in the other moves to it, and changeCurrency()
//   does nothing. The server moves a signed-in customer's cart the same way.
// ══════════════════════════════════════════════════════════════════

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { createClient } from "@wildgrove/core/clients/client"
import { useCurrency } from "@/components/providers/CurrencyProvider"
import type { AuthUser as User } from '@wildgrove/core/auth/types'
import { dropCheckoutDraftNotOwnedBy } from "@/components/cart/checkout-draft"

const GUEST_CART_KEY = "wg:cart"
const PREFERRED_CURRENCY_KEY = "wg:preferred-currency"

// ── Public types ──────────────────────────────────────────────────

export interface MenuItemSnapshot {
  id: string
  name: string
  nameEs?: string | null
  imageUrl?: string | null
  prices: Record<string, number> // { PEN: 25, USD: 7 } — list/catalog
  available: boolean
  /** When set (e.g. automatic discount), cart uses these instead of `prices` for line totals */
  displayUnitPricePEN?: number
  displayUnitPriceUSD?: number
}

export interface DisplayCartItem {
  /** DB cartItem.id for auth users, menuItemId for guests */
  id: string
  menuItemId: string
  name: string
  nameEs: string | null
  imageUrl: string | null
  quantity: number
  /** Catalog / list price per unit (before automatic discounts) */
  listUnitPricePEN?: number
  listUnitPriceUSD?: number
  /** Unit price after automatic discounts */
  unitPricePEN: number
  unitPriceUSD: number
  notes: string | null
}

interface CartContextValue {
  items: DisplayCartItem[]
  /** The cart's active currency (PEN or USD) */
  currency: string
  itemCount: number
  subtotalPEN: number
  subtotalUSD: number
  /** Sum of list prices × qty (before automatic discounts) */
  listSubtotalPEN: number
  listSubtotalUSD: number
  /** listSubtotal − subtotal (automatic promos only) */
  automaticDiscountPEN: number
  automaticDiscountUSD: number
  isLoading: boolean
  isGuest: boolean
  /** The signed-in user's id, or null for a guest. */
  userId: string | null
  isDrawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  addItem: (item: MenuItemSnapshot, qty?: number, notes?: string | null) => Promise<void>
  updateQuantity: (itemId: string, qty: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  changeCurrency: (currency: "PEN" | "USD") => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null)

// ── Guest localStorage helpers ────────────────────────────────────

interface GuestCartData {
  currency: string
  items: DisplayCartItem[]
}

function readGuestCart(): GuestCartData {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY)
    if (!raw) return { currency: getPreferredCurrency(), items: [] }
    return JSON.parse(raw) as GuestCartData
  } catch {
    return { currency: getPreferredCurrency(), items: [] }
  }
}

function writeGuestCart(data: GuestCartData) {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(data))
  } catch {
    // ignore — storage quota or private mode
  }
}

function getPreferredCurrency(): string {
  try {
    return localStorage.getItem(PREFERRED_CURRENCY_KEY) ?? "PEN"
  } catch {
    return "PEN"
  }
}

// ── Provider ──────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { storeCurrency } = useCurrency()
  const [user, setUser] = useState<User | null>(null)
  const [items, setItems] = useState<DisplayCartItem[]>([])
  const [currency, setCurrency] = useState<string>(storeCurrency ?? "PEN")
  const [isLoading, setIsLoading] = useState(true)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Ref keeps the latest user value synchronously accessible inside callbacks,
  // avoiding the "isGuest is stale during the auth-resolution window" race.
  const userRef = useRef<User | null>(null)
  const isMergingRef = useRef(false)

  const isGuest = !user

  // ── Load server cart ────────────────────────────────────────────

  const loadServerCart = useCallback(async () => {
    try {
      const res = await fetch("/api/cart")
      if (!res.ok) return
      const json = await res.json() as {
        success: boolean
        data: { currency: string; items: DisplayCartItem[] } | null
      }
      if (json.success && json.data) {
        setItems(json.data.items)
        setCurrency(json.data.currency)
      } else {
        // No cart yet — use the visitor's preferred currency so the
        // first "add" creates the cart in the right currency
        setItems([])
        setCurrency(storeCurrency ?? getPreferredCurrency())
      }
    } catch {
      // network error — keep state as-is
    }
  }, [storeCurrency])

  // ── Load guest cart from localStorage ──────────────────────────

  const loadGuestCart = useCallback(() => {
    const data = readGuestCart()
    if (storeCurrency && data.currency !== storeCurrency) {
      data.currency = storeCurrency
      if (data.items.length > 0) writeGuestCart(data)
    }
    setItems(data.items)
    setCurrency(data.currency || getPreferredCurrency())
  }, [storeCurrency])

  // ── Merge guest cart into server cart ──────────────────────────

  const mergeGuestCartIfNeeded = useCallback(async () => {
    const guestData = readGuestCart()
    if (guestData.items.length === 0) return
    try {
      await fetch("/api/cart/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: guestData.items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            notes: i.notes,
          })),
          currency: storeCurrency ?? guestData.currency,
        }),
      })
      writeGuestCart({ currency: getPreferredCurrency(), items: [] })
    } catch {
      // merge failed silently — not critical
    }
  }, [storeCurrency])

  // ── Auth state + initial load ───────────────────────────────────
  //
  // We handle both INITIAL_SESSION (existing session on page load) and
  // SIGNED_IN (new login) to ensure the merge always runs regardless of
  // which Supabase event fires for the current session state.

  useEffect(() => {
    const insforge = createClient()

    const {
      data: { subscription },
    } = insforge.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (session?.user) {
          // Prevent double-execution when both events or strict-mode fire
          if (isMergingRef.current) return
          isMergingRef.current = true

          userRef.current = session.user
          setUser(session.user)
          dropCheckoutDraftNotOwnedBy(session.user.id)

          await mergeGuestCartIfNeeded()
          await loadServerCart()

          isMergingRef.current = false
          setIsLoading(false)
        } else if (event === "INITIAL_SESSION") {
          // No session on first load → treat as guest
          userRef.current = null
          setUser(null)
          dropCheckoutDraftNotOwnedBy(null)
          loadGuestCart()
          setIsLoading(false)
        }
      } else if (event === "SIGNED_OUT") {
        userRef.current = null
        setUser(null)
        dropCheckoutDraftNotOwnedBy(null)
        isMergingRef.current = false
        loadGuestCart()
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadServerCart, loadGuestCart, mergeGuestCartIfNeeded])

  // ── Mutations ─────────────────────────────────────────────────

  const addItem = useCallback(
    async (snapshot: MenuItemSnapshot, qty = 1, notes: string | null = null) => {
      if (!snapshot.available) return

      const listUnitPricePEN = snapshot.prices.PEN ?? 0
      const listUnitPriceUSD = snapshot.prices.USD ?? 0
      const unitPricePEN = snapshot.displayUnitPricePEN ?? listUnitPricePEN
      const unitPriceUSD = snapshot.displayUnitPriceUSD ?? listUnitPriceUSD

      // Use the ref for an always-current check — prevents the stale-closure
      // race where isGuest is still `true` while getUser() is in-flight.
      const currentUser = userRef.current

      if (!currentUser) {
        // Guest path — localStorage
        const guestData = readGuestCart()
        if (storeCurrency) guestData.currency = storeCurrency
        const existing = guestData.items.find((i) => i.menuItemId === snapshot.id)

        if (existing) {
          existing.quantity += qty
          if (notes !== null) existing.notes = notes
          existing.unitPricePEN = unitPricePEN
          existing.unitPriceUSD = unitPriceUSD
          existing.listUnitPricePEN = listUnitPricePEN
          existing.listUnitPriceUSD = listUnitPriceUSD
        } else {
          guestData.items.push({
            id: snapshot.id,
            menuItemId: snapshot.id,
            name: snapshot.name,
            nameEs: snapshot.nameEs ?? null,
            imageUrl: snapshot.imageUrl ?? null,
            quantity: qty,
            listUnitPricePEN,
            listUnitPriceUSD,
            unitPricePEN,
            unitPriceUSD,
            notes,
          })
        }

        writeGuestCart(guestData)
        setItems([...guestData.items])
        setCurrency(guestData.currency)
      } else {
        // Auth path — optimistic: add to UI immediately, sync in background.
        // We use a temp ID so the item appears instantly; loadServerCart()
        // replaces temp IDs with the real DB IDs after the server responds.
        const tempId = `temp_${snapshot.id}_${Date.now()}`
        setItems((prev) => {
          const existing = prev.find((i) => i.menuItemId === snapshot.id)
          if (existing) {
            return prev.map((i) =>
              i.menuItemId === snapshot.id
                ? {
                    ...i,
                    quantity: i.quantity + qty,
                    unitPricePEN,
                    unitPriceUSD,
                    listUnitPricePEN,
                    listUnitPriceUSD,
                  }
                : i,
            )
          }
          return [
            ...prev,
            {
              id: tempId,
              menuItemId: snapshot.id,
              name: snapshot.name,
              nameEs: snapshot.nameEs ?? null,
              imageUrl: snapshot.imageUrl ?? null,
              quantity: qty,
              listUnitPricePEN,
              listUnitPriceUSD,
              unitPricePEN,
              unitPriceUSD,
              notes: notes ?? null,
            },
          ]
        })

        try {
          const res = await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              menuItemId: snapshot.id,
              quantity: qty,
              notes: notes ?? undefined,
              currency: storeCurrency ?? currency,
            }),
          })
          if (!res.ok) throw new Error("Failed to add item to cart")
          // Sync to replace temp ID with real DB ID
          await loadServerCart()
        } catch (err) {
          // Revert the optimistic add
          await loadServerCart()
          throw err
        }
      }
    },
    [currency, loadServerCart, storeCurrency],
  )

  const updateQuantity = useCallback(
    async (itemId: string, qty: number) => {
      const currentUser = userRef.current

      if (!currentUser) {
        const guestData = readGuestCart()
        if (qty <= 0) {
          guestData.items = guestData.items.filter((i) => i.id !== itemId)
        } else {
          const item = guestData.items.find((i) => i.id === itemId)
          if (item) item.quantity = qty
        }
        writeGuestCart(guestData)
        setItems([...guestData.items])
      } else {
        // Optimistic update — capture previous state for revert
        let previousItems: DisplayCartItem[] = []
        setItems((prev) => {
          previousItems = prev
          if (qty <= 0) return prev.filter((i) => i.id !== itemId)
          return prev.map((i) => (i.id === itemId ? { ...i, quantity: qty } : i))
        })

        try {
          const res =
            qty <= 0
              ? await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" })
              : await fetch(`/api/cart/items/${itemId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ quantity: qty }),
                })
          if (!res.ok) throw new Error("Failed")
        } catch {
          // Revert to previous state on error
          setItems(previousItems)
        }
      }
    },
    [],
  )

  const removeItem = useCallback(
    async (itemId: string) => {
      const currentUser = userRef.current

      if (!currentUser) {
        const guestData = readGuestCart()
        guestData.items = guestData.items.filter((i) => i.id !== itemId)
        writeGuestCart(guestData)
        setItems([...guestData.items])
      } else {
        // Optimistic update — capture previous state for revert
        let previousItems: DisplayCartItem[] = []
        setItems((prev) => {
          previousItems = prev
          return prev.filter((i) => i.id !== itemId)
        })

        try {
          const res = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" })
          if (!res.ok) throw new Error("Failed")
        } catch {
          setItems(previousItems)
        }
      }
    },
    [],
  )

  const changeCurrency = useCallback(
    async (newCurrency: "PEN" | "USD") => {
      if (newCurrency === currency || storeCurrency) return
      const currentUser = userRef.current

      if (!currentUser) {
        // Guest: update localStorage only
        const guestData = readGuestCart()
        guestData.currency = newCurrency
        writeGuestCart(guestData)
        setCurrency(newCurrency)
      } else {
        // Auth: update in DB + update state
        const res = await fetch("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currency: newCurrency }),
        })
        if (res.ok) {
          setCurrency(newCurrency)
        }
      }
    },
    [currency, storeCurrency],
  )

  // ── Computed ─────────────────────────────────────────────────

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotalPEN = items.reduce((sum, i) => sum + i.unitPricePEN * i.quantity, 0)
  const subtotalUSD = items.reduce((sum, i) => sum + i.unitPriceUSD * i.quantity, 0)
  const listSubtotalPEN = items.reduce(
    (sum, i) => sum + (i.listUnitPricePEN ?? i.unitPricePEN) * i.quantity,
    0,
  )
  const listSubtotalUSD = items.reduce(
    (sum, i) => sum + (i.listUnitPriceUSD ?? i.unitPriceUSD) * i.quantity,
    0,
  )
  const automaticDiscountPEN = Math.max(0, Math.round((listSubtotalPEN - subtotalPEN) * 100) / 100)
  const automaticDiscountUSD = Math.max(0, Math.round((listSubtotalUSD - subtotalUSD) * 100) / 100)

  const openDrawer = useCallback(() => setIsDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), [])

  const value: CartContextValue = {
    items,
    currency,
    itemCount,
    subtotalPEN,
    subtotalUSD,
    listSubtotalPEN,
    listSubtotalUSD,
    automaticDiscountPEN,
    automaticDiscountUSD,
    isLoading,
    isGuest,
    userId: user?.id ?? null,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    addItem,
    updateQuantity,
    removeItem,
    changeCurrency,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
