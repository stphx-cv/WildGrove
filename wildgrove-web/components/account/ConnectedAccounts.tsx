"use client"

// ══════════════════════════════════════════════════════════════════
// ConnectedAccounts — Shows linked OAuth providers and allows
// linking / unlinking them from the /account page.
// ══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { useRouter } from "@/i18n/routing"
import { useTranslations, useLocale } from "next-intl"
import { createClient } from "@wildgrove/core/clients/client"
import type { LinkedIdentity } from "@wildgrove/core/types"
import { isGoogleAvatarUrl } from "@wildgrove/core/auth/google-avatar"
import {
    CheckCircleIcon,
    EnvelopeIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    EyeIcon,
    EyeSlashIcon,
    GoogleLogo,
    Spinner,
} from "@wildgrove/ui/icons"

interface Props {
    linkedIdentities: LinkedIdentity[]
    currentAvatarUrl: string | null
    justLinked?: "google" | "email"
    userEmail: string
}

type Status = "idle" | "loading" | "success" | "error"
type EmailLinkStatus = "idle" | "loading" | "sent" | "error"

export function ConnectedAccounts({ linkedIdentities, currentAvatarUrl, justLinked, userEmail }: Props) {
    const router = useRouter()
    const t = useTranslations("connectedAccounts")
    const locale = useLocale()

    const googleIdentity      = linkedIdentities.find(i => i.provider === "google") ?? null
    const hasEmailIdentity    = linkedIdentities.some(i => i.provider === "email")
    const isGoogleAvatarInUse = isGoogleAvatarUrl(currentAvatarUrl)

    const [linkStatus,          setLinkStatus]          = useState<Status>("idle")
    const [unlinkStatus,        setUnlinkStatus]        = useState<Status>("idle")
    const [unlinkEmailStatus,   setUnlinkEmailStatus]   = useState<Status>("idle")
    const [errorMsg,            setErrorMsg]            = useState("")
    const [showAvatarPrompt,    setShowAvatarPrompt]    = useState(false)
    const [showNoPassWarning,   setShowNoPassWarning]   = useState(false)
    const [successBanner,       setSuccessBanner]       = useState(justLinked === "google")
    const [emailLinkStatus,     setEmailLinkStatus]     = useState<EmailLinkStatus>("idle")
    const [emailErrorMsg,       setEmailErrorMsg]       = useState("")
    const [emailSuccessBanner,  setEmailSuccessBanner]  = useState(justLinked === "email")
    const [resendCooldown,      setResendCooldown]      = useState(0)
    // Email unlink — password confirmation form
    const [showEmailUnlinkForm, setShowEmailUnlinkForm] = useState(false)
    const [emailUnlinkPassword, setEmailUnlinkPassword] = useState("")
    const [showEmailUnlinkPass, setShowEmailUnlinkPass] = useState(false)
    const [emailUnlinkErrorMsg, setEmailUnlinkErrorMsg] = useState("")

    // Clean up ?linked=* query param so banner doesn't reappear on refresh
    useEffect(() => {
        if (justLinked) {
            router.replace("/account")
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Auto-dismiss success banners after 5 seconds
    const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        if (successBanner) {
            bannerTimer.current = setTimeout(() => setSuccessBanner(false), 5000)
        }
        return () => { if (bannerTimer.current) clearTimeout(bannerTimer.current) }
    }, [successBanner])

    const emailBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        if (emailSuccessBanner) {
            emailBannerTimer.current = setTimeout(() => setEmailSuccessBanner(false), 5000)
        }
        return () => { if (emailBannerTimer.current) clearTimeout(emailBannerTimer.current) }
    }, [emailSuccessBanner])

    // Resend cooldown countdown
    useEffect(() => {
        if (resendCooldown <= 0) return
        const id = setInterval(() => setResendCooldown(c => (c <= 1 ? 0 : c - 1)), 1000)
        return () => clearInterval(id)
    }, [resendCooldown])

    // ── Link ──────────────────────────────────────────────────────────────────
    async function handleLinkGoogle() {
        setLinkStatus("loading")
        setErrorMsg("")
        const insforge = createClient()
        const next = encodeURIComponent("/account?linked=google")
        const { error } = await insforge.auth.linkIdentity({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/api/auth/callback?mode=link&next=${next}`,
            },
        })
        // linkIdentity triggers a redirect on success — only reaches here on pre-flight errors
        if (error) {
            setLinkStatus("error")
            if (error.message.toLowerCase().includes("already")) {
                setErrorMsg(t("googleAlreadyLinked"))
            } else {
                setErrorMsg(error.message)
            }
        }
        // If no error, browser is navigating away — spinner stays visible intentionally
    }

    // ── Link Email ────────────────────────────────────────────────────────────
    async function handleLinkEmail() {
        setEmailLinkStatus("loading")
        setEmailErrorMsg("")
        const res = await fetch("/api/account/link-email", {
            method: "POST",
            headers: { "x-locale": locale },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            setEmailLinkStatus("error")
            setEmailErrorMsg(data.error ?? t("failedSendVerification"))
            return
        }
        setEmailLinkStatus("sent")
        setResendCooldown(60)
    }

    // ── Unlink (two-phase) ────────────────────────────────────────────────────
    async function handleUnlinkGoogle() {
        setErrorMsg("")
        setShowNoPassWarning(false)

        // Phase 1: fetch live user to check if a password exists.
        // We check user_metadata.has_password (set by the password API) because
        // updateUser({ password }) does NOT create an email identity in Supabase —
        // it only sets encrypted_password — so getUserIdentities() would always miss it.
        setUnlinkStatus("loading")
        const insforge = createClient()
        const { data: userData, error: liveErr } = await insforge.auth.getUser()
        setUnlinkStatus("idle")

        if (liveErr || !userData.user) {
            setErrorMsg(t("couldNotVerify"))
            return
        }

        const liveUser = userData.user
        const liveHasPassword =
            liveUser.user_metadata?.has_password === true ||
            liveUser.identities?.some((i: { provider: string }) => i.provider === "email")

        // Safety: must have a password before unlinking Google
        if (!liveHasPassword) {
            setShowNoPassWarning(true)
            return
        }

        // Phase 2: avatar prompt if the Google photo is currently active
        if (isGoogleAvatarInUse && !showAvatarPrompt) {
            setShowAvatarPrompt(true)
            return
        }

        void performUnlink(false)
    }

    async function performUnlink(keepAvatar: boolean) {
        setUnlinkStatus("loading")
        setShowAvatarPrompt(false)
        setErrorMsg("")

        // Avatar cleanup before unlinking (best-effort)
        if (isGoogleAvatarInUse && !keepAvatar) {
            try {
                await fetch("/api/account/avatar", { method: "DELETE" })
            } catch { /* best-effort */ }
        }

        // Use the backend admin route — the client-side unlinkIdentity requires ≥2
        // identities, but our admin endpoint bypasses that constraint.
        const res = await fetch("/api/account/unlink-google", { method: "POST" })
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            setUnlinkStatus("error")
            setErrorMsg(data.error ?? t("failedDisconnectGoogle"))
            return
        }

        setUnlinkStatus("idle")
        router.refresh()
    }

    // Dispatches an event that AccountForm listens for to auto-activate password edit
    function activatePasswordEdit() {
        window.dispatchEvent(new CustomEvent("wg:activate-password-edit"))
    }

    // ── Unlink Email ──────────────────────────────────────────────────────────
    async function handleUnlinkEmail() {
        setUnlinkEmailStatus("loading")
        setEmailUnlinkErrorMsg("")
        const res = await fetch("/api/account/unlink-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword: emailUnlinkPassword }),
        })
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            setUnlinkEmailStatus("error")
            setEmailUnlinkErrorMsg(data.error ?? t("failedDisconnectEmail"))
            return
        }
        setUnlinkEmailStatus("idle")
        setShowEmailUnlinkForm(false)
        setEmailUnlinkPassword("")
        setShowEmailUnlinkPass(false)
        window.dispatchEvent(new CustomEvent("wg:email-unlinked"))
        router.refresh()
    }

    const busy = linkStatus === "loading" || unlinkStatus === "loading" || unlinkEmailStatus === "loading"

    function resetEmailUnlinkForm() {
        setShowEmailUnlinkForm(false)
        setEmailUnlinkPassword("")
        setShowEmailUnlinkPass(false)
        setEmailUnlinkErrorMsg("")
        setUnlinkEmailStatus("idle")
    }

    return (
        <div className="mt-6 p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">

            {/* Header */}
            <div className="mb-6">
                <h2 className="font-display text-xl font-bold text-wg-text dark:text-wg-dark-text">
                    {t("title")}
                </h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-0.5">
                    {t("subtitle")}
                </p>
            </div>

            {/* Google success banner */}
            {successBanner && (
                <div className="mb-5 flex items-start gap-3 rounded-brand bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
                    <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                    {t("googleLinkedSuccess")}
                </div>
            )}

            {/* Email success banner */}
            {emailSuccessBanner && (
                <div className="mb-5 flex items-start gap-3 rounded-brand bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
                    <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                    {t("emailLinkedSuccess")}
                </div>
            )}

            {/* No-password warning */}
            {showNoPassWarning && (
                <div className="mb-5 flex items-start gap-3 rounded-brand bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                    <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                    <span>
                        {t("noPasswordWarning")}{" "}
                        <a
                            href="#password-section"
                            onClick={activatePasswordEdit}
                            className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
                        >
                            {t("setPassword")}
                        </a>
                    </span>
                </div>
            )}

            {/* Error banner */}
            {errorMsg && (
                <div className="mb-5 flex items-start gap-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    <ExclamationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                    {errorMsg}
                </div>
            )}

            {/* Google row */}
            <div className="flex items-center justify-between gap-4 py-2">

                {/* Left: logo + info */}
                <div className="flex items-center gap-3 min-w-0">
                    {/* Google logo */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-full border border-wg-border dark:border-wg-dark-border bg-white dark:bg-wg-dark-surface flex items-center justify-center">
                        <GoogleLogo width="18" height="18" />
                    </div>

                    <div className="min-w-0">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{t("google")}</p>
                        {googleIdentity ? (
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted truncate">
                                {googleIdentity.email ? t("connectedAs", { email: googleIdentity.email }) : t("connected")}
                            </p>
                        ) : (
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{t("notConnected")}</p>
                        )}
                    </div>
                </div>

                {/* Right: action button */}
                {googleIdentity ? (
                    <button
                        type="button"
                        onClick={handleUnlinkGoogle}
                        disabled={busy}
                        className="flex-shrink-0 text-sm font-medium px-4 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {unlinkStatus === "loading" ? (
                            <span className="flex items-center gap-2">
                                <Spinner className="w-3.5 h-3.5 animate-spin" />
                                {t("disconnecting")}
                            </span>
                        ) : t("disconnect")}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleLinkGoogle}
                        disabled={busy}
                        className="flex-shrink-0 text-sm font-medium px-4 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:border-wg-primary/50 dark:hover:border-wg-dark-primary/50 hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {linkStatus === "loading" ? (
                            <span className="flex items-center gap-2">
                                <Spinner className="w-3.5 h-3.5 animate-spin" />
                                {t("redirecting")}
                            </span>
                        ) : t("connectGoogle")}
                    </button>
                )}
            </div>

            {/* Divider */}
            <div className="border-t border-wg-border/40 dark:border-wg-dark-border my-1" />

            {/* Email row */}
            <div className="flex items-center justify-between gap-4 py-2">

                {/* Left: icon + info */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full border border-wg-border dark:border-wg-dark-border bg-white dark:bg-wg-dark-surface flex items-center justify-center">
                        <EnvelopeIcon className="w-[18px] h-[18px] text-wg-muted dark:text-wg-dark-muted" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{t("email")}</p>
                        {hasEmailIdentity ? (
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted truncate">
                                {t("connectedAs", { email: userEmail })}
                            </p>
                        ) : emailLinkStatus === "sent" ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                {t("checkInbox", { email: userEmail })}
                            </p>
                        ) : (
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{t("notConnected")}</p>
                        )}
                    </div>
                </div>

                {/* Right: action */}
                {hasEmailIdentity ? (
                    // Show Disconnect only when Google is also linked (minimum 1 method guard)
                    googleIdentity ? (
                        <button
                            type="button"
                            onClick={() => setShowEmailUnlinkForm(true)}
                            disabled={busy || showEmailUnlinkForm}
                            className="flex-shrink-0 text-sm font-medium px-4 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t("disconnect")}
                        </button>
                    ) : (
                        <span className="flex-shrink-0 text-sm font-medium px-4 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted cursor-default select-none">
                            {t("connected")}
                        </span>
                    )
                ) : emailLinkStatus === "sent" ? (
                    <button
                        type="button"
                        onClick={handleLinkEmail}
                        disabled={busy || resendCooldown > 0}
                        className="flex-shrink-0 text-sm font-medium px-4 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:border-wg-primary/50 dark:hover:border-wg-dark-primary/50 hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {resendCooldown > 0 ? t("resendCountdown", { seconds: resendCooldown }) : t("resend")}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleLinkEmail}
                        disabled={busy || emailLinkStatus === "loading"}
                        className="flex-shrink-0 text-sm font-medium px-4 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:border-wg-primary/50 dark:hover:border-wg-dark-primary/50 hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {emailLinkStatus === "loading" ? (
                            <span className="flex items-center gap-2">
                                <Spinner className="w-3.5 h-3.5 animate-spin" />
                                {t("sending")}
                            </span>
                        ) : t("connect")}
                    </button>
                )}
            </div>

            {/* Email link error */}
            {emailLinkStatus === "error" && emailErrorMsg && (
                <div className="mt-3 flex items-start gap-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    <ExclamationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                    {emailErrorMsg}
                </div>
            )}

            {/* Email unlink — inline password form */}
            {showEmailUnlinkForm && (
                <div className="mt-3 rounded-brand border border-wg-border/70 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg px-4 py-4">
                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-0.5">
                        {t("confirmPasswordTitle")}
                    </p>
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3 leading-relaxed">
                        {t("confirmPasswordDescription")}
                    </p>
                    <div className="relative mb-3">
                        <input
                            type={showEmailUnlinkPass ? "text" : "password"}
                            value={emailUnlinkPassword}
                            onChange={e => {
                                setEmailUnlinkPassword(e.target.value)
                                if (emailUnlinkErrorMsg) setEmailUnlinkErrorMsg("")
                            }}
                            placeholder={t("currentPassword")}
                            autoComplete="current-password"
                             
                            autoFocus
                            className="w-full px-4 pr-12 py-2.5 rounded-brand bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-wg-accent dark:focus:ring-wg-dark-accent transition"
                        />
                        <button
                            type="button"
                            onClick={() => setShowEmailUnlinkPass(v => !v)}
                            tabIndex={-1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                        >
                            {showEmailUnlinkPass ? (
                                <EyeSlashIcon className="w-5 h-5" />
                            ) : (
                                <EyeIcon className="w-5 h-5" />
                            )}
                        </button>
                    </div>

                    {emailUnlinkErrorMsg && (
                        <p className="text-xs text-red-600 dark:text-red-400 mb-3">{emailUnlinkErrorMsg}</p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            disabled={unlinkEmailStatus === "loading" || !emailUnlinkPassword}
                            onClick={handleUnlinkEmail}
                            className="px-4 py-2 text-sm font-medium rounded-brand bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {unlinkEmailStatus === "loading" ? (
                                <>
                                    <Spinner className="w-3.5 h-3.5 animate-spin" />
                                    {t("disconnecting")}
                                </>
                            ) : t("disconnectRemovePassword")}
                        </button>
                        <button
                            type="button"
                            onClick={resetEmailUnlinkForm}
                            disabled={unlinkEmailStatus === "loading"}
                            className="px-3 py-2 text-sm font-medium text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors disabled:opacity-50"
                        >
                            {t("cancel")}
                        </button>
                    </div>
                </div>
            )}

            {/* Avatar prompt — shown after clicking Disconnect when Google photo is active */}
            {showAvatarPrompt && (
                <div className="mt-4 rounded-brand border border-wg-border/70 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg px-4 py-4">
                    <p className="text-sm text-wg-text dark:text-wg-dark-text font-medium mb-1">
                        {t("avatarFromGoogle")}
                    </p>
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3">
                        {t("avatarAfterDisconnect")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => performUnlink(true)}
                            disabled={unlinkStatus === "loading"}
                            className="text-sm font-medium px-4 py-2 rounded-brand bg-wg-primary dark:bg-wg-dark-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {t("keepPhoto")}
                        </button>
                        <button
                            type="button"
                            onClick={() => performUnlink(false)}
                            disabled={unlinkStatus === "loading"}
                            className="text-sm font-medium px-4 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400 transition-all disabled:opacity-50"
                        >
                            {t("removePhoto")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAvatarPrompt(false)}
                            className="text-sm text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors px-2 py-2"
                        >
                            {t("cancel")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
