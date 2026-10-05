"use client"

// ══════════════════════════════════════════════════════════════════
// ChatMessage — Single message bubble with role-based styling
// StreamingMessage — AI response being typed in real-time
// ReservationCard — Rich card shown after Sage creates a booking
// MenuItemCard — Rich product card shown when Sage lists menu items
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { useLocale } from "next-intl"
import { useRouter, usePathname } from "next/navigation"
import { getPathname, type Locale } from "@wildgrove/core/i18n/routing"
import { classifyChatHref, isSitePageHref, promoteChatLinks, toCanonicalPath } from "@wildgrove/core/chat/message-links"
import { Link } from "@/i18n/routing"
import type { ChatMessageData } from "./ChatProvider"
import { useChatContext } from "./ChatProvider"
import { createClient } from "@wildgrove/core/clients/client"
import { useCurrency, useCurrencyFormatter } from "@/components/providers/CurrencyProvider"
import { resolveMenuItemPriceForPreference } from "@wildgrove/core/menu-display-price"
import { Badge } from "@wildgrove/ui/Badge"
import {
    ArrowRightIcon,
    CalendarBandIcon,
    CalendarCheckIcon,
    CheckIcon,
    ClocheIcon,
    ClockRightAngleIcon,
    CloseIcon,
    PencilIcon,
    PencilShortIcon,
    SpinnerArrowsIcon,
    UsersIcon,
    UserSolidEvenOddIcon,
} from "@wildgrove/ui/icons"
import { resolveMenuCategoryDisplay } from "@wildgrove/core/menu-category-display"
import { DiscountBadge } from "@/components/currency/DiscountBadge"
import { stripShownDishAside } from "@wildgrove/core/chat/message-blocks"

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const locale = useLocale()
  const currentPage = useCurrentPage()
  const { dispatchAction } = useChatContext()
  const isUser = message.role === "USER"
  const isSystem = message.role === "SYSTEM"
  const isAgent = message.role === "AGENT"

  // System messages: centered, muted
  if (isSystem) {
    return (
      <div className="flex justify-center px-4 py-2">
        <p className="text-xs text-wg-muted dark:text-wg-dark-muted text-center italic max-w-[85%]">
          {message.content}
        </p>
      </div>
    )
  }

  // Extract embedded reservation card if present
  const { text: cleanContent, reservation } = parseReservationCard(message.content)

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} px-3 py-1`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-wg-primary text-white rounded-br-md"
            : isAgent
              ? "bg-amber-50 dark:bg-amber-950/30 text-wg-text dark:text-wg-dark-text border border-amber-200 dark:border-amber-800/50 rounded-bl-md"
              : "bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text rounded-bl-md"
        }`}
      >
        {/* Agent label */}
        {isAgent && (
          <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-0.5">
            Agent
          </p>
        )}

        {/* Render markdown-like formatting (bold only) */}
        {cleanContent && (
          <div className="whitespace-pre-wrap break-words">
            {renderContent(cleanContent, locale, currentPage, !isUser)}
          </div>
        )}

        {/* Reservation confirmation card */}
        {reservation && <ReservationCard reservation={reservation} />}

        {/* Inline action buttons (e.g. rate-limit prompt) */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <button
                key={action.id}
                onClick={() => dispatchAction(message.id, action.id)}
                className={
                  action.variant === "primary"
                    ? "px-3.5 py-1.5 text-xs font-semibold rounded-full bg-wg-primary text-white hover:bg-wg-primary/90 dark:bg-wg-dark-primary dark:hover:bg-wg-dark-primary/90 transition-colors"
                    : "px-3.5 py-1.5 text-xs font-semibold rounded-full border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors"
                }
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Tier indicator for bot messages */}
        {message.role === "ASSISTANT" && (
          <p className="text-[10px] mt-1 opacity-40">
            Sage AI
          </p>
        )}
      </div>
    </div>
  )
}

