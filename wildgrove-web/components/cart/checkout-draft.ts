// ══════════════════════════════════════════════════════════════════
// Checkout draft — the half-filled checkout kept in sessionStorage so a
// refresh or a trip to the address book does not lose it.
//
// A draft belongs to the account that wrote it: it carries the user id,
// the checkout drops one written by someone else, and signing out
// clears it.
// ══════════════════════════════════════════════════════════════════

export const CHECKOUT_DRAFT_STORAGE_KEY = "wg:checkoutDraft:v2"

/** The shape without an owner. Nothing reads it; signing out still clears it. */
const UNOWNED_CHECKOUT_DRAFT_STORAGE_KEY = "wg:checkoutDraft:v1"

/**
 * Fired on `window` when the user signs out. An open checkout listens and
 * stops saving, or its `pagehide` flush would write the draft straight back.
 */
export const CHECKOUT_DRAFT_SIGNED_OUT_EVENT = "wg:checkout-draft-signed-out"

export function clearCheckoutDraftStorage() {
  try {
    sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY)
    sessionStorage.removeItem(UNOWNED_CHECKOUT_DRAFT_STORAGE_KEY)
  } catch {
    /* private mode */
  }
}

/** Called by every sign out button, before the session ends. */
export function clearCheckoutDraftOnSignOut() {
  window.dispatchEvent(new Event(CHECKOUT_DRAFT_SIGNED_OUT_EVENT))
  clearCheckoutDraftStorage()
}

/**
 * Drops a draft that belongs to anyone but `userId` (null for a guest). Runs
 * on every page once the session is known, because a guest never reaches the
 * checkout and so never gets to discard a draft left by an expired session.
 */
export function dropCheckoutDraftNotOwnedBy(userId: string | null) {
  try {
    sessionStorage.removeItem(UNOWNED_CHECKOUT_DRAFT_STORAGE_KEY)
    const raw = sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY)
    if (raw !== null && draftOwner(raw) !== userId) clearCheckoutDraftStorage()
  } catch {
    /* private mode */
  }
}

function draftOwner(raw: string): unknown {
  try {
    return (JSON.parse(raw) as { userId?: unknown } | null)?.userId
  } catch {
    return undefined
  }
}
