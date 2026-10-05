"use client"

import { useSyncExternalStore } from "react"
import { useCart } from "@/components/providers/CartProvider"
import { useTranslations } from "next-intl"
import { ShoppingCartIcon } from "@wildgrove/ui/icons"

const subscribeNothing = () => () => {}

export function CartButton() {
  const { itemCount: liveItemCount, openDrawer } = useCart()
  const t = useTranslations("cart")
  // The count comes from the browser (a guest cart in storage), so the server
  // and the hydrating render show 0 and the real count follows after mount.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false)
  const itemCount = mounted ? liveItemCount : 0

  return (
    <button
      onClick={openDrawer}
      aria-label={t("openCart", { count: itemCount })}
      className="relative p-2 rounded-brand text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border transition-colors"
    >
      <ShoppingCartIcon className="w-5 h-5" />

      {itemCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-wg-accent text-white text-[10px] font-bold leading-none shadow-card"
          aria-hidden
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </button>
  )
}
