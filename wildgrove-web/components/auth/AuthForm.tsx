"use client"

import { useState, useEffect, useRef, useCallback, useId } from "react"
import { useTranslations, useLocale } from "next-intl"
import type { InitialBalanceCredits } from "@wildgrove/core/wallet/initial-balance"
import { InitialBalanceNotice } from "@/components/auth/InitialBalanceNotice"
import { passwordRules, USERNAME_REGEX, NAME_REGEX } from "@wildgrove/core/validation"
import {
    CheckCircleIcon,
    CheckIcon,
    CheckMiniIcon,
    CloseIcon,
    CloseMiniIcon,
    EnvelopeIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    ExclamationTriangleReversedIcon,
    EyeIcon,
    EyeSlashIcon,
    GoogleLogo,
    Spinner,
} from "@wildgrove/ui/icons"

// ── Random placeholder data ──────────────────────────────────────────────────
const FIRST_NAMES = [
    "Liam", "Emma", "Noah", "Olivia", "Ethan", "Ava", "Mason", "Sophia",
    "Lucas", "Isabella", "Aiden", "Mia", "Jackson", "Charlotte", "Logan",
    "Amelia", "Sebastian", "Harper", "James", "Evelyn", "Owen", "Abigail",
    "Carter", "Ella", "Dylan", "Scarlett", "Wyatt", "Grace", "Leo", "Chloe",
    "Nathan", "Layla", "Henry", "Riley", "Caleb", "Zoey", "Ryan", "Nora",
    "Oliver", "Lily", "Elias", "Eleanor", "Aaron", "Hannah", "Isaac", "Aria",
    "Gabriel", "Aurora", "Julian"
]
const LAST_NAMES = [
    "Anderson", "Martinez", "Thompson", "Garcia", "White", "Robinson",
    "Clark", "Rodriguez", "Lewis", "Lee", "Walker", "Hall", "Allen",
    "Young", "Hernandez", "King", "Wright", "Lopez", "Hill", "Scott",
    "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter", "Mitchell",
    "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans",
    "Edwards", "Collins", "Stewart", "Sanchez", "Morris", "Rogers",
    "Reed", "Cook", "Morgan", "Bell", "Murphy", "Bailey", "Rivera", "Cooper",
    "Richardson", "Cox",
]
const EMAIL_PROVIDERS = [
    "gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com", "live.com"
]

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}
function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}
const FIXED_PLACEHOLDERS = {
    firstName: "Aurora",
    lastName: "Parker",
    username: "auroraparker",
    email: "auroraparker@gmail.com",
}
function generatePlaceholders() {
    const first = pick(FIRST_NAMES)
    const last = pick(LAST_NAMES)
    const provider = pick(EMAIL_PROVIDERS)
    const sep = pick([".", "_", "-", ""])
    const suffix = Math.random() < 0.70 ? String(randomInt(1, 99)) : ""
    const usernameStyle = randomInt(0, 2)
    let username: string
    if (usernameStyle === 0) {
        username = `${first.toLowerCase()}${sep}${last.toLowerCase()}${suffix}`
    } else if (usernameStyle === 1) {
        username = `${first.toLowerCase().slice(0, randomInt(2, 4))}${last.toLowerCase()}${suffix}`
    } else {
        username = `${last.toLowerCase()}${sep}${first.toLowerCase().slice(0, 2)}${suffix}`
    }
    const emailName = Math.random() < 0.5 ? username : `${first.toLowerCase()}${sep}${last.toLowerCase()}${suffix}`
    return {
        firstName: first,
        lastName: last,
        username,
        email: `${emailName}@${provider}`,
    }
}
// ─────────────────────────────────────────────────────────────────────────────

type AuthMode = "login" | "register"
type FormStatus = "idle" | "loading" | "verify-code" | "register-success" | "error" | "login-success"
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "too_short" | "invalid"

/** The `initialBalance` the sign up routes answer with: the amounts by currency, or null. */
function creditsFrom(data: unknown): InitialBalanceCredits | null {
    const raw = (data as { initialBalance?: unknown } | null)?.initialBalance
    if (!raw || typeof raw !== "object") return null
    const credits: InitialBalanceCredits = {}
    for (const currency of ["PEN", "USD"] as const) {
        const amount = (raw as Record<string, unknown>)[currency]
        if (typeof amount === "string") credits[currency] = amount
    }
    return Object.keys(credits).length > 0 ? credits : null
}

function isRegisterRetryCooldownError(message: string): boolean {
    const m = message.toLowerCase()
    return (
        (m.includes("wait") && m.includes("seconds")) ||
        m.includes("security purposes") ||
        m.includes("rate limit") ||
        m.includes("too many requests")
    )
}

interface FieldErrors {
    firstName?: boolean
    lastName?: boolean
    username?: boolean
    email?: boolean
    password?: boolean
    confirmPassword?: boolean
}

interface AuthFormProps {
    verified?: boolean
    authError?: string | null
    initialMode?: AuthMode
}

