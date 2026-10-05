"use client"

// ══════════════════════════════════════════════════════════════════
// Link Email Callback — handles the magic-link redirect and
// finalizes the email identity linking.
//
// Flow:
//  1. InsForge JS processes hash tokens → session established.
//  2. Has password? → finalize directly (no form needed).
//     No password? → show Set Password form first.
//  3. POST /api/account/finalize-email-link inserts the email
//     identity and (optionally) sets the password.
//  4. IMPORTANT: admin.updateUserById({ password }) invalidates the
//     current session. We re-sign in with email+password immediately
//     after to restore the session before redirecting.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter, Link } from "@/i18n/routing"
import { createClient } from "@wildgrove/core/clients/client"
import { passwordRules } from "@wildgrove/core/validation"
import type { AuthUser as User } from '@wildgrove/core/auth/types'
import {
    CheckMiniIcon,
    CloseMiniIcon,
    EnvelopeIcon,
    ExclamationCircleIcon,
    EyeIcon,
    EyeSlashIcon,
    Spinner,
} from "@wildgrove/ui/icons"

type Stage = "loading" | "set-password" | "finalizing" | "error"

/** Label key, in the `auth` messages, of each password rule. */
const RULE_LABEL_KEYS: Record<string, string> = {
    length: "ruleLength",
    lowercase: "ruleLowercase",
    uppercase: "ruleUppercase",
    digit: "ruleDigit",
    symbol: "ruleSymbol",
}

