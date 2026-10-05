"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useCart } from "@/components/providers/CartProvider"
import type { MenuItemSnapshot } from "@/components/providers/CartProvider"
import { CheckIcon, PlusIcon, Spinner } from "@wildgrove/ui/icons"

interface AddToCartButtonProps {
  item: MenuItemSnapshot
  /** Use larger padding/text for product detail pages */
  large?: boolean
}

type ButtonState = "idle" | "adding" | "added"

export function AddToCartButton({ item, large = false }: AddToCartButtonProps) {
  const [state, setState] = useState<ButtonState>("idle")
  const { addItem, openDrawer, isLoading } = useCart()
  const t = useTranslations("cart")

  const handleAdd = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!item.available || state !== "idle" || isLoading) return

      setState("adding")
      try {
        await addItem(item, 1)
        setState("added")
        openDrawer()
        setTimeout(() => setState("idle"), 2000)
      } catch {
        setState("idle")
      }
    },
    [item, state, addItem, openDrawer, isLoading],
  )

  const sizeClasses = large
    ? "px-6 py-3.5 text-sm font-semibold"
    : "px-3 py-2 text-xs font-medium"

  if (!item.available) {
    return (
      <button
        disabled
        className={`w-full flex items-center justify-center gap-1.5 ${sizeClasses} rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted/50 dark:text-wg-dark-muted/50 cursor-not-allowed bg-wg-border/10 dark:bg-wg-dark-border/10`}
        aria-label={t("unavailable")}
      >
        {t("unavailable")}
      </button>
    )
  }

  return (
    <button
      onClick={handleAdd}
      disabled={state !== "idle" || isLoading}
      aria-label={state === "added" ? t("addedToCart") : t("addToCart")}
      className={`w-full flex items-center justify-center gap-1.5 ${sizeClasses} rounded-brand transition-all duration-200 ${
        state === "added"
          ? "bg-wg-primary dark:bg-wg-dark-primary text-white scale-[0.98]"
          : state === "adding"
            ? "bg-wg-accent/80 dark:bg-wg-dark-accent/80 text-white cursor-wait"
            : isLoading
              ? "bg-wg-accent/50 dark:bg-wg-dark-accent/50 text-white cursor-wait"
              : "bg-wg-accent hover:bg-wg-accent-hover text-white hover:scale-[1.02] active:scale-[0.98]"
      }`}
    >
      {state === "added" ? (
        <>
          <CheckIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
          {t("addedToCart")}
        </>
      ) : state === "adding" ? (
        <>
          <Spinner className="w-3.5 h-3.5 shrink-0 animate-spin" />
          {t("addToCart")}
        </>
      ) : (
        <>
          <PlusIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          {t("addToCart")}
        </>
      )}
    </button>
  )
}
