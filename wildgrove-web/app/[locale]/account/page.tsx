import { Link, redirect, type Locale } from "@/i18n/routing"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { pageMetadata } from "@/i18n/messages"
import { createClient } from "@wildgrove/core/clients/server"
import { AuthProvider, isPrismaConnectionExhausted, prisma } from "@wildgrove/db"
import { AccountForm } from "@/components/auth/AccountForm"
import { AvatarUpload } from "@/components/auth/AvatarUpload"
import { ConnectedAccounts } from "@/components/account/ConnectedAccounts"
import { AccountSidebar } from "@/components/account/AccountSidebar"
import { AccountDbUnavailable } from "@/components/account/AccountDbUnavailable"
import type { LinkedIdentity } from "@wildgrove/core/types"
import { ArrowLeftIcon, CalendarBandIcon, SageMark } from "@wildgrove/ui/icons"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    // Synchronous on purpose — see i18n/messages.ts: an awaited lookup here
    // lets the HTML shell win the race and pushes <title> out of <head>.
    return pageMetadata(locale, "account")
}

export default async function AccountPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ highlight?: string; linked?: string }>
}) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("account")

    const sp = await searchParams
    const highlightField = sp.highlight === "email" ? "email" as const
        : sp.highlight === "name" ? "name" as const
        : sp.highlight === "phone" ? "phone" as const
        : undefined
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    // Defense in depth -- middleware should catch this
    if (!user) {
        redirect({ href: "/portal", locale: locale as Locale })
        return null
    }

    type AccountProfile = {
        firstName: string | null
        lastName: string | null
        username: string | null
        email: string | null
        recoveryEmails: string[]
        recoveryPhones: string[]
        avatarUrl: string | null
        connections: AuthProvider[]
        phoneCountryCode: string | null
        phoneNumber: string | null
    }

    let profile: AccountProfile | null = null
    try {
        profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: {
                firstName: true,
                lastName: true,
                username: true,
                email: true,
                recoveryEmails: true,
                recoveryPhones: true,
                avatarUrl: true,
                connections: true,
                phoneCountryCode: true,
                phoneNumber: true,
            },
        })
    } catch (err) {
        if (isPrismaConnectionExhausted(err)) {
            return <AccountDbUnavailable />
        }
        throw err
    }

    const firstName     = profile?.firstName ?? ""
    const lastName      = profile?.lastName ?? ""
    const username      = profile?.username ?? ""
    const email         = profile?.email ?? user.email ?? ""
    const phone         = profile?.phoneCountryCode && profile?.phoneNumber
        ? `+${profile.phoneCountryCode}${profile.phoneNumber}`
        : null
    const recoveryEmails = profile?.recoveryEmails ?? []
    const recoveryPhones = profile?.recoveryPhones ?? []
    const avatarUrl     = profile?.avatarUrl ?? null
    const initials      = [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || "?"
    const memberSince   = user.created_at
        ? new Date(user.created_at).toLocaleDateString(locale, { month: "long", year: "numeric" })
        : ""
    // Google avatar URL -- only passed if user has a linked Google identity
    const isGoogleUser    = user.identities?.some((i: { provider: string }) => i.provider === "google") ?? false
    const googleAvatarUrl = isGoogleUser && typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null

    // Serialize identities for the ConnectedAccounts component
    const linkedIdentities: LinkedIdentity[] = (user.identities ?? []).map(
        (i: { provider: string; identity_data?: { email?: string } }) => ({
            provider: i.provider,
            email: i.identity_data?.email ?? null,
        })
    )
    const justLinked = (sp.linked === "google" || sp.linked === "email")
        ? (sp.linked as "google" | "email")
        : undefined
    const hasEmailIdentity = linkedIdentities.some(i => i.provider === "email")
    const hasPassword =
        hasEmailIdentity ||
        user.user_metadata?.has_password === true

    // Backfill Profile connections to stay in sync with actual auth state
    if (profile) {
        const currentConnections = profile.connections ?? []
        const expectedConnections: AuthProvider[] = []
        if (hasPassword && !currentConnections.includes(AuthProvider.EMAIL)) {
            expectedConnections.push(AuthProvider.EMAIL)
        }
        if (isGoogleUser && !currentConnections.includes(AuthProvider.GOOGLE)) {
            expectedConnections.push(AuthProvider.GOOGLE)
        }
        if (expectedConnections.length > 0) {
            await prisma.profile.update({
                where: { id: user.id },
                data: { connections: { set: [...currentConnections, ...expectedConnections] } },
            }).catch(() => { /* best-effort */ })
        }
    }

    const sidebarProfile = {
        firstName,
        lastName,
        username: username || null,
        avatarUrl,
    }

    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-28 pb-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-8 items-start">

                {/* Sidebar */}
                <AccountSidebar activeRoute="account" profile={sidebarProfile} />

                <div>
                {/* ── Profile banner ─────────────────────────────────── */}
                <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card overflow-hidden mb-8">

                    {/* Gradient strip */}
                    <div
                        className="h-20 sm:h-28 lg:h-32 w-full relative"
                        style={{
                            background: "linear-gradient(135deg, #3A5A40 0%, #1E2D22 40%, #C17F3A 100%)",
                        }}
                    >
                        {/* Decorative leaf watermark */}
                        <SageMark className="absolute right-6 bottom-2 w-[72px] h-[72px] text-white opacity-[0.07] dark:opacity-[0.05] hidden sm:block" />
                    </div>

                    {/* Profile content */}
                    <div className="px-6 sm:px-8 pb-6">
                        {/* Avatar — overlaps the gradient strip */}
                        <div className="-mt-10 sm:-mt-12 mb-4 flex justify-center sm:justify-start">
                            <AvatarUpload
                                initials={initials}
                                avatarUrl={avatarUrl}
                                firstName={firstName}
                                lastName={lastName}
                                googleAvatarUrl={googleAvatarUrl}
                            />
                        </div>

                        {/* Info row — clearly below the gradient */}
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                            {/* Name / username / email */}
                            <div className="text-center sm:text-left min-w-0">
                                <h1 className="font-display text-xl sm:text-2xl font-bold text-wg-text dark:text-wg-dark-text leading-tight">
                                    {firstName} {lastName}
                                </h1>
                                {username && (
                                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                        @{username}
                                    </p>
                                )}
                                <p className="text-xs text-wg-muted/70 dark:text-wg-dark-muted/70 mt-1 truncate max-w-full" title={email}>
                                    {email}
                                </p>
                            </div>

                            {/* Meta info */}
                            <div className="flex flex-col items-center sm:items-end gap-1.5 flex-shrink-0">
                                {memberSince && (
                                    <div className="flex items-center gap-2 text-xs text-wg-muted dark:text-wg-dark-muted">
                                        <CalendarBandIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                        {t("memberSince", { date: memberSince })}
                                    </div>
                                )}
                                <Link
                                    href="/"
                                    className="hidden sm:inline-flex text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors items-center gap-1.5"
                                >
                                    <ArrowLeftIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                    {t("backToHome")}
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Section heading ────────────────────────────────── */}
                <div className="mb-6">
                    <h2 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">
                        {t("description")}
                    </h2>
                </div>

                {/* ── Form sections ──────────────────────────────────── */}
                <main className="space-y-6">
                    <AccountForm
                        initialFirstName={firstName}
                        initialLastName={lastName}
                        initialUsername={username}
                        initialEmail={email}
                        initialRecoveryEmails={recoveryEmails}
                        initialPhone={phone}
                        initialRecoveryPhones={recoveryPhones}
                        highlightField={highlightField}
                        hasPassword={hasPassword}
                    />
                    <ConnectedAccounts
                        linkedIdentities={linkedIdentities}
                        currentAvatarUrl={avatarUrl}
                        justLinked={justLinked}
                        userEmail={email}
                    />
                </main>

                {/* Back link — mobile */}
                <p className="sm:hidden text-center text-xs text-wg-muted dark:text-wg-dark-muted mt-8">
                    <Link
                        href="/"
                        className="hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors inline-flex items-center gap-1.5"
                    >
                        <ArrowLeftIcon className="w-3.5 h-3.5" strokeWidth={2} />
                        {t("backToHome")}
                    </Link>
                </p>
                </div>
                </div>
            </div>
        </div>
    )
}