export function AuthForm({ verified = false, authError = null, initialMode = "login" }: AuthFormProps) {
    const t = useTranslations("auth")
    const fieldId = useId()
    const locale = useLocale()
    const ruleLabel = (id: string) => {
        const map: Record<string, string> = {
            length: t("ruleLength"), lowercase: t("ruleLowercase"),
            uppercase: t("ruleUppercase"), digit: t("ruleDigit"), symbol: t("ruleSymbol"),
        }
        return map[id] ?? id
    }
    const [mode, setMode] = useState<AuthMode>(initialMode)
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [status, setStatus] = useState<FormStatus>("idle")
    const [errorMessage, setErrorMessage] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
    const [showVerifiedBanner, setShowVerifiedBanner] = useState(verified)
    const [showErrorBanner, setShowErrorBanner] = useState(!!authError)
    const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle")
    const [identifier, setIdentifier] = useState("")
    const [loginErrorType, setLoginErrorType] = useState<
        "email-not-found" | "username-not-found" | "wrong-credentials" | "google-only" | null
    >(null)
    const [passwordSectionFocused, setPasswordSectionFocused] = useState(false)
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
    const [forgotEmail, setForgotEmail] = useState("")
    // What the server sends back for display: ma***@example.com. The address it
    // resolved from a username stays on the server.
    const [forgotMaskedEmail, setForgotMaskedEmail] = useState("")
    const [forgotStatus, setForgotStatus] = useState<"idle" | "loading" | "code-sent" | "verifying" | "invalid-code" | "code-verified" | "updating-password" | "password-updated" | "error">("idle")
    const [forgotOtpCode, setForgotOtpCode] = useState("")
    const [forgotNewPassword, setForgotNewPassword] = useState("")
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState("")
    const [forgotShowNewPassword, setForgotShowNewPassword] = useState(false)
    const [forgotErrorField, setForgotErrorField] = useState<"new" | "confirm" | null>(null)
    const [forgotErrorMessage, setForgotErrorMessage] = useState("")
    const [forgotResendCooldown, setForgotResendCooldown] = useState(0)
    const [verifyResendCooldown, setVerifyResendCooldown] = useState(0)
    const [verifyResendBusy, setVerifyResendBusy] = useState(false)
    const [verifyResendNotice, setVerifyResendNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null)
    // The sign up step that asks for the code InsForge emailed. `verifyIdentifier`
    // is what the server resolves to the address (an email, or a username when
    // the person came back through the sign in form).
    const [verifyIdentifier, setVerifyIdentifier] = useState("")
    const [verifyCode, setVerifyCode] = useState("")
    const [verifyState, setVerifyState] = useState<"idle" | "verifying" | "invalid">("idle")
    // What the new account was credited with, from the response that ended the sign up.
    const [initialBalance, setInitialBalance] = useState<InitialBalanceCredits | null>(null)
    const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const passwordBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // The examples are random, so they are picked after the first render: the
    // server and the browser would otherwise draw different ones and mismatch.
    const [placeholders, setPlaceholders] = useState(FIXED_PLACEHOLDERS)
    useEffect(() => setPlaceholders(generatePlaceholders()), [])

    function setError(fields: FieldErrors, message: string) {
        setFieldErrors(fields)
        setStatus("error")
        setErrorMessage(message)
    }

    function clearFieldError(field: keyof FieldErrors) {
        setFieldErrors(prev => ({ ...prev, [field]: false }))
    }

    const handleGoogleSignIn = async () => {
        const res = await fetch("/api/auth/oauth/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "google", locale, next: "/" }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.url) {
            setStatus("error")
            setErrorMessage(data.message || "Google sign-in failed")
            return
        }
        window.location.href = data.url as string
    }

    // Auto-dismiss banners after 8 seconds
    useEffect(() => {
        if (showVerifiedBanner) {
            const timer = setTimeout(() => setShowVerifiedBanner(false), 8000)
            return () => clearTimeout(timer)
        }
    }, [showVerifiedBanner])

    useEffect(() => {
        if (showErrorBanner) {
            const timer = setTimeout(() => setShowErrorBanner(false), 8000)
            return () => clearTimeout(timer)
        }
    }, [showErrorBanner])

    // Forgot password resend cooldown countdown
    useEffect(() => {
        if (forgotResendCooldown <= 0) return
        const id = setInterval(() => {
            setForgotResendCooldown(c => {
                if (c <= 1) { clearInterval(id); return 0 }
                return c - 1
            })
        }, 1000)
        return () => clearInterval(id)
    }, [forgotResendCooldown])

    // Post-registration verification email resend cooldown
    useEffect(() => {
        if (verifyResendCooldown <= 0) return
        const id = setInterval(() => {
            setVerifyResendCooldown(c => (c <= 1 ? 0 : c - 1))
        }, 1000)
        return () => clearInterval(id)
    }, [verifyResendCooldown])

    // Debounced username check
    const checkUsername = useCallback((value: string) => {
        if (usernameTimer.current) clearTimeout(usernameTimer.current)

        if (value.length === 0) {
            setUsernameStatus("idle")
            return
        }
        if (value.includes("@") || !USERNAME_REGEX.test(value)) {
            setUsernameStatus("invalid")
            return
        }
        if (value.length < 3) {
            setUsernameStatus("too_short")
            return
        }

        setUsernameStatus("checking")
        usernameTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`)
                const data = await res.json()
                setUsernameStatus(data.available ? "available" : "taken")
            } catch {
                setUsernameStatus("idle")
            }
        }, 400)
    }, [])

    function openForgotPassword() {
        setForgotEmail(identifier.trim())
        setForgotMaskedEmail("")
        setForgotStatus("idle")
        setShowForgotPasswordModal(true)
    }

    async function handleForgotPasswordSubmit(e: React.FormEvent) {
        e.preventDefault()
        setForgotStatus("loading")
        try {
            // An email or a username: the server resolves it and sends the code.
            // It answers the same whether the account exists or not: the masked
            // email for an email, and no address for a username.
            const res = await fetch("/api/auth/reset-password/send", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-locale": locale },
                body: JSON.stringify({ identifier: forgotEmail.trim() }),
            })
            if (!res.ok) throw new Error("send_failed")
            const data = await res.json().catch(() => ({}))

            setForgotMaskedEmail(typeof data.maskedEmail === "string" ? data.maskedEmail : "")
            setForgotStatus("code-sent")
            setForgotResendCooldown(30)
        } catch {
            setForgotStatus("error")
        }
    }

    async function handleForgotOtpVerify(e: React.FormEvent) {
        e.preventDefault()
        setForgotStatus("verifying")
        const res = await fetch("/api/auth/reset-password/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: forgotEmail.trim(),
                code: forgotOtpCode.trim(),
            }),
        })
        if (!res.ok) {
            setForgotStatus("invalid-code")
        } else {
            setForgotStatus("code-verified")
        }
    }

    async function handleForgotSetPassword(e: React.FormEvent) {
        e.preventDefault()
        setForgotErrorField(null)
        setForgotErrorMessage("")

        if (!passwordRules.every(r => r.test(forgotNewPassword))) {
            setForgotErrorField("new")
            setForgotErrorMessage(t("passwordRequirements"))
            return
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
            setForgotErrorField("confirm")
            setForgotErrorMessage(t("passwordsDontMatch"))
            return
        }

        setForgotStatus("updating-password")
        const res = await fetch("/api/auth/reset-password/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newPassword: forgotNewPassword }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            setForgotStatus("code-verified")
            setForgotErrorField("new")
            setForgotErrorMessage(data.message || "Could not update password")
        } else {
            setForgotStatus("password-updated")
        }
    }

    function closeForgotModal() {
        setShowForgotPasswordModal(false)
        setForgotStatus("idle")
        setForgotEmail("")
        setForgotMaskedEmail("")
        setForgotOtpCode("")
        setForgotNewPassword("")
        setForgotConfirmPassword("")
        setForgotErrorField(null)
        setForgotErrorMessage("")
        setForgotResendCooldown(0)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setStatus("loading")
        setErrorMessage("")
        setFieldErrors({})
        setLoginErrorType(null)
        setShowVerifiedBanner(false)
        setShowErrorBanner(false)

        // ── Registration validation ──────────────────────────────
        if (mode === "register") {
            if (!firstName.trim() || !lastName.trim()) {
                setError(
                    { firstName: !firstName.trim(), lastName: !lastName.trim() },
                    t("nameRequired")
                )
                return
            }

            if (!NAME_REGEX.test(firstName.trim()) || !NAME_REGEX.test(lastName.trim())) {
                setError(
                    {
                        firstName: !NAME_REGEX.test(firstName.trim()),
                        lastName: !NAME_REGEX.test(lastName.trim()),
                    },
                    t("nameInvalid")
                )
                return
            }

            if (username.includes("@") || !USERNAME_REGEX.test(username)) {
                setError({ username: true }, t("usernameInvalidFormat"))
                return
            }
            if (username.length < 3) {
                setError({ username: true }, t("usernameMin"))
                return
            }

            if (usernameStatus === "taken") {
                setError({ username: true }, t("usernameTakenError"))
                return
            }

            const failingRules = passwordRules.filter(r => !r.test(password))
            if (failingRules.length > 0) {
                setError({ password: true }, t("passwordRequirements"))
                return
            }

            if (password !== confirmPassword) {
                setError({ confirmPassword: true }, t("passwordsNoMatch"))
                return
            }
        }

        // ── Submit to InsForge auth APIs ─────────────────────────
        try {
            if (mode === "register") {
                const res = await fetch("/api/auth/sign-up", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email,
                        password,
                        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
                        locale,
                        metadata: {
                            first_name: firstName.trim(),
                            last_name: lastName.trim(),
                            username: username.trim().toLowerCase(),
                            locale,
                        },
                    }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data.message || "Sign up failed")
                // The email still has to be confirmed: ask for the code InsForge sent.
                if (data.requireEmailVerification) {
                    startVerifyStep(email.trim(), false)
                    return
                }
                // No confirmation required: the session is already open.
                try {
                    await fetch("/api/auth/sync-profile", { method: "POST" })
                } catch {
                    // Non-blocking
                }
                finishRegistration(creditsFrom(data))
                return
            } else {
                // An email or a username — sign-in resolves it server-side.
                const res = await fetch("/api/auth/sign-in", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identifier: identifier.trim(), password }),
                })
                const data = await res.json().catch(() => ({}))
                if (res.status === 403) {
                    // The account exists but its email was never confirmed: send a
                    // fresh code and ask for it.
                    startVerifyStep(identifier.trim(), true)
                    return
                }
                if (!res.ok) throw new Error(data.message || "Sign in failed")

                // Best-effort profile hydration
                try {
                    await fetch("/api/auth/sync-profile", { method: "POST" })
                } catch {
                    // Non-blocking
                }

                setStatus("login-success")
                // Full reload remounts CartProvider; session is read via /api/auth/session
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose, see above
                setTimeout(() => { window.location.href = "/" }, 1200)
                return
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Something went wrong"

            if (mode === "register" && isRegisterRetryCooldownError(message)) {
                startVerifyStep(email.trim(), false)
                return
            }

            if (mode === "login" && message.toLowerCase().includes("invalid login credentials")) {
                const usedUsername = !identifier.trim().includes("@")
                try {
                    const res = await fetch(`/api/auth/check-email?identifier=${encodeURIComponent(identifier.trim())}`)
                    const data = (await res.json()) as { exists?: boolean; googleSignInOnly?: boolean }
                    if (!data.exists) {
                        setLoginErrorType(usedUsername ? "username-not-found" : "email-not-found")
                        setError({ email: true }, usedUsername ? "username-not-found" : "email-not-found")
                        return
                    }
                    if (data.googleSignInOnly) {
                        setLoginErrorType("google-only")
                        setError({ email: true, password: true }, "google-only")
                        return
                    }
                    setLoginErrorType("wrong-credentials")
                    setError({ password: true }, t("incorrectPassword"))
                } catch {
                    setError({ email: true, password: true }, t("invalidCredentials"))
                }
                return
            }

            setLoginErrorType(null)
            const fields: FieldErrors = mode === "login"
                ? { email: true, password: true }
                : { email: true }
            setError(fields, message ?? t("somethingWrong"))
        }
    }

    function startVerifyStep(target: string, sendCode: boolean) {
        setVerifyIdentifier(target)
        setVerifyCode("")
        setVerifyState("idle")
        setVerifyResendNotice(null)
        setVerifyResendCooldown(30)
        setStatus("verify-code")
        if (sendCode) void handleResendVerification(target, true)
    }

    async function handleResendVerification(target = verifyIdentifier, quiet = false) {
        const trimmed = target.trim()
        if (!trimmed || (!quiet && (verifyResendCooldown > 0 || verifyResendBusy))) return
        setVerifyResendBusy(true)
        setVerifyResendNotice(null)
        try {
            const res = await fetch("/api/auth/resend-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-locale": locale },
                body: JSON.stringify({ identifier: trimmed }),
            })
            const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
            if (!res.ok) {
                setVerifyResendNotice({
                    kind: "error",
                    text: data.error ?? t("resendVerificationFailed"),
                })
                if (res.status === 429) {
                    setVerifyResendCooldown(60)
                }
                return
            }
            if (!quiet) setVerifyResendNotice({ kind: "success", text: t("resendVerificationSuccess") })
            setVerifyResendCooldown(60)
        } catch {
            setVerifyResendNotice({ kind: "error", text: t("resendVerificationFailed") })
        } finally {
            setVerifyResendBusy(false)
        }
    }

    /** Opens the success screen. With a starting balance to announce it waits longer, so it can be read. */
    function finishRegistration(credits: InitialBalanceCredits | null) {
        setInitialBalance(credits)
        setStatus("register-success")
        // Full reload remounts CartProvider; session is read via /api/auth/session
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose, see above
        setTimeout(() => { window.location.href = "/" }, credits ? 5000 : 1200)
    }

    async function handleVerifyCode(e: React.FormEvent) {
        e.preventDefault()
        setVerifyState("verifying")
        try {
            const res = await fetch("/api/auth/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: verifyIdentifier, code: verifyCode.trim() }),
            })
            if (!res.ok) {
                setVerifyState("invalid")
                return
            }
            const data = await res.json().catch(() => ({}))
            finishRegistration(creditsFrom(data))
        } catch {
            setVerifyState("invalid")
        }
    }

    // ── Login Success State ───────────────────────────────────────
    if (status === "login-success") {
        return (
            <div className="text-center py-8 animate-fade-up">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircleIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text mb-3">
                    {t("welcomeBackTitle")}
                </h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                    {t("redirectingToWildGrove")}
                </p>
            </div>
        )
    }

    // ── Shared input class helpers ───────────────────────────────
    const inputBase = "w-full px-4 py-3 rounded-brand border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 focus:outline-none focus:ring-2 transition"
    const inputNormal = "border-wg-border dark:border-wg-dark-border focus:ring-wg-accent dark:focus:ring-wg-dark-accent"
    const inputErr = "border-red-400 dark:border-red-500 focus:ring-red-400 dark:focus:ring-red-500"
    const inputGoogleHint =
        "border-amber-400/80 dark:border-amber-500/70 focus:ring-amber-400 dark:focus:ring-amber-500"
    const cls = (field: keyof FieldErrors, extra = "") => {
        const googleHintField =
            mode === "login" && loginErrorType === "google-only" && (field === "email" || field === "password")
        const border = googleHintField ? inputGoogleHint : fieldErrors[field] ? inputErr : inputNormal
        return `${inputBase} ${extra} ${border}`
    }

    // ── Registered: the session is open ─────────────────────────
    if (status === "register-success") {
        return (
            <div className="text-center py-8 animate-fade-up">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircleIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text mb-3">
                    {t("accountReadyTitle")}
                </h2>
                <InitialBalanceNotice
                    credits={initialBalance}
                    className="text-sm text-wg-text dark:text-wg-dark-text mb-3"
                />
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                    {t("redirectingToWildGrove")}
                </p>
                {initialBalance && (
                    <button
                        type="button"
                        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose, see above
                        onClick={() => { window.location.href = "/" }}
                        className="mt-6 px-6 py-2.5 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-colors"
                    >
                        {t("continueButton")}
                    </button>
                )}
            </div>
        )
    }

    // ── Registration: enter the code that was emailed ───────────
    if (status === "verify-code") {
        return (
            <form onSubmit={handleVerifyCode} className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/15 flex items-center justify-center">
                    <EnvelopeIcon className="w-8 h-8 text-wg-primary dark:text-wg-dark-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text mb-3">
                    {t("checkInboxTitle")}
                </h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted max-w-sm mx-auto leading-relaxed mb-5">
                    {verifyIdentifier.includes("@")
                        ? t("codeSentDesc", { email: verifyIdentifier })
                        : t("codeSentDescUsername")}
                </p>
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => {
                        setVerifyCode(e.target.value.replace(/\D/g, ""))
                        if (verifyState === "invalid") setVerifyState("idle")
                    }}
                    placeholder="000000"
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    aria-label={t("verificationCodeLabel")}
                    className={`${inputBase} ${verifyState === "invalid" ? inputErr : inputNormal} max-w-xs mx-auto text-center tracking-[0.4em] text-lg font-mono`}
                />
                {verifyState === "invalid" && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2">{t("invalidCode")}</p>
                )}
                <button
                    type="submit"
                    disabled={verifyCode.length < 6 || verifyState === "verifying"}
                    className="w-full max-w-xs mt-5 px-5 py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    {verifyState === "verifying" ? t("verifying") : t("verify")}
                </button>
                <p className="text-xs text-wg-muted dark:text-wg-dark-muted max-w-sm mx-auto mt-5">
                    {t("resendVerificationHint")}
                </p>
                <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    disabled={verifyResendBusy || verifyResendCooldown > 0}
                    className="w-full max-w-xs mt-3 px-4 py-2.5 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text hover:border-wg-primary/40 dark:hover:border-wg-dark-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {verifyResendBusy
                        ? t("resendVerificationSending")
                        : verifyResendCooldown > 0
                            ? t("didntReceiveResendCooldown", { seconds: verifyResendCooldown })
                            : t("resendCode")}
                </button>
                {verifyResendNotice && (
                    <p
                        className={`text-xs mt-3 max-w-sm mx-auto ${
                            verifyResendNotice.kind === "success"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                        }`}
                    >
                        {verifyResendNotice.text}
                    </p>
                )}
                <button
                    type="button"
                    onClick={() => {
                        setStatus("idle")
                        setEmail("")
                        setPassword("")
                        setConfirmPassword("")
                        setFieldErrors({})
                        setErrorMessage("")
                        setShowErrorBanner(false)
                        setVerifyCode("")
                        setVerifyState("idle")
                        setVerifyResendCooldown(0)
                        setVerifyResendNotice(null)
                        setVerifyResendBusy(false)
                        // Keep name + username; only change email (user re-enters passwords for a new signup attempt)
                        if (username.length >= 3 && USERNAME_REGEX.test(username) && !username.includes("@")) {
                            checkUsername(username)
                        } else {
                            setUsernameStatus("idle")
                        }
                    }}
                    className="block mx-auto mt-6 text-sm text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors"
                >
                    {t("useDifferentEmail")}
                </button>
            </form>
        )
    }

    // ── Form State ──────────────────────────────────────────────
    return (
        <>
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Verified Banner */}
            {showVerifiedBanner && (
                <div className="p-3 rounded-brand bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 flex items-start gap-3 animate-fade-up">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t("emailVerifiedTitle")}</p>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{t("emailVerifiedBody")}</p>
                    </div>
                </div>
            )}

            {/* Auth Error Banner */}
            {showErrorBanner && authError === "auth_callback_failed" && (
                <div className="p-3 rounded-brand bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 flex items-start gap-3 animate-fade-up">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{t("linkExpiredTitle")}</p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">{t("linkExpiredBody")}</p>
                    </div>
                </div>
            )}

            {/* Mode Toggle */}
            <div className="flex rounded-brand bg-wg-bg dark:bg-wg-dark-raised border border-wg-border dark:border-wg-dark-border p-1">
                <button
                    type="button"
                    onClick={() => { setIdentifier(email || username || ""); setMode("login"); setErrorMessage(""); setFieldErrors({}); setLoginErrorType(null); setEmail("") }}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-[0.5rem] transition-all ${mode === "login"
                        ? "bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text shadow-sm"
                        : "text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text"
                        }`}
                >
                    {t("signIn")}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const current = identifier.trim()
                        if (current.includes('@')) { setEmail(current); setUsername("") } else { setUsername(current); setEmail("") }
                        setMode("register"); setErrorMessage(""); setFieldErrors({}); setLoginErrorType(null); setIdentifier("")
                    }}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-[0.5rem] transition-all ${mode === "register"
                        ? "bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text shadow-sm"
                        : "text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text"
                        }`}
                >
                    {t("createAccount")}
                </button>
            </div>

            {/* Google OAuth */}
            <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-brand border border-wg-border dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text text-sm font-medium hover:border-wg-primary/40 dark:hover:border-wg-dark-primary/40 hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-all shadow-card"
            >
                <GoogleLogo width="18" height="18" />
                {t("continueWithGoogle")}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-wg-border dark:bg-wg-dark-border" />
                <span className="text-xs text-wg-muted dark:text-wg-dark-muted">{t("or")}</span>
                <div className="flex-1 h-px bg-wg-border dark:bg-wg-dark-border" />
            </div>

            {/* Registration-only fields */}
            {mode === "register" && (
                <>
                    {/* First Name + Last Name */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor={`${fieldId}-first-name`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                                {t("firstName")}
                            </label>
                            <input
                                id={`${fieldId}-first-name`}
                                type="text"
                                value={firstName}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^[\p{L}\s'-]/gu, '')
                                    setFirstName(val)
                                    clearFieldError("firstName")
                                }}
                                placeholder={placeholders.firstName}
                                required
                                autoComplete="given-name"
                                className={cls("firstName")}
                            />
                        </div>
                        <div>
                            <label htmlFor={`${fieldId}-last-name`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                                {t("lastName")}
                            </label>
                            <input
                                id={`${fieldId}-last-name`}
                                type="text"
                                value={lastName}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^[\p{L}\s'-]/gu, '')
                                    setLastName(val)
                                    clearFieldError("lastName")
                                }}
                                placeholder={placeholders.lastName}
                                required
                                autoComplete="family-name"
                                className={cls("lastName")}
                            />
                        </div>
                    </div>

                    {/* Email first in register flow so browsers autocomplete email here, not into username */}
                    <div>
                        <label htmlFor={`${fieldId}-email`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                            {t("emailAddress")}
                        </label>
                        <input
                            id={`${fieldId}-email`}
                            type="email"
                            name="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); clearFieldError("email") }}
                            placeholder={placeholders.email}
                            required
                            autoComplete="email"
                            className={cls("email")}
                        />
                    </div>

                    {/* Username — autocomplete "nickname" avoids Chrome filling login email here */}
                    <div>
                        <label htmlFor={`${fieldId}-username`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                            {t("username")}
                        </label>
                        <div className="relative">
                            <input
                                id={`${fieldId}-username`}
                                type="text"
                                name="nickname"
                                value={username}
                                onChange={(e) => {
                                    const val = e.target.value.toLowerCase().replace(/\s/g, '')
                                    setUsername(val)
                                    clearFieldError("username")
                                    checkUsername(val)
                                }}
                                placeholder={placeholders.username}
                                required
                                autoComplete="nickname"
                                className={`${inputBase} pr-10 ${
                                    fieldErrors.username || usernameStatus === "taken" || usernameStatus === "invalid"
                                        ? inputErr
                                        : inputNormal
                                }`}
                            />
                            {/* Status indicator */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {usernameStatus === "checking" && (
                                    <Spinner className="animate-spin w-4 h-4 text-wg-muted" />
                                )}
                                {usernameStatus === "available" && (
                                    <CheckIcon className="w-4 h-4 text-emerald-500" strokeWidth={2} />
                                )}
                                {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                                    <CloseIcon className="w-4 h-4 text-red-500" strokeWidth={2} />
                                )}
                            </div>
                        </div>
                        {usernameStatus === "taken" && (
                            <p className="text-xs text-red-500 mt-1">{t("usernameTakenHint")}</p>
                        )}
                    </div>
                </>
            )}

            {/* Login: email or username */}
            {mode === "login" && (
                <div>
                    <label htmlFor={`${fieldId}-identifier`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                        {t("emailOrUsername")}
                    </label>
                    <input
                        id={`${fieldId}-identifier`}
                        type="text"
                        value={identifier}
                        onChange={(e) => { setIdentifier(e.target.value); clearFieldError("email") }}
                        placeholder={t("emailOrUsernamePlaceholder")}
                        required
                        autoComplete="username"
                        className={cls("email")}
                    />
                </div>
            )}

            {/* Password — login: eye inside / register: bridge + confirm grouped */}
            {mode === "login" ? (
                <div>
                    <label htmlFor={`${fieldId}-password`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                        {t("password")}
                    </label>
                    <div className="relative">
                        <input
                            id={`${fieldId}-password`}
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); clearFieldError("password") }}
                            placeholder={t("enterPassword")}
                            required
                            autoComplete="current-password"
                            className={cls("password", "pr-12")}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                            tabIndex={-1}
                        >
                            {showPassword ? (
                                <EyeSlashIcon className="w-5 h-5" />
                            ) : (
                                <EyeIcon className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                    <div className="flex justify-end mt-1.5">
                        <button
                            type="button"
                            onClick={openForgotPassword}
                            className="text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors"
                        >
                            {t("forgotPassword")}
                        </button>
                    </div>
                </div>
            ) : (
                /* Register: password + requirements/bridge/confirm in one tight container */
                <div>
                    {/* Password field */}
                    <label htmlFor={`${fieldId}-new-password`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                        {t("password")}
                    </label>
                    <input
                        id={`${fieldId}-new-password`}
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); clearFieldError("password") }}
                        onFocus={() => {
                            if (passwordBlurTimer.current) clearTimeout(passwordBlurTimer.current)
                            setPasswordSectionFocused(true)
                        }}
                        onBlur={() => {
                            passwordBlurTimer.current = setTimeout(() => setPasswordSectionFocused(false), 150)
                        }}
                        placeholder={t("createPassword")}
                        required
                        autoComplete="new-password"
                        className={cls("password")}
                    />

                    {/* Requirements + vertical bridge — visible when focused OR password has content */}
                    {(passwordSectionFocused || password.length > 0) && (
                        <div className="mt-3 flex items-stretch gap-3">
                            <div className="flex-1">
                                <div className="grid grid-cols-1 gap-1.5 px-1 py-0.5">
                                    {passwordRules.map(rule => {
                                        const met = rule.test(password)
                                        return (
                                            <div key={rule.id} className="flex items-center gap-2">
                                                <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${met ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                    : "bg-red-500/10 text-red-500 dark:text-red-400"
                                                    }`}>
                                                    {met ? (
                                                        <CheckMiniIcon className="w-2.5 h-2.5" />
                                                    ) : (
                                                        <CloseMiniIcon className="w-2.5 h-2.5" />
                                                    )}
                                                </span>
                                                <span className={`text-xs transition-colors ${met ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-wg-muted dark:text-wg-dark-muted"
                                                    }`}>
                                                    {ruleLabel(rule.id)}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Vertical bridge: -mt-3 reaches password input, -mb-9 reaches confirm input */}
                            <div className="flex flex-col items-center w-8 flex-shrink-0 -mt-3 -mb-9">
                                <div className="flex-1 w-px bg-wg-border dark:bg-wg-dark-border" />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="p-2 rounded-full text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text border border-wg-border dark:border-wg-dark-border hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50 bg-wg-surface dark:bg-wg-dark-surface transition-all my-1.5 flex-shrink-0"
                                    tabIndex={-1}
                                    aria-label={showPassword ? t("hidePasswords") : t("showPasswords")}
                                >
                                    {showPassword ? (
                                        <EyeSlashIcon className="w-4 h-4" />
                                    ) : (
                                        <EyeIcon className="w-4 h-4" />
                                    )}
                                </button>
                                <div className="flex-1 w-px bg-wg-border dark:bg-wg-dark-border" />
                            </div>
                        </div>
                    )}

                    {/* Confirm password */}
                    <div className="mt-3">
                        <label htmlFor={`${fieldId}-confirm-password`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                            {t("confirmPassword")}
                        </label>
                        <input
                            id={`${fieldId}-confirm-password`}
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword") }}
                            onFocus={() => {
                                if (passwordBlurTimer.current) clearTimeout(passwordBlurTimer.current)
                                setPasswordSectionFocused(true)
                            }}
                            onBlur={() => {
                                passwordBlurTimer.current = setTimeout(() => setPasswordSectionFocused(false), 150)
                            }}
                            placeholder={t("repeatPassword")}
                            required
                            autoComplete="new-password"
                            className={cls("confirmPassword")}
                        />
                    </div>
                </div>
            )}

            {/* Error Message */}
            {status === "error" && errorMessage && (
                <div
                    className={
                        loginErrorType === "google-only"
                            ? "p-3 rounded-brand bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40"
                            : "p-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30"
                    }
                >
                    {loginErrorType === "google-only" ? (
                        <div className="flex items-start gap-3">
                            <ExclamationCircleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{t("googleSignInOnlyTitle")}</p>
                                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1 leading-relaxed">{t("googleSignInOnlyBody")}</p>
                            </div>
                        </div>
                    ) : (loginErrorType === "email-not-found" || loginErrorType === "username-not-found") ? (
                        <div>
                            <p className="text-sm font-medium text-red-700 dark:text-red-300">
                                {loginErrorType === "email-not-found"
                                    ? t("noAccountEmail")
                                    : t("noAccountUsername")
                                }
                            </p>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                                {t("newToWildGrove")}{" "}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const current = identifier.trim()
                                        if (current.includes('@')) {
                                            setEmail(current)
                                            setUsername("")
                                        } else {
                                            setUsername(current)
                                            setEmail("")
                                        }
                                        setMode("register"); setErrorMessage(""); setFieldErrors({}); setLoginErrorType(null); setIdentifier("")
                                    }}
                                    className="font-medium underline underline-offset-2 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                                >
                                    {t("createAnAccount")}
                                </button>
                                {" "}{t("toGetStarted")}
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
                    )}
                </div>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={status === "loading"}
                className="w-full px-7 py-3.5 text-base font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
                {status === "loading" ? (
                    <>
                        <Spinner className="animate-spin h-5 w-5" />
                        {mode === "register" ? t("creatingAccount") : t("signingIn")}
                    </>
                ) : mode === "register" ? t("createAccount") : t("signIn")}
            </button>

            {/* Trust Copy */}
            <p className="text-center text-xs text-wg-muted dark:text-wg-dark-muted">
                {mode === "register" ? t("verificationNote") : t("secureAuthNote")}
            </p>
        </form>

        {/* Forgot password modal */}
        {showForgotPasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border rounded-card shadow-card p-6 max-w-sm w-full mx-4">

                    {/* ── Step 1: Enter email / username ── */}
                    {(forgotStatus === "idle" || forgotStatus === "loading" || forgotStatus === "error") && (
                        <form onSubmit={handleForgotPasswordSubmit}>
                            <h3 className="text-base font-semibold text-wg-text dark:text-wg-dark-text mb-2">{t("forgotPasswordTitle")}</h3>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-4">
                                {t("forgotPasswordDesc")}
                            </p>
                            <input
                                type="text"
                                value={forgotEmail}
                                onChange={(e) => { setForgotEmail(e.target.value); if (forgotStatus !== "idle") setForgotStatus("idle") }}
                                placeholder={t("emailOrUsernamePlaceholder")}
                                required
                                autoComplete="email"
                                className={`${inputBase} ${inputNormal} mb-4`}
                            />
                            {forgotStatus === "error" && (
                                <p className="text-xs text-red-500 dark:text-red-400 mb-4">{t("couldNotSendCode")}</p>
                            )}
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={closeForgotModal}
                                    className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-primary/40 dark:hover:border-wg-dark-primary/40 transition-colors">
                                    {t("cancel")}
                                </button>
                                <button type="submit" disabled={forgotStatus === "loading"}
                                    className="px-5 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100">
                                    {forgotStatus === "loading" ? t("sendingCode") : t("sendCode")}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ── Step 2: Enter 6-digit OTP ── */}
                    {(forgotStatus === "code-sent" || forgotStatus === "verifying" || forgotStatus === "invalid-code") && (
                        <form onSubmit={handleForgotOtpVerify}>
                            <h3 className="text-base font-semibold text-wg-text dark:text-wg-dark-text mb-2">{t("codeSentTitle")}</h3>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-4">
                                {forgotMaskedEmail
                                    ? t("codeSentDesc", { email: forgotMaskedEmail })
                                    : t("codeSentDescUsername")}
                            </p>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={forgotOtpCode}
                                onChange={(e) => { setForgotOtpCode(e.target.value.replace(/\D/g, "")); if (forgotStatus === "invalid-code") setForgotStatus("code-sent") }}
                                placeholder="000000"
                                required
                                autoComplete="one-time-code"
                                className={`${inputBase} ${inputNormal} mb-1 text-center tracking-[0.4em] text-lg font-mono`}
                            />
                            {forgotStatus === "invalid-code" && (
                                <p className="text-xs text-red-500 dark:text-red-400 mb-3">{t("invalidCode")}</p>
                            )}
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-4">
                                {t("didntReceive")}{" "}
                                {forgotResendCooldown > 0 ? (
                                    <span className="opacity-50 cursor-default">
                                        {t("didntReceiveResendCooldown", { seconds: forgotResendCooldown })}
                                    </span>
                                ) : (
                                    <button type="button" onClick={handleForgotPasswordSubmit as unknown as React.MouseEventHandler}
                                        className="text-wg-primary dark:text-wg-dark-primary hover:underline transition-colors">
                                        {t("resendCode")}
                                    </button>
                                )}
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={closeForgotModal}
                                    className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-primary/40 dark:hover:border-wg-dark-primary/40 transition-colors">
                                    {t("cancel")}
                                </button>
                                <button type="submit" disabled={forgotOtpCode.length < 6 || forgotStatus === "verifying"}
                                    className="px-5 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100">
                                    {forgotStatus === "verifying" ? t("verifying") : t("verify")}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ── Step 3: Set new password ── */}
                    {(forgotStatus === "code-verified" || forgotStatus === "updating-password") && (
                        <form onSubmit={handleForgotSetPassword}>
                            <h3 className="text-base font-semibold text-wg-text dark:text-wg-dark-text mb-2">{t("setNewPasswordTitle")}</h3>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-4">{t("setNewPasswordDesc")}</p>

                            {/* New password */}
                            <div>
                                <label htmlFor={`${fieldId}-reset-password`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">{t("newPasswordLabel")}</label>
                                <input
                                    id={`${fieldId}-reset-password`}
                                    type={forgotShowNewPassword ? "text" : "password"}
                                    value={forgotNewPassword}
                                    onChange={(e) => {
                                        setForgotNewPassword(e.target.value)
                                        if (forgotErrorField) { setForgotErrorField(null); setForgotErrorMessage("") }
                                    }}
                                    placeholder={t("newPassword")}
                                    required
                                    autoComplete="new-password"
                                    className={`${inputBase} ${forgotErrorField === "new" ? inputErr : inputNormal}`}
                                />

                                {/* Requirements + vertical bridge */}
                                {forgotNewPassword.length > 0 && (
                                    <div className="mt-3 flex items-stretch gap-3 min-h-[2.5rem]">
                                        <div className="flex-1">
                                            <div className="grid grid-cols-1 gap-1.5 px-1 py-0.5">
                                                {passwordRules.map(rule => {
                                                    const met = rule.test(forgotNewPassword)
                                                    return (
                                                        <div key={rule.id} className="flex items-center gap-2">
                                                            <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${met ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                                : "bg-red-500/10 text-red-500 dark:text-red-400"
                                                            }`}>
                                                                {met ? (
                                                                    <CheckMiniIcon className="w-2.5 h-2.5" />
                                                                ) : (
                                                                    <CloseMiniIcon className="w-2.5 h-2.5" />
                                                                )}
                                                            </span>
                                                            <span className={`text-xs transition-colors ${met ? "text-emerald-600 dark:text-emerald-400"
                                                                : "text-wg-muted dark:text-wg-dark-muted"
                                                            }`}>{ruleLabel(rule.id)}</span>
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
                                                onClick={() => setForgotShowNewPassword(p => !p)}
                                                onMouseDown={(e) => e.preventDefault()}
                                                className="p-2 rounded-full text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text border border-wg-border dark:border-wg-dark-border hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50 bg-wg-surface dark:bg-wg-dark-surface transition-all my-1.5 flex-shrink-0"
                                                tabIndex={-1}
                                                aria-label={forgotShowNewPassword ? t("hidePasswords") : t("showPasswords")}
                                            >
                                                {forgotShowNewPassword ? (
                                                    <EyeSlashIcon className="w-4 h-4" />
                                                ) : (
                                                    <EyeIcon className="w-4 h-4" />
                                                )}
                                            </button>
                                            <div className="flex-1 w-px bg-wg-border dark:bg-wg-dark-border" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div className={forgotNewPassword.length > 0 ? "mt-2" : "mt-4"}>
                                <label htmlFor={`${fieldId}-reset-confirm`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">{t("confirmPasswordLabel")}</label>
                                <input
                                    id={`${fieldId}-reset-confirm`}
                                    type={forgotShowNewPassword ? "text" : "password"}
                                    value={forgotConfirmPassword}
                                    onChange={(e) => {
                                        setForgotConfirmPassword(e.target.value)
                                        if (forgotErrorField) { setForgotErrorField(null); setForgotErrorMessage("") }
                                    }}
                                    placeholder={t("confirmNewPassword")}
                                    required
                                    autoComplete="new-password"
                                    className={`${inputBase} ${forgotErrorField === "confirm" ? inputErr : inputNormal}`}
                                />
                            </div>

                            {/* Error banner */}
                            {forgotErrorMessage && (
                                <div className="mt-3 p-3 rounded-brand flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                                    <ExclamationTriangleReversedIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                                    <p className="text-sm text-red-700 dark:text-red-300">{forgotErrorMessage}</p>
                                </div>
                            )}

                            <div className="flex gap-3 justify-end mt-4">
                                <button type="button" onClick={closeForgotModal}
                                    className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-primary/40 dark:hover:border-wg-dark-primary/40 transition-colors">
                                    {t("cancel")}
                                </button>
                                <button type="submit"
                                    disabled={forgotStatus === "updating-password"}
                                    className="px-5 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100">
                                    {forgotStatus === "updating-password" ? t("saving") : t("savePassword")}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ── Step 4: Success ── */}
                    {forgotStatus === "password-updated" && (
                        <>
                            <div className="flex flex-col items-center text-center mb-5">
                                <div className="w-12 h-12 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/10 flex items-center justify-center mb-3">
                                    <CheckIcon
                                        className="w-6 h-6 text-wg-primary dark:text-wg-dark-primary"
                                        strokeWidth={2}
                                    />
                                </div>
                                <h3 className="text-base font-semibold text-wg-text dark:text-wg-dark-text mb-1">{t("passwordUpdatedTitle")}</h3>
                                <p className="text-sm text-wg-muted dark:text-wg-dark-muted">{t("passwordUpdatedDesc")}</p>
                            </div>
                            <div className="flex justify-end">
                                <button type="button" onClick={closeForgotModal}
                                    className="px-5 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card">
                                    {t("done")}
                                </button>
                            </div>
                        </>
                    )}

                </div>
            </div>
        )}
        </>
    )
}
