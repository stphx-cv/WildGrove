"use client"

import { useState, useEffect, useRef, useCallback, useId } from "react"
import { useTranslations } from "next-intl"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { NAME_REGEX, USERNAME_REGEX } from "@wildgrove/core/validation"
import { CheckCompactIcon, CloseIcon, GoogleLogo, Spinner } from "@wildgrove/ui/icons"

interface CompleteProfileFormProps {
    firstName: string
    lastName: string
    email: string
    avatarUrl: string | null
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "too_short"

function generateBaseUsername(firstName: string, lastName: string, email: string): string {
    if (firstName || lastName) {
        const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9._-]/g, "")
        if (base.length >= 3) return base
    }
    const emailUser = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "")
    return emailUser
}

export function CompleteProfileForm({ firstName: initFirst, lastName: initLast, email, avatarUrl }: CompleteProfileFormProps) {
    const t = useTranslations("completeProfile")
    const fieldId = useId()
    const [firstName, setFirstName] = useState(initFirst)
    const [lastName, setLastName] = useState(initLast)
    const [username, setUsername] = useState("")
    const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle")
    const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error">("idle")
    const [errorMessage, setErrorMessage] = useState("")
    const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const didInit = useRef(false)

    // Check availability and auto-resolve a free username on mount
    useEffect(() => {
        if (didInit.current) return
        didInit.current = true

        const base = generateBaseUsername(initFirst, initLast, email)
        if (base.length < 3) return

        const resolve = async () => {
            setUsername(base)
            setUsernameStatus("checking")

            // Try base first
            const r1 = await fetch(`/api/auth/check-username?username=${encodeURIComponent(base)}`)
            const d1 = await r1.json()
            if (d1.available) {
                setUsername(base)
                setUsernameStatus("available")
                return
            }

            // Try with a random 2-digit suffix
            const suffix = Math.floor(Math.random() * 90 + 10)
            const alt = `${base}${suffix}`
            const r2 = await fetch(`/api/auth/check-username?username=${encodeURIComponent(alt)}`)
            const d2 = await r2.json()
            setUsername(alt)
            setUsernameStatus(d2.available ? "available" : "taken")
        }

        void resolve()
    }, [initFirst, initLast, email])

    const checkUsername = useCallback(async (value: string) => {
        if (value.length < 3) { setUsernameStatus("too_short"); return }
        if (!USERNAME_REGEX.test(value)) { setUsernameStatus("idle"); return }
        setUsernameStatus("checking")
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`)
        const data = await res.json()
        setUsernameStatus(data.available ? "available" : "taken")
    }, [])

    const handleUsernameChange = (value: string) => {
        const clean = value.toLowerCase().replace(/[^a-z0-9._-]/g, "")
        setUsername(clean)
        if (usernameTimer.current) clearTimeout(usernameTimer.current)
        if (clean.length < 3) { setUsernameStatus("too_short"); return }
        setUsernameStatus("checking")
        usernameTimer.current = setTimeout(() => checkUsername(clean), 600)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!NAME_REGEX.test(firstName.trim())) {
            setErrorMessage(t("errorFirstName")); setSubmitStatus("error"); return
        }
        if (!NAME_REGEX.test(lastName.trim())) {
            setErrorMessage(t("errorLastName")); setSubmitStatus("error"); return
        }
        if (usernameStatus !== "available") {
            setErrorMessage(t("errorUsername")); setSubmitStatus("error"); return
        }

        setSubmitStatus("loading")
        setErrorMessage("")

        const res = await fetch("/api/account/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                username: username.trim().toLowerCase(),
            }),
        })

        if (res.ok) {
            // Full reload, as after sign in: the header and the cart read the session
            // again, and a soft navigation from this page does not start.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose, see above
            window.location.href = "/"
        } else {
            const data = await res.json()
            setErrorMessage(data.error ?? t("errorGeneric"))
            setSubmitStatus("error")
        }
    }

    const inputBase =
        "w-full px-3.5 py-2.5 text-sm rounded-brand border bg-wg-bg dark:bg-wg-dark-bg text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 outline-none transition-colors"
    const inputNormal =
        "border-wg-border dark:border-wg-dark-border focus:border-wg-primary dark:focus:border-wg-dark-primary"

    const usernameHint =
        usernameStatus === "available" ? t("usernameAvailable") :
        usernameStatus === "taken" ? t("usernameTaken") :
        usernameStatus === "too_short" ? t("usernameTooShort") :
        usernameStatus === "checking" ? t("usernameChecking") :
        t("usernameHint")

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Google avatar */}
            {avatarUrl && (
                <div className="flex justify-center mb-1">
                    <FadeInImage
                        src={avatarUrl}
                        alt={t("altGooglePhoto")}
                        width={72}
                        height={72}
                        className="rounded-full border-2 border-wg-border dark:border-wg-dark-border"
                    />
                </div>
            )}

            {/* Email — read-only, linked to Google */}
            <div>
                <label htmlFor={`${fieldId}-email`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                    {t("emailLabel")}{" "}
                    <span className="text-xs font-normal text-wg-muted dark:text-wg-dark-muted ml-1">
                        {t("emailLinkedNote")}
                    </span>
                </label>
                <div className="relative">
                    <input
                        id={`${fieldId}-email`}
                        type="email"
                        value={email}
                        disabled
                        className={`${inputBase} border-wg-border/50 dark:border-wg-dark-border/50 opacity-60 cursor-not-allowed pr-10`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <GoogleLogo width="16" height="16" />
                    </span>
                </div>
            </div>

            {/* First + Last name */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor={`${fieldId}-first-name`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                        {t("firstNameLabel")}
                    </label>
                    <input
                        id={`${fieldId}-first-name`}
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value.replace(/[^[\p{L}\s'-]/gu, ""))}
                        placeholder={t("firstNamePlaceholder")}
                        required
                        autoComplete="given-name"
                        className={`${inputBase} ${inputNormal}`}
                    />
                </div>
                <div>
                    <label htmlFor={`${fieldId}-last-name`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                        {t("lastNameLabel")}
                    </label>
                    <input
                        id={`${fieldId}-last-name`}
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value.replace(/[^[\p{L}\s'-]/gu, ""))}
                        placeholder={t("lastNamePlaceholder")}
                        required
                        autoComplete="family-name"
                        className={`${inputBase} ${inputNormal}`}
                    />
                </div>
            </div>

            {/* Username */}
            <div>
                <label htmlFor={`${fieldId}-username`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                    {t("usernameLabel")}
                </label>
                <div className="relative">
                    <input
                        id={`${fieldId}-username`}
                        type="text"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder={t("usernamePlaceholder")}
                        required
                        autoComplete="username"
                        className={`${inputBase} pr-9 ${
                            usernameStatus === "available"
                                ? "border-emerald-400 dark:border-emerald-600 focus:border-emerald-500"
                                : usernameStatus === "taken"
                                ? "border-red-400 dark:border-red-600 focus:border-red-500"
                                : inputNormal
                        }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {usernameStatus === "checking" && (
                            <Spinner className="animate-spin w-4 h-4 text-wg-muted dark:text-wg-dark-muted" />
                        )}
                        {usernameStatus === "available" && (
                            <CheckCompactIcon className="w-4 h-4 text-emerald-500" strokeWidth={2.5} />
                        )}
                        {usernameStatus === "taken" && (
                            <CloseIcon className="w-4 h-4 text-red-500" strokeWidth={2.5} />
                        )}
                    </span>
                </div>
                <p className={`mt-1.5 text-xs transition-colors ${
                    usernameStatus === "available" ? "text-emerald-600 dark:text-emerald-400" :
                    usernameStatus === "taken" ? "text-red-500 dark:text-red-400" :
                    "text-wg-muted dark:text-wg-dark-muted"
                }`}>
                    {usernameHint}
                </p>
            </div>

            {/* Error banner */}
            {submitStatus === "error" && errorMessage && (
                <div className="p-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                    <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
                </div>
            )}

            {/* Submit */}
            <button
                type="submit"
                disabled={
                    submitStatus === "loading" ||
                    usernameStatus === "taken" ||
                    usernameStatus === "checking" ||
                    usernameStatus === "too_short"
                }
                className="w-full px-7 py-3.5 text-base font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
                {submitStatus === "loading" ? (
                    <>
                        <Spinner className="animate-spin h-5 w-5" />
                        {t("saving")}
                    </>
                ) : t("completeSetup")}
            </button>
        </form>
    )
}