// ── Streaming message (AI typing in real-time) ────────────────────
export function StreamingMessage({ content }: { content: string }) {
  const locale = useLocale()
  const currentPage = useCurrentPage()
  const spoken = stripShownDishAside(content)

  // Once a fenced block starts being written, hide it and show a pill indicator
  const reservationBlockIdx = spoken.indexOf("```reservation")
  const menuBlockIdx = spoken.indexOf("```menu-items")
  const fencedBlockIdx = [reservationBlockIdx, menuBlockIdx]
    .filter((i) => i !== -1)
    .sort((a, b) => a - b)[0] ?? -1

  if (fencedBlockIdx !== -1) {
    const visibleText = spoken.slice(0, fencedBlockIdx).trim()
    const isMenuBlock = menuBlockIdx !== -1 && (reservationBlockIdx === -1 || menuBlockIdx < reservationBlockIdx)
    return (
      <>
        {visibleText ? (
          <div className="flex justify-start px-3 py-1">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2 text-sm leading-relaxed bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text">
              <div className="whitespace-pre-wrap break-words">
                {renderContent(visibleText, locale, currentPage)}
              </div>
              <p className="text-[10px] mt-1 opacity-40">Sage AI</p>
            </div>
          </div>
        ) : null}
        <div className="flex justify-start px-3 py-1">
          <div className="flex items-center gap-2 bg-wg-surface dark:bg-wg-dark-surface rounded-full px-3 py-1.5 text-xs text-wg-muted dark:text-wg-dark-muted border border-wg-border dark:border-wg-dark-border">
            <SpinnerArrowsIcon className="w-3 h-3 animate-spin text-wg-primary dark:text-wg-secondary" />
            <span>
              {isMenuBlock
                ? (locale === "es" ? "Preparando la carta…" : "Loading menu items…")
                : (locale === "es" ? "Preparando tu reserva…" : "Building your reservation…")}
            </span>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="flex justify-start px-3 py-1">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2 text-sm leading-relaxed bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text">
        <div className="whitespace-pre-wrap break-words">
          {renderContent(spoken, locale, currentPage)}
          {/* Blinking cursor */}
          <span className="inline-block w-[2px] h-[14px] bg-wg-primary dark:bg-wg-dark-primary ml-0.5 align-text-bottom animate-pulse" />
        </div>

        <p className="text-[10px] mt-1 opacity-40">Sage AI</p>
      </div>
    </div>
  )
}

const CHAT_LINK_CLASS =
  "underline underline-offset-2 text-wg-primary dark:text-wg-secondary hover:opacity-90 transition-opacity"

const CHAT_PAGE_BUTTON_CLASS =
  "mx-1 my-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-primary dark:text-wg-secondary font-semibold text-xs hover:opacity-90 transition-opacity"

function PageLinkArrow() {
  return (
    <ArrowRightIcon className="w-3 h-3" strokeWidth={2.5} />
  )
}

function ChatTextLink({
  href,
  className,
  children,
}: {
  href: string
  className: string
  children: React.ReactNode
}) {
  const { setIsOpen } = useChatContext()
  const classified = classifyChatHref(href)

  if (classified.kind === "external") {
    return (
      <a href={classified.href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }

  return (
    <Link href={classified.href} className={className} onClick={() => setIsOpen(false)}>
      {children}
    </Link>
  )
}

/** Canonical path of the page behind the chat, such as `/menu`. */
function useCurrentPage(): string {
  const pathname = usePathname()
  return toCanonicalPath(pathname ?? "/")
}

// ── Inline formatting: markdown links + **bold** + *italic* ──────
// A link to the page the visitor is already on cites it rather than inviting them
// there, so it stays an underlined link instead of a page button.
function renderInline(text: string, currentPage: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[2] && match[3]) {
      const rawHref = match[3].trim()
      const classified = classifyChatHref(rawHref)
      const isPageLink =
        classified.kind === "internal" &&
        isSitePageHref(classified.href) &&
        classified.href.split(/[?#]/)[0] !== currentPage
      parts.push(
        <ChatTextLink
          key={match.index}
          href={rawHref}
          className={isPageLink ? CHAT_PAGE_BUTTON_CLASS : CHAT_LINK_CLASS}
        >
          {match[2]}
          {isPageLink && <PageLinkArrow />}
        </ChatTextLink>
      )
    } else if (match[4]) {
      parts.push(<strong key={match.index} className="font-semibold">{match[4]}</strong>)
    } else if (match[5]) {
      parts.push(<em key={match.index}>{match[5]}</em>)
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : [text]
}

// ── Full content renderer: headings (###) + inline bold/italic ────
function renderContent(text: string, locale: string, currentPage: string, linkify = true) {
  const source = linkify
    ? promoteChatLinks(text, locale === "es" ? "es" : "en")
    : text
  return source.split("\n").map((line, lineIdx, arr) => {
    const isLast = lineIdx === arr.length - 1
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)

    if (headingMatch) {
      const level = headingMatch[1].length
      const cls =
        level === 1 ? "block font-bold mt-2 first:mt-0" :
        level === 2 ? "block font-semibold mt-1.5 first:mt-0" :
                      "block font-semibold mt-1 first:mt-0"
      return (
        <span key={lineIdx} className={cls}>
          {renderInline(headingMatch[2], currentPage)}
          {!isLast && <br />}
        </span>
      )
    }

    return (
      <span key={lineIdx}>
        {renderInline(line, currentPage)}
        {!isLast && <br />}
      </span>
    )
  })
}

// ── Reservation card data ─────────────────────────────────────────
export interface ReservationData {
  id: string
  date: string        // ISO string
  partySize: number
  notes: string | null
  nickname: string | null
  status: string
}

/**
 * Parses a special ```reservation JSON ``` block that Sage embeds in messages.
 * Returns the plain text and the parsed reservation (if any).
 */
export function parseReservationCard(content: string): {
  text: string
  reservation: ReservationData | null
} {
  const match = content.match(/```reservation\n([\s\S]*?)\n```/)
  if (!match) return { text: content, reservation: null }

  try {
    const reservation = JSON.parse(match[1]) as ReservationData
    // Remove block and collapse any resulting extra blank lines
    const text = content.replace(match[0], "").replace(/\n{3,}/g, "\n\n").trim()
    return { text, reservation }
  } catch {
    return { text: content, reservation: null }
  }
}

// ── Standalone reservation card bubble (rendered as separate message) ──
export function ReservationCardMessage({ reservation }: { reservation: ReservationData }) {
  return (
    <div className="px-3 py-1 w-full">
      <ReservationCard reservation={reservation} context="created" />
    </div>
  )
}

// ── Multiple reservation cards (list view from get_user_reservations) ──
export function ReservationListMessage({ reservations }: { reservations: ReservationData[] }) {
  return (
    <div className="px-3 py-1 w-full space-y-3">
      {reservations.map((r) => (
        <ReservationCard key={r.id} reservation={r} />
      ))}
    </div>
  )
}

// ── Menu item card data ───────────────────────────────────────────
export interface MenuItemCardData {
  id: string
  slug?: string
  name: string
  nameEs?: string | null
  description: string
  descriptionEs?: string | null
  price: string
  prices?: { PEN?: number; USD?: number }
  /** Prices before the automatic discount; present only when one applies. */
  listPrices?: { PEN?: number; USD?: number }
  discount?: { valueType: "PERCENTAGE" | "FIXED_AMOUNT"; value: number; valueUsd: number | null }
  category: string
  categorySlug?: string
  tags: string[]
  tagsEs?: string[]
  /** Spanish category name from CMS (MenuCategory.nameEs). */
  categoryEs?: string | null
  /** Hex colors keyed by tag label (matches admin MenuItem tagColors). */
  tagColors?: Record<string, string> | null
  imageUrl: string | null
}

/** Match CMS tagColors when keys differ slightly in casing or hyphenation from displayTags. */
function resolveMenuTagCustomColor(
  tagColors: Record<string, string> | null | undefined,
  displayTag: string,
): string | undefined {
  if (!tagColors || typeof tagColors !== "object") return undefined
  const direct = tagColors[displayTag]
  if (typeof direct === "string" && direct.trim()) return direct
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-")
  const target = norm(displayTag)
  for (const [key, value] of Object.entries(tagColors)) {
    if (typeof value !== "string" || !value.trim()) continue
    if (norm(key) === target) return value
  }
  return undefined
}

/** One structured block of a Sage message, parsed. */
export type StructuredBlock =
  | { type: "reservation"; reservation: ReservationData }
  | { type: "reservation-list"; reservations: ReservationData[] }
  | { type: "menu-items"; items: MenuItemCardData[] }

const STRUCTURED_BLOCK = /```(menu-items|reservation-list|reservation)\r?\n([\s\S]*?)\r?\n```/g

/**
 * Every structured block of a message, in the order they appear, and the text
 * left once they are taken out. A block whose JSON does not parse stays in the
 * text, as the single-block parsers above do.
 */
export function parseStructuredBlocks(content: string): { text: string; blocks: StructuredBlock[] } {
  const blocks: StructuredBlock[] = []
  content = stripShownDishAside(content)
  let text = content
  for (const match of content.matchAll(STRUCTURED_BLOCK)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(match[2])
    } catch {
      continue
    }
    if (match[1] === "reservation") {
      blocks.push({ type: "reservation", reservation: parsed as ReservationData })
    } else if (match[1] === "reservation-list") {
      blocks.push({ type: "reservation-list", reservations: parsed as ReservationData[] })
    } else if (Array.isArray(parsed) && parsed.length > 0) {
      blocks.push({ type: "menu-items", items: parsed as MenuItemCardData[] })
    } else {
      continue
    }
    text = text.replace(match[0], "")
  }
  return { text: blocks.length > 0 ? text.replace(/\n{3,}/g, "\n\n").trim() : content, blocks }
}

// ── Standalone menu items message (rendered as separate element) ──
export function MenuItemsMessage({
  items,
  more,
}: {
  items: MenuItemCardData[]
  /** Dishes of the list not shown yet; the cards end in a button that brings them. */
  more?: { remaining: number; pending: boolean; disabled: boolean; onMore: () => void }
}) {
  const locale = useLocale()
  return (
    <div className="px-3 py-1 w-full space-y-2.5">
      {items.map((item) => (
        <MenuItemCard key={item.id} item={item} />
      ))}
      {more && more.remaining > 0 && (
        <button
          type="button"
          onClick={more.onMore}
          disabled={more.disabled}
          className="w-full py-2 rounded-xl border border-wg-border dark:border-wg-dark-border text-xs font-semibold text-wg-primary dark:text-wg-secondary hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors disabled:opacity-55 disabled:cursor-not-allowed"
        >
          {more.pending
            ? (locale === "es" ? "Cargando…" : "Loading…")
            : (locale === "es" ? `Ver ${more.remaining} más` : `See ${more.remaining} more`)}
        </button>
      )}
    </div>
  )
}

// ── MenuItemCard component ────────────────────────────────────────
function MenuItemCard({ item }: { item: MenuItemCardData }) {
  const locale = useLocale()
  const { setIsOpen } = useChatContext()
  const router = useRouter()
  const [imgError, setImgError] = useState(false)
  const { formatAmount } = useCurrencyFormatter()
  const { currency: preferredCurrency } = useCurrency()

  const priceCurrency = useMemo(
    () => (item.prices ? resolveMenuItemPriceForPreference({ prices: item.prices }, preferredCurrency).currency : null),
    [item.prices, preferredCurrency],
  )

  const listPrice = useMemo(() => {
    if (!item.discount || !item.listPrices || !priceCurrency) return null
    const amount = item.listPrices[priceCurrency as "PEN" | "USD"]
    return typeof amount === "number" ? formatAmount(amount, priceCurrency) : null
  }, [item.discount, item.listPrices, priceCurrency, formatAmount])

  const displayPrice = useMemo(() => {
    if (item.prices) {
      const { amount, currency } = resolveMenuItemPriceForPreference(
        { prices: item.prices },
        preferredCurrency,
      )
      return formatAmount(amount, currency)
    }

    const parsed = item.price.match(/^\s*(S\/|\$)\s*([0-9]+(?:[.,][0-9]+)?)\s*$/)
    if (parsed) {
      const fromCurrency = parsed[1] === "S/" ? "PEN" : "USD"
      const amount = Number(parsed[2].replace(",", "."))
      if (!Number.isNaN(amount)) {
        return formatAmount(amount, fromCurrency)
      }
    }

    return item.price
  }, [
    item.price,
    item.prices,
    preferredCurrency,
    formatAmount,
  ])

  const displayName =
    locale === "es" && item.nameEs
      ? item.nameEs
      : item.name

  const displayDescription =
    locale === "es" && item.descriptionEs
      ? item.descriptionEs
      : item.description

  const displayTags =
    locale === "es" && item.tagsEs && item.tagsEs.length > 0
      ? item.tagsEs
      : item.tags

  const displayCategory = useMemo(
    () =>
      resolveMenuCategoryDisplay({
        locale,
        category: item.category,
        categoryEs: item.categoryEs,
        categorySlug: item.categorySlug,
      }),
    [locale, item.category, item.categoryEs, item.categorySlug],
  )

  function handleViewProduct() {
    if (!item.slug) return
    setIsOpen(false)
    router.push(`/${locale}/menu/${item.slug}`)
  }

  function handleViewAllMenus() {
    setIsOpen(false)
    router.push(`/${locale}/menu`)
  }

  return (
    <div className="rounded-2xl border border-wg-border dark:border-wg-dark-border bg-white dark:bg-wg-dark-bg overflow-hidden shadow-card w-full">
      {/* ── Product image ──────────────────────────────────────── */}
      <div className="relative h-36 bg-wg-bg dark:bg-wg-dark-raised overflow-hidden">
        {item.imageUrl && !imgError ? (
          <FadeInImage
            src={item.imageUrl}
            alt={displayName}
            fill
            className="object-cover"
            sizes="320px"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <ClocheIcon className="w-10 h-10 text-wg-primary dark:text-wg-secondary opacity-40" />
          </div>
        )}
        {/* Category badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="inline-block bg-wg-primary/90 text-white text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full backdrop-blur-sm">
            {displayCategory}
          </span>
        </div>
        {/* Discount badge */}
        {item.discount && priceCurrency && (
          <DiscountBadge
            className="absolute top-2.5 right-2.5"
            valueType={item.discount.valueType}
            value={item.discount.value}
            valueUsd={item.discount.valueUsd}
            currency={priceCurrency}
          />
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="px-3.5 pt-3 pb-3.5 space-y-2">
        {/* Name + price row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-wg-text dark:text-wg-dark-text leading-snug flex-1 min-w-0">
            {displayName}
          </h3>
          {listPrice ? (
            <div className="flex flex-col items-end shrink-0">
              <span className="text-sm font-bold text-wg-accent dark:text-wg-dark-accent tabular-nums">
                {displayPrice}
              </span>
              <span className="text-xs line-through text-wg-muted dark:text-wg-dark-muted tabular-nums">
                {listPrice}
              </span>
            </div>
          ) : (
            <span className="shrink-0 text-sm font-bold text-wg-accent dark:text-wg-dark-accent tabular-nums">
              {displayPrice}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-wg-muted dark:text-wg-dark-muted leading-relaxed line-clamp-2">
          {displayDescription}
        </p>

        {/* Tags */}
        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {displayTags.map((tag) => (
              <Badge
                key={tag}
                tag={tag}
                readable
                customColor={resolveMenuTagCustomColor(item.tagColors ?? undefined, tag)}
              />
            ))}
          </div>
        )}

        {/* Menu actions */}
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button
            onClick={handleViewProduct}
            disabled={!item.slug}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-wg-border dark:border-wg-dark-border text-xs font-semibold text-wg-primary dark:text-wg-secondary hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {locale === "es" ? "Ver producto" : "View product"}
            <ArrowRightIcon className="w-3 h-3" strokeWidth={2.5} />
          </button>
          <button
            onClick={handleViewAllMenus}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-wg-border dark:border-wg-dark-border text-xs font-semibold text-wg-primary dark:text-wg-secondary hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors"
          >
            {locale === "es" ? "Ver la carta completa" : "View the full menu"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ReservationCard component ─────────────────────────────────────
// Fetches fresh data on mount + subscribes to InsForge real-time
// so status updates from staff are reflected immediately.
function ReservationCard({ reservation: initial, context = "list" }: { reservation: ReservationData; context?: "created" | "list" }) {
  const locale = useLocale()
  const { setIsOpen } = useChatContext()
  const router = useRouter()
  const pathname = usePathname()

  // Live data — starts from the embedded snapshot, updates via fetch + realtime
  const [data, setData] = useState<ReservationData>(initial)

  // ── Rename state ──────────────────────────────────────────────
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState("")
  const [renameLoading, setRenameLoading] = useState(false)

  // ── Fetch current state on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetch(`/api/reservations/${initial.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!cancelled && json?.success && json.data) {
          setData((prev) => ({ ...prev, ...json.data }))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [initial.id])

  // ── InsForge real-time: listen for status/date changes ────────
  useEffect(() => {
    const insforge = createClient()
    const channel = insforge
      .channel(`reservation:${initial.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Reservation",
          filter: `id=eq.${initial.id}`,
        },
        (payload) => {
          const row = payload.new as {
            status?: string
            date?: string
            partySize?: number
            notes?: string | null
          }
          setData((prev) => ({
            ...prev,
            ...(row.status && { status: row.status }),
            ...(row.date && { date: row.date }),
            ...(row.partySize !== undefined && { partySize: row.partySize }),
            ...(row.notes !== undefined && { notes: row.notes }),
          }))
        }
      )
      .subscribe()

    return () => { insforge.removeChannel(channel) }
  }, [initial.id])

  // ── Open this reservation in the account history ──
  function handleNavigateToReservation() {
    setIsOpen(false)
    const historyPath = getPathname({ locale: locale as Locale, href: "/account/reservations" })
    const fullHistoryPath = `/${locale}${historyPath === "/" ? "" : historyPath}`
    const isOnHistoryPage = pathname === fullHistoryPath
    if (isOnHistoryPage) {
      window.dispatchEvent(new CustomEvent("reservation:openHistory", { detail: { id: data.id } }))
    } else {
      router.push(`${fullHistoryPath}#reservation-${data.id}`)
    }
  }

  // ── Inline cancel: navigate to page instead of browser dialog ─
  function handleCancel() {
    handleNavigateToReservation()
  }

  // ── Rename handlers ───────────────────────────────────────────
  function openRename() {
    setDraftName(data.nickname ?? "")
    setIsRenaming(true)
  }

  async function submitRename() {
    setRenameLoading(true)
    const nickname = draftName.trim() || null
    try {
      await fetch(`/api/reservations/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", nickname }),
      })
      setData((prev) => ({ ...prev, nickname }))
    } finally {
      setRenameLoading(false)
      setIsRenaming(false)
    }
  }

  const dateObj = new Date(data.date)
  const limaDateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj)
  const [fyear, fmonth, fday] = limaDateParts.split("-")
  const dateStr = `${fday}/${fmonth}/${fyear.slice(2)}`
  const timeStr = dateObj.toLocaleTimeString(locale === "es" ? "es-PE" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Lima",
  })

  const statusConfig: Record<string, { color: string; dot: string; label: string }> = {
    PENDING:   {
      color: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/40",
      dot: "bg-amber-500",
      label: locale === "es" ? "Pendiente de confirmación" : "Pending confirmation",
    },
    CONFIRMED: {
      color: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700/40",
      dot: "bg-emerald-500",
      label: locale === "es" ? "Confirmada" : "Confirmed",
    },
    CANCELLED: {
      color: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700/40",
      dot: "bg-red-500",
      label: locale === "es" ? "Cancelada" : "Cancelled",
    },
    COMPLETED: {
      color: "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
      dot: "bg-gray-400",
      label: locale === "es" ? "Completada" : "Completed",
    },
  }
  const status = statusConfig[data.status] ?? statusConfig.PENDING
  const isCancellable = data.status === "PENDING" || data.status === "CONFIRMED"

  return (
    <div className="rounded-2xl border border-wg-border dark:border-wg-dark-border bg-white dark:bg-wg-dark-bg overflow-hidden shadow-card w-full">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-wg-primary to-wg-primary/80 px-4 py-3.5 flex items-center gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
          <CalendarCheckIcon className="w-[18px] h-[18px]" />
        </div>

        {/* Title + ID — takes all remaining space */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename()
                  if (e.key === "Escape") setIsRenaming(false)
                }}
                maxLength={60}
                placeholder={locale === "es" ? "Nombre de la reserva" : "Reservation name"}
                className="bg-white/20 text-white placeholder-white/50 text-xs font-semibold rounded-lg px-2 py-1 outline-none border border-white/30 focus:border-white/60 min-w-0 flex-1"
              />
              <button
                onClick={submitRename}
                disabled={renameLoading}
                className="shrink-0 p-1 rounded-md bg-white/20 hover:bg-white/30 transition disabled:opacity-50"
                aria-label={locale === "es" ? "Guardar" : "Save"}
              >
                <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setIsRenaming(false)}
                className="shrink-0 p-1 rounded-md bg-white/20 hover:bg-white/30 transition"
                aria-label={locale === "es" ? "Cancelar" : "Cancel"}
              >
                <CloseIcon className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-white text-sm font-semibold leading-tight truncate">
                {data.nickname || (context === "created"
                  ? (locale === "es" ? "Solicitud recibida" : "Request received")
                  : (locale === "es" ? "Reserva" : "Reservation")
                )}
              </p>
              <button
                onClick={openRename}
                className="shrink-0 p-0.5 rounded transition-opacity opacity-40 hover:opacity-100"
                aria-label={locale === "es" ? "Renombrar" : "Rename"}
              >
                <PencilIcon className="w-3 h-3 text-white" strokeWidth={2} />
              </button>
            </div>
          )}
          <p className="text-white/70 text-[11px] mt-0.5">
            #{data.id.slice(-6).toUpperCase()}
          </p>
        </div>

        {/* Live status badge — never shrinks */}
        <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${status.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`} />
          {status.label}
        </span>
      </div>

      {/* ── Details grid ────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          {/* Date */}
          <div className="bg-wg-bg dark:bg-wg-dark-raised rounded-xl px-3 py-2.5 flex flex-col">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted mb-1 flex items-center gap-1">
              <CalendarBandIcon className="w-3 h-3 shrink-0" strokeWidth={2} />
              {locale === "es" ? "Fecha" : "Date"}
            </p>
            <p className="text-lg font-bold text-wg-text dark:text-white tabular-nums mt-auto pt-0.5 self-center w-full text-center">
              {dateStr}
            </p>
          </div>

          {/* Time */}
          <div className="bg-wg-bg dark:bg-wg-dark-raised rounded-xl px-3 py-2.5 flex flex-col items-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted mb-1 flex items-center gap-1 self-start">
              <ClockRightAngleIcon className="w-3 h-3 shrink-0" strokeWidth={2} />
              {locale === "es" ? "Hora" : "Time"}
            </p>
            <p className="text-lg font-bold text-wg-text dark:text-white tabular-nums mt-auto mb-auto pt-0.5">
              {timeStr}
            </p>
          </div>
        </div>

        {/* Guests */}
        <div className="bg-wg-bg dark:bg-wg-dark-raised rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted mb-1 flex items-center gap-1">
            <UsersIcon className="w-3 h-3 shrink-0" strokeWidth={2} />
            {locale === "es" ? "Personas" : "Guests"}
          </p>
          <div className="relative flex items-center pt-0.5">
            <p className="absolute inset-0 flex items-center justify-center text-lg font-bold text-wg-text dark:text-white tabular-nums pointer-events-none">
              {data.partySize}
            </p>
            <div className="ml-auto flex -space-x-1.5">
              {Array.from({ length: Math.min(data.partySize, 5) }).map((_, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/20 border-2 border-wg-bg dark:border-wg-dark-raised flex items-center justify-center"
                >
                  <UserSolidEvenOddIcon className="w-3 h-3 text-wg-primary dark:text-wg-dark-primary" />
                </div>
              ))}
              {data.partySize > 5 && (
                <div className="w-6 h-6 rounded-full bg-wg-muted/20 dark:bg-wg-dark-muted/20 border-2 border-wg-bg dark:border-wg-dark-raised flex items-center justify-center">
                  <span className="text-[9px] font-bold text-wg-muted dark:text-wg-dark-muted">+{data.partySize - 5}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {data.notes && (
          <div className="bg-wg-bg dark:bg-wg-dark-raised rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted mb-1 flex items-center gap-1">
              <PencilShortIcon className="w-3 h-3" strokeWidth={2} />
              {locale === "es" ? "Notas" : "Notes"}
            </p>
            <p className="text-xs text-wg-text dark:text-wg-dark-text">{data.notes}</p>
          </div>
        )}

        {/* ── Actions ───────────────────────────────────────────── */}
        {data.status !== "CANCELLED" && data.status !== "COMPLETED" && (
          <div className="flex gap-2 pt-0.5">
            {/* Modify */}
            <button
              onClick={handleNavigateToReservation}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-wg-border dark:border-wg-dark-border text-xs font-semibold text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors"
            >
              <PencilIcon className="w-3.5 h-3.5" strokeWidth={2} />
              {locale === "es" ? "Modificar" : "Modify"}
            </button>

            {/* Cancel: open the reservation in the account history */}
            {isCancellable && (
              <button
                onClick={handleCancel}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 dark:border-red-800/50 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <CloseIcon className="w-3.5 h-3.5" strokeWidth={2} />
                {locale === "es" ? "Cancelar" : "Cancel"}
              </button>
            )}
          </div>
        )}

        {/* View reservations link */}
        <button
          className="w-full text-xs text-wg-primary dark:text-wg-secondary hover:underline font-medium text-center py-0.5"
          onClick={handleNavigateToReservation}
        >
          {locale === "es" ? "Ver esta reserva" : "View this reservation"}
        </button>
      </div>
    </div>
  )
}