export default function LinkEmailCallbackPage() {
    const t = useTranslations("linkEmail")
    const tAuth = useTranslations("auth")
    const fieldId = useId()
    const router = useRouter()

    const [stage,              setStage]              = useState<Stage>("loading")
    const [password,           setPassword]           = useState("")
    const [confirmPassword,    setConfirmPassword]    = useState("")
    const [showPassword,       setShowPassword]       = useState(false)
    const [passwordFocused,    setPasswordFocused]    = useState(false)
    const [formError,          setFormError]          = useState("")
    const [isSubmitting,       setIsSubmitting]       = useState(false)

    const handled       = useRef(false)
    const blurTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
    const capturedEmail = useRef<string | null>(null)

    // The finalize endpoint answers in English; the known refusals are shown
    // in the page's language and anything else as the generic message.
    const finalizeError = useCallback((error: unknown): string => {
        if (error === "Password does not meet the minimum requirements.") return tAuth("passwordRequirements")
        if (typeof error === "string" && error.startsWith("This account already has a password")) return t("errorHasPassword")
        return t("errorGeneric")
    }, [t, tAuth])

    // ── Finalize ──────────────────────────────────────────────────
    const callFinalize = useCallback(async (pwd?: string) => {
        setStage("finalizing")
        try {
            const res = await fetch("/api/account/finalize-email-link", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(pwd ? { password: pwd } : {}),
            })
            if (res.ok) {
                // admin.updateUserById({ password }) invalidates all sessions.
                // Re-sign in immediately with the new password to restore session.
                if (pwd && capturedEmail.current) {
                    const insforge = createClient()
                    await insforge.auth.signInWithPassword({
                        email:    capturedEmail.current,
                        password: pwd,
                    })
                }
                router.replace({ pathname: "/account", query: { linked: "email" } })
            } else {
                const data = await res.json().catch(() => ({}))
                setFormError(finalizeError(data.error))
                setStage("set-password")
            }
        } catch {
            setStage("error")
        }
    }, [router, finalizeError])

    // ── Session detection ─────────────────────────────────────────
    const processUser = useCallback((user: User) => {
        if (handled.current) return
        handled.current = true

        // Capture email before any session-invalidating operation
        capturedEmail.current = user.email ?? null

        const hasPassword =
            user.user_metadata?.has_password === true ||
            (user.identities ?? []).some((i: { provider: string }) => i.provider === "email")

        if (hasPassword) {
            void callFinalize()
        } else {
            setStage("set-password")
        }
    }, [callFinalize])

    useEffect(() => {
        const insforge = createClient()

        const { data: { subscription } } = insforge.auth.onAuthStateChange(
            (_event, session) => { if (session?.user) processUser(session.user) }
        )
        insforge.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) processUser(session.user)
        })

        const timeout = setTimeout(() => {
            if (!handled.current) setStage("error")
        }, 15_000)

        return () => {
            subscription.unsubscribe()
            clearTimeout(timeout)
            if (blurTimer.current) clearTimeout(blurTimer.current)
        }
    }, [processUser])

    // ── Form submit ───────────────────────────────────────────────
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setFormError("")
        const failing = passwordRules.filter(r => !r.test(password))
        if (failing.length > 0) {
            setFormError(tAuth("passwordRequirements"))
            return
        }
        if (password !== confirmPassword) {
            setFormError(tAuth("passwordsDontMatch"))
            return
        }
        setIsSubmitting(true)
        await callFinalize(password)
        setIsSubmitting(false)
    }

    function handlePasswordFocus() {
        if (blurTimer.current) clearTimeout(blurTimer.current)
        setPasswordFocused(true)
    }
    function handlePasswordBlur() {
        blurTimer.current = setTimeout(() => setPasswordFocused(false), 150)
    }

    // ── Loading / finalizing ──────────────────────────────────────
    if (stage === "loading" || stage === "finalizing") {
        return (
            <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg flex items-center justify-center px-4 pt-32 pb-20 md:pt-40 md:pb-24">
                <div className="max-w-sm w-full text-center">
                    <div className="w-14 h-14 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/10 flex items-center justify-center mx-auto mb-5">
                        <Spinner className="w-6 h-6 text-wg-primary dark:text-wg-dark-primary animate-spin" />
                    </div>
                    <h1 className="font-display text-xl font-bold text-wg-text dark:text-wg-dark-text mb-2">
                        {stage === "finalizing" ? t("linkingTitle") : t("verifyingTitle")}
                    </h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                        {stage === "finalizing" ? t("linkingBody") : t("verifyingBody")}
                    </p>
                </div>
            </div>
        )
    }

    // ── Error ─────────────────────────────────────────────────────
    if (stage === "error") {
        return (
            <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg flex items-center justify-center px-4 pt-32 pb-20 md:pt-40 md:pb-24">
                <div className="max-w-sm w-full text-center">
                    <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-5">
                        <ExclamationCircleIcon className="w-6 h-6 text-red-500" strokeWidth={2} />
                    </div>
                    <h1 className="font-display text-xl font-bold text-wg-text dark:text-wg-dark-text mb-2">
                        {t("errorTitle")}
                    </h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-6">
                        {t("errorBody")}
                    </p>
                    <Link href="/account" className="text-sm font-medium text-wg-primary dark:text-wg-dark-primary hover:underline">
                        {t("backToAccount")}
                    </Link>
                </div>
            </div>
        )
    }

    // ── Set password form ─────────────────────────────────────────
    const allRulesMet = passwordRules.every(r => r.test(password))

    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg flex items-center justify-center px-4 pt-32 pb-20 md:pt-40 md:pb-24">
            <div className="w-full max-w-md">

                {/* Card */}
                <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card overflow-hidden">
                    <div className="h-1 bg-wg-primary dark:bg-wg-dark-primary" />

                    <div className="px-8 py-8">

                        {/* Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="w-14 h-14 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/10 flex items-center justify-center">
                                <EnvelopeIcon className="w-6 h-6 text-wg-primary dark:text-wg-dark-primary" />
                            </div>
                        </div>

                        <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text text-center mb-2">
                            {t("title")}
                        </h1>
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted text-center mb-7 leading-relaxed">
                            {t("description")}
                        </p>

                        {/* Form error */}
                        {formError && (
                            <div className="mb-5 flex items-start gap-2.5 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                                <ExclamationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-0">

                            {/* Password field */}
                            <div>
                                <label htmlFor={`${fieldId}-password`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                    {tAuth("newPassword")}
                                </label>
                                <input
                                    id={`${fieldId}-password`}
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onFocus={handlePasswordFocus}
                                    onBlur={handlePasswordBlur}
                                    required
                                    placeholder={tAuth("createPassword")}
                                    autoComplete="new-password"
                                    className="w-full px-4 py-3 rounded-brand bg-wg-bg dark:bg-wg-dark-bg border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 text-sm focus:outline-none focus:border-wg-primary dark:focus:border-wg-dark-primary transition-colors"
                                />
                            </div>

                            {/* Requirements + bridge (visible while typing or focused) */}
                            {(passwordFocused || password.length > 0) && (
                                <div className="mt-3 flex items-stretch gap-3">

                                    {/* Requirements list */}
                                    <div className="flex-1">
                                        <div className="grid grid-cols-1 gap-1.5 px-1 py-0.5">
                                            {passwordRules.map(rule => {
                                                const met = rule.test(password)
                                                return (
                                                    <div key={rule.id} className="flex items-center gap-2">
                                                        <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                                                            met
                                                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                                : "bg-red-500/10 text-red-500 dark:text-red-400"
                                                        }`}>
                                                            {met ? (
                                                                <CheckMiniIcon className="w-2.5 h-2.5" />
                                                            ) : (
                                                                <CloseMiniIcon className="w-2.5 h-2.5" />
                                                            )}
                                                        </span>
                                                        <span className={`text-xs transition-colors ${
                                                            met ? "text-emerald-600 dark:text-emerald-400" : "text-wg-muted dark:text-wg-dark-muted"
                                                        }`}>
                                                            {tAuth(RULE_LABEL_KEYS[rule.id])}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Vertical bridge with eye toggle */}
                                    <div className="flex flex-col items-center w-8 flex-shrink-0 -mt-3 -mb-9">
                                        <div className="flex-1 w-px bg-wg-border dark:bg-wg-dark-border" />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(v => !v)}
                                            tabIndex={-1}
                                            aria-label={showPassword ? tAuth("hidePasswords") : tAuth("showPasswords")}
                                            className="p-2 rounded-full text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text border border-wg-border dark:border-wg-dark-border hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50 bg-wg-surface dark:bg-wg-dark-surface transition-all my-1.5 flex-shrink-0"
                                        >
                                            {showPassword ? (
                                                <EyeSlashIcon className="w-4 h-4" strokeWidth={2} />
                                            ) : (
                                                <EyeIcon className="w-4 h-4" strokeWidth={2} />
                                            )}
                                        </button>
                                        <div className="flex-1 w-px bg-wg-border dark:bg-wg-dark-border" />
                                    </div>
                                </div>
                            )}

                            {/* Confirm password */}
                            <div className="mt-3">
                                <label htmlFor={`${fieldId}-confirm`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                    {tAuth("confirmPassword")}
                                </label>
                                <input
                                    id={`${fieldId}-confirm`}
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    onFocus={handlePasswordFocus}
                                    onBlur={handlePasswordBlur}
                                    required
                                    placeholder={tAuth("repeatPassword")}
                                    autoComplete="new-password"
                                    className="w-full px-4 py-3 rounded-brand bg-wg-bg dark:bg-wg-dark-bg border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 text-sm focus:outline-none focus:border-wg-primary dark:focus:border-wg-dark-primary transition-colors"
                                />
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSubmitting || !allRulesMet || !confirmPassword}
                                className="w-full mt-6 py-3 rounded-brand bg-wg-primary dark:bg-wg-dark-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Spinner className="w-4 h-4 animate-spin" />
                                        {tAuth("saving")}
                                    </span>
                                ) : t("submit")}
                            </button>

                        </form>
                    </div>
                </div>

                <p className="text-center mt-5">
                    <Link href="/account" className="text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors">
                        {t("cancel")}
                    </Link>
                </p>

            </div>
        </div>
    )
}
