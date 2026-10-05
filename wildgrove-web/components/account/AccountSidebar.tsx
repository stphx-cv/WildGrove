"use client"

import { Link } from "@/i18n/routing"
import { useTranslations } from "next-intl"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { CalendarBandIcon, ClipboardListIcon, MapPinIcon, UserCircleIcon, WalletIcon } from "@wildgrove/ui/icons"

interface AccountSidebarProps {
  profile: {
    firstName: string
    lastName: string
    username: string | null
    avatarUrl: string | null
  }
  activeRoute: "account" | "orders" | "wallet" | "reservations" | "addresses"
}

export function AccountSidebar({ profile, activeRoute }: AccountSidebarProps) {
  const t = useTranslations("orders")

  const displayName = profile.firstName || profile.lastName
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : null

  const initials = [profile.firstName[0], profile.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "?"

  const navItems = [
    {
      key: "account" as const,
      href: "/account" as const,
      label: t("sidebar.myAccount"),
      icon: (
        <UserCircleIcon className="w-4 h-4 flex-shrink-0" />
      ),
    },
    {
      key: "orders" as const,
      href: "/orders" as const,
      label: t("sidebar.myOrders"),
      icon: (
        <ClipboardListIcon className="w-4 h-4 flex-shrink-0" />
      ),
    },
    {
      key: "wallet" as const,
      href: "/account/wallet" as const,
      label: t("sidebar.myWallet"),
      icon: (
        <WalletIcon className="w-4 h-4 flex-shrink-0" />
      ),
    },
    {
      key: "reservations" as const,
      href: "/account/reservations" as const,
      label: t("sidebar.myReservations"),
      icon: (
        <CalendarBandIcon className="w-4 h-4 flex-shrink-0" />
      ),
    },
    {
      key: "addresses" as const,
      href: "/account/addresses" as const,
      label: t("sidebar.myAddresses"),
      icon: (
        <MapPinIcon className="w-4 h-4 flex-shrink-0" />
      ),
    },
  ]

  return (
    <aside className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card overflow-hidden lg:sticky lg:top-28">
      {/* Avatar + name */}
      <div className="px-5 py-5 flex flex-col items-center text-center border-b border-wg-border/30 dark:border-wg-dark-border">
        <div
          className="w-16 h-16 rounded-full overflow-hidden mb-3 flex-shrink-0 ring-2 ring-wg-border/40 dark:ring-wg-dark-border"
          style={!profile.avatarUrl ? { background: "linear-gradient(135deg, #3A5A40, #C17F3A)" } : undefined}
        >
          {profile.avatarUrl ? (
            <FadeInImage
              src={profile.avatarUrl}
              alt={displayName ?? "Avatar"}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-white text-lg font-bold">
              {initials}
            </span>
          )}
        </div>
        {displayName && (
          <p className="font-display font-semibold text-sm text-wg-text dark:text-wg-dark-text leading-tight">
            {displayName}
          </p>
        )}
        {profile.username && (
          <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
            @{profile.username}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="py-2">
        {navItems.map((item) => {
          const isActive = item.key === activeRoute
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all border-l-2 ${
                isActive
                  ? "border-wg-accent text-wg-accent dark:text-wg-dark-accent bg-wg-accent/5 dark:bg-wg-dark-accent/5"
                  : "border-transparent text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
