"use client"

import { useState, useCallback, useRef, useEffect, useLayoutEffect, useId } from "react"
import { useRouter } from "@/i18n/routing"
import { useTranslations, useLocale } from "next-intl"
import { passwordRules, USERNAME_REGEX, NAME_REGEX } from "@wildgrove/core/validation"
import { PhoneInput, parsePhone } from "@wildgrove/ui/PhoneInput"
import { createClient } from "@wildgrove/core/clients/client"
import {
    ArrowsRightLeftIcon,
    CheckCircleIcon,
    CheckIcon,
    CheckMiniIcon,
    ClockCircleIcon,
    CloseIcon,
    CloseMiniIcon,
    EnvelopeIcon,
    ExclamationTriangleIcon,
    ExclamationTriangleReversedIcon,
    EyeIcon,
    EyeSlashIcon,
    PencilShortSeamIcon,
    PhoneIcon,
    PlusIcon,
    Spinner,
    StarOutlineIcon,
    TrashIcon,
} from "@wildgrove/ui/icons"

type SectionStatus = "idle" | "loading" | "success" | "error"
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "too_short"

/** The default answer of a rate-limited route (see packages/core/rate-limit). */
const TOO_MANY_REQUESTS = "Too many requests. Please try again later."

/** Carries a message already in the page's language. */
class TranslatedError extends Error {}

/** The message of a TranslatedError; anything else, such as a network failure, shows the fallback. */
function shownError(err: unknown, fallback: string): string {
    return err instanceof TranslatedError ? err.message : fallback
}

interface AccountFormProps {
    initialFirstName: string
    initialLastName: string
    initialUsername: string
    initialEmail: string
    initialRecoveryEmails: string[]
    initialPhone?: string | null
    initialRecoveryPhones?: string[]
    highlightField?: "name" | "email" | "phone"
    hasPassword?: boolean
}

export function AccountForm({
    initialFirstName,
    initialLastName,
    initialUsername,
    initialEmail,
    initialRecoveryEmails,
    initialPhone,
    initialRecoveryPhones = [],
    highlightField,
    hasPassword: initialHasPassword = true,
}: AccountFormProps) {
    const router = useRouter()
    const t = useTranslations("accountForm")
    const fieldId = useId()
    const tc = useTranslations("common")
    const locale = useLocale()
    const [hasPassword, setHasPassword] = useState(initialHasPassword)

    // ── Profile section ──────────────────────────────────────────
    const [firstName, setFirstName] = useState(initialFirstName)
    const [lastName, setLastName] = useState(initialLastName)
    const [username, setUsername] = useState(initialUsername)
    const [profileStatus, setProfileStatus] = useState<SectionStatus>("idle")
    const [profileMessage, setProfileMessage] = useState("")
    const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle")
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Phone section ────────────────────────────────────────────
    const [phone, setPhone] = useState(initialPhone ?? "")
    const [phoneStatus, setPhoneStatus] = useState<SectionStatus>("idle")
    const [phoneMessage, setPhoneMessage] = useState("")
    const [isEditingPhone, setIsEditingPhone] = useState(false)
    const phoneFieldRef = useRef<HTMLDivElement>(null)

    // ── Recovery Phones (within the Phone card) ───────────────────
    const [recoveryPhones, setRecoveryPhones] = useState<string[]>(initialRecoveryPhones)
    const [newRecoveryPhone, setNewRecoveryPhone] = useState("")
    const [isAddingRecoveryPhone, setIsAddingRecoveryPhone] = useState(false)
    const [recoveryPhoneStatus, setRecoveryPhoneStatus] = useState<SectionStatus>("idle")
    const [recoveryPhoneMessage, setRecoveryPhoneMessage] = useState("")
    const [confirmingRemovePhone, setConfirmingRemovePhone] = useState<string | null>(null)
    const [removePhoneLoading, setRemovePhoneLoading] = useState(false)
    const [confirmingDeletePrimaryPhone, setConfirmingDeletePrimaryPhone] = useState(false)
    const [deletePrimaryPhoneLoading, setDeletePrimaryPhoneLoading] = useState(false)

    // ── Email section ────────────────────────────────────────────
    const [verifiedEmail, setVerifiedEmail] = useState(initialEmail)
    const [email, setEmail] = useState(initialEmail)
    const [emailStatus, setEmailStatus] = useState<SectionStatus>("idle")
    const [emailMessage, setEmailMessage] = useState("")
    const [isEditingEmail, setIsEditingEmail] = useState(false)
    // Primary email OTP (takes over the full card)
    const [pendingEmail, setPendingEmail] = useState<string | null>(null)
    const [otpCode, setOtpCode] = useState("")
    const [otpStatus, setOtpStatus] = useState<SectionStatus>("idle")
    const [otpMessage, setOtpMessage] = useState("")
    const [timeLeft, setTimeLeft] = useState(600)
    const [timerKey, setTimerKey] = useState(0)
    const verifiedEmailRef = useRef(verifiedEmail)

    // ── Recovery Emails (within the Email card) ──────────────────
    const [recoveryEmails, setRecoveryEmails] = useState<string[]>(initialRecoveryEmails)
    const [newRecoveryInput, setNewRecoveryInput] = useState("")
    const [isAddingRecovery, setIsAddingRecovery] = useState(false)
    const [recoveryStatus, setRecoveryStatus] = useState<SectionStatus>("idle")
    const [recoveryMessage, setRecoveryMessage] = useState("")
    // Recovery OTP (inline within email card)
    const [pendingRecoveryEmail, setPendingRecoveryEmail] = useState<string | null>(null)
    const [recoveryOtpCode, setRecoveryOtpCode] = useState("")
    const [recoveryOtpStatus, setRecoveryOtpStatus] = useState<SectionStatus>("idle")
    const [recoveryOtpMessage, setRecoveryOtpMessage] = useState("")
    const [recoveryTimeLeft, setRecoveryTimeLeft] = useState(600)
    const [recoveryTimerKey, setRecoveryTimerKey] = useState(0)
    // Confirmation before removal
    const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null)
    const [removeLoading, setRemoveLoading] = useState(false)
    // Make Primary swap flow
    const [confirmingMakePrimary, setConfirmingMakePrimary] = useState<string | null>(null)
    const [makePrimaryLoading, setMakePrimaryLoading] = useState(false)
    const [swapOldEmail, setSwapOldEmail] = useState<string | null>(null)
    // Resend cooldowns (seconds remaining)
    const [resendCooldown, setResendCooldown] = useState(0)
    const [recoveryResendCooldown, setRecoveryResendCooldown] = useState(0)
    const [recoveryOtpInvalidated, setRecoveryOtpInvalidated] = useState(false)

    // ── Highlight from external navigation ───────────────────────
    const [highlightActive, setHighlightActive] = useState<"name" | "email" | "phone" | null>(null)
    const nameFieldRef = useRef<HTMLInputElement>(null)
    const emailFieldRef = useRef<HTMLInputElement>(null)

    useLayoutEffect(() => {
        if (!highlightField) return
        if (highlightField === "name") {
            setIsEditingProfile(true)
            setHighlightActive("name")
            setTimeout(() => {
                nameFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                nameFieldRef.current?.focus()
            }, 150)
        } else if (highlightField === "email") {
            setIsEditingEmail(true)
            setHighlightActive("email")
            setTimeout(() => {
                emailFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                emailFieldRef.current?.focus()
            }, 150)
        } else if (highlightField === "phone") {
            setIsEditingPhone(true)
            setHighlightActive("phone")
            setTimeout(() => {
                phoneFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
            }, 150)
        }
        const timer = setTimeout(() => setHighlightActive(null), 3500)
        return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Activate password edit from external event ────────────────
    const newPasswordRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        function handleActivate() {
            setIsEditingPassword(true)
            setTimeout(() => {
                const section = document.getElementById("password-section")
                section?.scrollIntoView({ behavior: "smooth", block: "start" })
                newPasswordRef.current?.focus()
            }, 50)
        }
        window.addEventListener("wg:activate-password-edit", handleActivate)
        return () => window.removeEventListener("wg:activate-password-edit", handleActivate)
     
    }, [])

    // ── React to email unlink from ConnectedAccounts ──────────────
    useEffect(() => {
        function handleEmailUnlinked() {
            setHasPassword(false)
            cancelPassword()
            setIsEditingPassword(false)
        }
        window.addEventListener("wg:email-unlinked", handleEmailUnlinked)
        return () => window.removeEventListener("wg:email-unlinked", handleEmailUnlinked)
     
    }, [])

    // ── Password section ─────────────────────────────────────────
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [passwordStatus, setPasswordStatus] = useState<SectionStatus>("idle")
    const [passwordMessage, setPasswordMessage] = useState("")
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPasswords, setShowNewPasswords] = useState(false)
    const [forgotPasswordStatus, setForgotPasswordStatus] = useState<"idle" | "loading" | "sent" | "error">("idle")
    const [showForgotPasswordConfirm, setShowForgotPasswordConfirm] = useState(false)
    const [passwordTouched, setPasswordTouched] = useState(false)
    const [isEditingPassword, setIsEditingPassword] = useState(false)
    const [passwordSectionFocused, setPasswordSectionFocused] = useState(false)
    const passwordBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [resetOtp, setResetOtp] = useState("")
    const [resetOtpVerified, setResetOtpVerified] = useState(false)
    const [resetOtpStatus, setResetOtpStatus] = useState<SectionStatus>("idle")
    const [resetOtpMessage, setResetOtpMessage] = useState("")
    const [resetTimeLeft, setResetTimeLeft] = useState(600)
    const [passwordErrorField, setPasswordErrorField] = useState<"current" | "new" | "confirm" | null>(null)

    // ── Ref sync ─────────────────────────────────────────────────
    useEffect(() => { verifiedEmailRef.current = verifiedEmail }, [verifiedEmail])

    // Primary email OTP countdown
    useEffect(() => {
        if (!pendingEmail) return
        setTimeLeft(600)
        const id = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(id)
                    setPendingEmail(null)
                    setOtpCode("")
                    setOtpStatus("idle")
                    setOtpMessage("")
                    setEmail(verifiedEmailRef.current)
                    setEmailStatus("idle")
                    setEmailMessage("")
                    setIsEditingEmail(false)
                    setSwapOldEmail(null)
                    setResendCooldown(0)
                    return 0
                }
                return t - 1
            })
        }, 1000)
        return () => clearInterval(id)
     
    }, [pendingEmail, timerKey])

    // Recovery email OTP countdown
    useEffect(() => {
        if (!pendingRecoveryEmail) return
        setRecoveryTimeLeft(600)
        const id = setInterval(() => {
            setRecoveryTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(id)
                    setPendingRecoveryEmail(null)
                    setRecoveryOtpCode("")
                    setRecoveryOtpStatus("idle")
                    setRecoveryOtpMessage("")
                    setNewRecoveryInput("")
                    setIsAddingRecovery(false)
                    setRecoveryStatus("idle")
                    setRecoveryMessage("")
                    return 0
                }
                return t - 1
            })
        }, 1000)
        return () => clearInterval(id)
     
    }, [pendingRecoveryEmail, recoveryTimerKey])

    // Resend cooldown for primary email OTP
    useEffect(() => {
        if (resendCooldown <= 0) return
        const id = setInterval(() => {
            setResendCooldown(c => {
                if (c <= 1) { clearInterval(id); return 0 }
                return c - 1
            })
        }, 1000)
        return () => clearInterval(id)
    }, [resendCooldown])

    // Resend cooldown for recovery email OTP
    useEffect(() => {
        if (recoveryResendCooldown <= 0) return
        const id = setInterval(() => {
            setRecoveryResendCooldown(c => {
                if (c <= 1) { clearInterval(id); return 0 }
                return c - 1
            })
        }, 1000)
        return () => clearInterval(id)
    }, [recoveryResendCooldown])

    // Reset password OTP countdown
    useEffect(() => {
        if (forgotPasswordStatus !== "sent" || resetOtpVerified) return
        setResetTimeLeft(600)
        const id = setInterval(() => {
            setResetTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(id)
                    setForgotPasswordStatus("idle")
                    setResetOtp("")
                    setResetOtpStatus("idle")
                    setResetOtpMessage("")
                    return 0
                }
                return t - 1
            })
        }, 1000)
        return () => clearInterval(id)
     
    }, [forgotPasswordStatus, resetOtpVerified])

    // ── Shared CSS ────────────────────────────────────────────────
    const inputBase = "w-full px-4 py-3 rounded-brand border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 focus:outline-none focus:ring-2 transition disabled:opacity-50 disabled:cursor-default disabled:select-none"
    const inputNormal = "border-wg-border dark:border-wg-dark-border focus:ring-wg-accent dark:focus:ring-wg-dark-accent"
    const inputErr = "border-red-400 dark:border-red-500 focus:ring-red-400 dark:focus:ring-red-500"

    // ── Username check ───────────────────────────────────────────
    const checkUsername = useCallback((value: string) => {
        if (usernameTimer.current) clearTimeout(usernameTimer.current)
        if (value === initialUsername) { setUsernameStatus("idle"); return }
        if (value.length < 3) { setUsernameStatus(value.length > 0 ? "too_short" : "idle"); return }
        if (!USERNAME_REGEX.test(value)) { setUsernameStatus("too_short"); return }

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
    }, [initialUsername])

    // ── Cancel helpers ───────────────────────────────────────────
    function cancelProfile() {
        setFirstName(initialFirstName)
        setLastName(initialLastName)
        setUsername(initialUsername)
        setUsernameStatus("idle")
        setProfileStatus("idle")
        setProfileMessage("")
        setIsEditingProfile(false)
    }

    function cancelPhone() {
        setPhone(initialPhone ?? "")
        setPhoneStatus("idle")
        setPhoneMessage("")
        setIsEditingPhone(false)
        setConfirmingDeletePrimaryPhone(false)
    }

    function cancelEmail() {
        setEmail(verifiedEmail)
        setEmailStatus("idle")
        setEmailMessage("")
        setIsEditingEmail(false)
    }

    function cancelOtp() {
        setPendingEmail(null)
        setOtpCode("")
        setOtpStatus("idle")
        setOtpMessage("")
        setEmail(verifiedEmail)
        setEmailStatus("idle")
        setEmailMessage("")
        setIsEditingEmail(false)
        setSwapOldEmail(null)
        setResendCooldown(0)
    }

    function cancelAddRecovery() {
        setNewRecoveryInput("")
        setIsAddingRecovery(false)
        setRecoveryStatus("idle")
        setRecoveryMessage("")
    }

    function cancelRecoveryOtp() {
        setPendingRecoveryEmail(null)
        setRecoveryOtpCode("")
        setRecoveryOtpStatus("idle")
        setRecoveryOtpMessage("")
        setNewRecoveryInput("")
        setIsAddingRecovery(false)
        setRecoveryStatus("idle")
        setRecoveryMessage("")
        setRecoveryResendCooldown(0)
        setRecoveryOtpInvalidated(false)
    }

    function cancelPassword() {
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setPasswordTouched(false)
        setPasswordStatus("idle")
        setPasswordMessage("")
        setIsEditingPassword(false)
        setShowCurrentPassword(false)
        setShowNewPasswords(false)
        setPasswordSectionFocused(false)
        setForgotPasswordStatus("idle")
        setResetOtp("")
        setResetOtpVerified(false)
        setResetOtpStatus("idle")
        setResetOtpMessage("")
        setPasswordErrorField(null)
    }

    // ── Forgot password ───────────────────────────────────────────
    async function handleForgotPassword() {
        setForgotPasswordStatus("loading")
        try {
            const res = await fetch("/api/account/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-locale": locale },
                body: JSON.stringify({ email: initialEmail }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setForgotPasswordStatus("sent")
        } catch {
            setForgotPasswordStatus("error")
        }
    }

    // ── Verify reset OTP ─────────────────────────────────────────
    async function handleVerifyResetOtp() {
        setResetOtpStatus("loading")
        setResetOtpMessage("")
        try {
            const insforge = createClient()
            const { error } = await insforge.auth.verifyOtp({
                email: initialEmail,
                token: resetOtp,
                type: "recovery",
            })
            if (error) throw error
            setResetOtpVerified(true)
            setResetOtpStatus("idle")
        } catch {
            // The auth provider answers in English; any refusal of the code is shown the same way.
            setResetOtpStatus("error")
            setResetOtpMessage(t("resetCodeInvalid"))
        }
    }

    // ── Profile submit ───────────────────────────────────────────
    async function handleProfileSave(e: React.FormEvent) {
        e.preventDefault()
        setProfileStatus("loading")
        setProfileMessage("")

        if (!firstName.trim() || !lastName.trim()) {
            setProfileStatus("error")
            setProfileMessage(t("namesRequired"))
            return
        }
        if (!NAME_REGEX.test(firstName.trim()) || !NAME_REGEX.test(lastName.trim())) {
            setProfileStatus("error")
            setProfileMessage(t("namesInvalid"))
            return
        }
        if (username.length < 3 || !USERNAME_REGEX.test(username)) {
            setProfileStatus("error")
            setProfileMessage(t("usernameMinLength"))
            return
        }
        if (usernameStatus === "taken") {
            setProfileStatus("error")
            setProfileMessage(t("usernameTaken"))
            return
        }

        try {
            const res = await fetch("/api/account/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    username: username.trim().toLowerCase(),
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(profileError(data.error))
            setProfileStatus("success")
            setProfileMessage(t("profileUpdated"))
            setIsEditingProfile(false)
            router.refresh()
        } catch (err: unknown) {
            setProfileStatus("error")
            setProfileMessage(shownError(err, t("genericError")))
        }
    }

    // ── Phone submit — saves the number ──────────────────────────
    async function handlePhoneSave(e: React.FormEvent) {
        e.preventDefault()
        setPhoneStatus("loading")
        setPhoneMessage("")
        try {
            const res = await fetch("/api/account/phone", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(phoneError(data.error))

            setPhoneStatus("success")
            setPhoneMessage(t("phoneSaved"))
            setIsEditingPhone(false)
            router.refresh()
        } catch (err: unknown) {
            setPhoneStatus("error")
            setPhoneMessage(shownError(err, t("genericError")))
        }
    }

    // ── Recovery phone add ──────────────────────────────────────
    async function handleRecoveryPhoneAdd() {
        setRecoveryPhoneStatus("loading")
        setRecoveryPhoneMessage("")

        if (!newRecoveryPhone || !newRecoveryPhone.startsWith("+") || newRecoveryPhone.length < 8) {
            setRecoveryPhoneStatus("error")
            setRecoveryPhoneMessage(t("invalidPhone"))
            return
        }
        if (phone && newRecoveryPhone === phone) {
            setRecoveryPhoneStatus("error")
            setRecoveryPhoneMessage(t("recoveryPhoneSameAsPrimary"))
            return
        }

        try {
            const res = await fetch("/api/account/recovery-phone", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: newRecoveryPhone }),
            })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(recoveryPhoneError(data.error))

            setRecoveryPhones(data.recoveryPhones)
            setNewRecoveryPhone("")
            setIsAddingRecoveryPhone(false)
            setRecoveryPhoneStatus("success")
            setRecoveryPhoneMessage(t("recoveryPhoneAdded"))
            router.refresh()
        } catch (err: unknown) {
            setRecoveryPhoneStatus("error")
            setRecoveryPhoneMessage(shownError(err, t("genericError")))
        }
    }

    // ── Recovery phone remove ─────────────────────────────────────
    async function handleConfirmRemovePhone(phoneToRemove: string) {
        setRemovePhoneLoading(true)
        try {
            const res = await fetch("/api/account/recovery-phone", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phoneToRemove }),
            })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(recoveryPhoneError(data.error))
            setRecoveryPhones(data.recoveryPhones)
            setConfirmingRemovePhone(null)
            setRecoveryPhoneStatus("success")
            setRecoveryPhoneMessage(t("recoveryPhoneRemoved"))
            router.refresh()
        } catch (err: unknown) {
            setRecoveryPhoneStatus("error")
            setRecoveryPhoneMessage(shownError(err, t("genericError")))
        } finally {
            setRemovePhoneLoading(false)
        }
    }

    function cancelAddRecoveryPhone() {
        setNewRecoveryPhone("")
        setIsAddingRecoveryPhone(false)
        setRecoveryPhoneStatus("idle")
        setRecoveryPhoneMessage("")
    }

    // ── Primary phone delete ──────────────────────────────────────
    async function handleDeletePrimaryPhone() {
        setDeletePrimaryPhoneLoading(true)
        try {
            const res = await fetch("/api/account/phone", { method: "DELETE" })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(phoneError(data.error))
            setPhone("")
            setConfirmingDeletePrimaryPhone(false)
            setPhoneStatus("success")
            setPhoneMessage(t("primaryPhoneRemoved"))
            router.refresh()
        } catch (err: unknown) {
            setPhoneStatus("error")
            setPhoneMessage(shownError(err, t("genericError")))
            setConfirmingDeletePrimaryPhone(false)
        } finally {
            setDeletePrimaryPhoneLoading(false)
        }
    }

    // ── The /api/account routes answer in English; their known rejections
    // are translated by their text, anything else by the generic message. ──
    function emailChangeError(serverError: unknown): string {
        switch (serverError) {
            case TOO_MANY_REQUESTS: return t("tooManyRequests")
            case "Invalid email address.": return t("invalidEmail")
            case "This is already your current email.": return t("emailSameAsCurrent")
            case "This email is already in use.": return t("emailInUse")
            case 'This email is already a recovery email. Remove it first or use "Make Primary".': return t("emailInRecoveryError")
            case "Email notifications are disabled in admin settings.":
            case "Failed to send verification email. Please try again.": return t("emailSendFailed")
            default: return t("genericError")
        }
    }

    function profileError(serverError: unknown): string {
        switch (serverError) {
            case "Invalid first name. Only letters, spaces, hyphens, and apostrophes allowed.":
            case "Invalid last name. Only letters, spaces, hyphens, and apostrophes allowed.": return t("namesInvalid")
            case "Username must be at least 3 characters (letters, numbers, _, ., -).": return t("usernameMinLength")
            case "Username already taken.": return t("usernameTaken")
            case "Invalid phone number. Must be in E.164 format (e.g. +51987654321).": return t("invalidPhone")
            case "Phone number country code not supported.": return t("phoneCountryUnsupported")
            case "This phone number is already linked to another account.": return t("phoneInUse")
            default: return t("genericError")
        }
    }

    function phoneError(serverError: unknown): string {
        switch (serverError) {
            case "Invalid phone number.":
            case "Could not parse phone number.": return t("invalidPhone")
            case "This is already your current phone number.": return t("phoneSameAsCurrent")
            case 'This phone is already a recovery phone. Remove it first or use "Make Primary".': return t("phoneInRecoveryError")
            default: return t("genericError")
        }
    }

    function recoveryPhoneError(serverError: unknown): string {
        switch (serverError) {
            case "Invalid phone number.":
            case "Phone is required.": return t("invalidPhone")
            case "Recovery phone cannot be the same as your primary phone.": return t("recoveryPhoneSameAsPrimary")
            case "This phone is already a recovery phone.": return t("recoveryPhoneDuplicate")
            default: return t("genericError")
        }
    }

    function recoveryEmailError(serverError: unknown, fallback = t("genericError")): string {
        switch (serverError) {
            case TOO_MANY_REQUESTS: return t("tooManyRequests")
            case "Invalid email address.":
            case "Email is required.": return t("invalidEmail")
            case "Recovery email cannot be the same as your primary email.": return t("recoveryEmailSameAsPrimary")
            case "This email is already a recovery email.": return t("recoveryEmailDuplicate")
            case "Email notifications are disabled in admin settings.":
            case "Failed to send verification email. Please try again.": return t("emailSendFailed")
            default: return fallback
        }
    }

    function passwordError(serverError: unknown): string {
        switch (serverError) {
            case TOO_MANY_REQUESTS: return t("tooManyRequests")
            case "New password is required.":
            case "New password does not meet the minimum requirements.": return t("passwordRequirementsNotMet")
            case "Current password is incorrect.": return t("currentPasswordIncorrect")
            case "Current password is required.": return t("currentPasswordRequired")
            default: return t("genericError")
        }
    }

    // ── Email submit ─────────────────────────────────────────────
    async function handleEmailSave(e: React.FormEvent) {
        e.preventDefault()
        setEmailStatus("loading")
        setEmailMessage("")

        if (!email || !email.includes("@")) {
            setEmailStatus("error")
            setEmailMessage(t("invalidEmail"))
            return
        }
        if (email === initialEmail) {
            setEmailStatus("error")
            setEmailMessage(t("emailSameAsCurrent"))
            return
        }
        if (recoveryEmails.map(e => e.toLowerCase()).includes(email.toLowerCase())) {
            setEmailStatus("error")
            setEmailMessage(t("emailInRecoveryError"))
            return
        }

        try {
            const res = await fetch("/api/account/email", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "x-locale": locale },
                body: JSON.stringify({ email }),
            })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(emailChangeError(data.error))
            setPendingEmail(email)
            setEmailStatus("idle")
            setEmailMessage("")
            setIsEditingEmail(false)
            setResendCooldown(30)
        } catch (err: unknown) {
            setEmailStatus("error")
            setEmailMessage(shownError(err, t("genericError")))
        }
    }

    // ── Primary email OTP verify ─────────────────────────────────
    async function handleOtpVerify(e: React.FormEvent) {
        e.preventDefault()
        setOtpStatus("loading")
        setOtpMessage("")

        try {
            const body: Record<string, string> = { email: pendingEmail!, token: otpCode }
            // If swapping, add old primary email to recovery after verification
            if (swapOldEmail) body.addToRecovery = swapOldEmail

            const res = await fetch("/api/account/email/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok) {
                // Translated like the recovery email's code: attempts left,
                // too many attempts, or wrong/expired.
                throw new TranslatedError(data.invalidated
                    ? t("otpCodeInvalidated")
                    : typeof data.remaining === "number"
                        ? (data.remaining === 1 ? t("otpWrongCodeOne") : t("otpWrongCodeMany", { remaining: data.remaining }))
                        : data.error === "This email is already in use."
                            ? t("emailInUse")
                            : t("otpErrorGeneric"))
            }
            setVerifiedEmail(pendingEmail!)
            setEmail(pendingEmail!)
            setPendingEmail(null)
            setOtpCode("")
            setOtpStatus("idle")
            setOtpMessage("")
            setEmailStatus("success")
            setEmailMessage(t("emailUpdated"))
            // Sync recovery emails if swap returned them
            if (data.recoveryEmails) setRecoveryEmails(data.recoveryEmails)
            setSwapOldEmail(null)
            router.refresh()
        } catch (err: unknown) {
            setOtpStatus("error")
            setOtpMessage(shownError(err, t("otpErrorGeneric")))
        }
    }

    async function handleOtpResend() {
        setOtpStatus("loading")
        setOtpMessage("")
        setOtpCode("")
        try {
            const res = await fetch("/api/account/email", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "x-locale": locale },
                body: JSON.stringify({ email: pendingEmail, skipRecoveryCheck: true }),
            })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(emailChangeError(data.error))
            setOtpStatus("success")
            setOtpMessage(t("newCodeSentEmail"))
            setTimerKey(k => k + 1)
            setResendCooldown(30)
        } catch (err: unknown) {
            setOtpStatus("error")
            setOtpMessage(shownError(err, t("resendFailed")))
        }
    }

    // ── Recovery email add ───────────────────────────────────────
    async function handleRecoveryEmailSend() {
        setRecoveryStatus("loading")
        setRecoveryMessage("")

        if (!newRecoveryInput || !newRecoveryInput.includes("@")) {
            setRecoveryStatus("error")
            setRecoveryMessage(t("invalidEmail"))
            return
        }
        if (newRecoveryInput.toLowerCase() === initialEmail.toLowerCase()) {
            setRecoveryStatus("error")
            setRecoveryMessage(t("recoveryEmailSameAsPrimary"))
            return
        }

        try {
            const res = await fetch("/api/account/recovery-email", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "x-locale": locale },
                body: JSON.stringify({ email: newRecoveryInput }),
            })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(recoveryEmailError(data.error))
            setPendingRecoveryEmail(newRecoveryInput)
            setIsAddingRecovery(false)
            setRecoveryStatus("idle")
            setRecoveryMessage("")
            setRecoveryResendCooldown(30)
        } catch (err: unknown) {
            setRecoveryStatus("error")
            setRecoveryMessage(shownError(err, t("genericError")))
        }
    }

    // ── Recovery OTP verify ──────────────────────────────────────
    async function handleRecoveryOtpVerify() {
        setRecoveryOtpStatus("loading")
        setRecoveryOtpMessage("")

        try {
            const res = await fetch("/api/account/recovery-email/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: pendingRecoveryEmail, token: recoveryOtpCode }),
            })
            const data = await res.json()
            if (!res.ok) {
                if (data.invalidated) {
                    setRecoveryOtpInvalidated(true)
                    setRecoveryResendCooldown(0)
                    setRecoveryOtpCode("")
                }
                const msg = data.invalidated
                    ? t("otpCodeInvalidated")
                    : typeof data.remaining === "number"
                        ? (data.remaining === 1 ? t("otpWrongCodeOne") : t("otpWrongCodeMany", { remaining: data.remaining }))
                        : t("otpErrorGeneric")
                setRecoveryOtpStatus("error")
                setRecoveryOtpMessage(msg)
                return
            }
            setRecoveryOtpInvalidated(false)
            setRecoveryEmails(data.recoveryEmails)
            setPendingRecoveryEmail(null)
            setRecoveryOtpCode("")
            setRecoveryOtpStatus("idle")
            setRecoveryOtpMessage("")
            setNewRecoveryInput("")
            setRecoveryStatus("success")
            setRecoveryMessage(t("recoveryEmailAdded"))
            router.refresh()
        } catch {
            setRecoveryOtpStatus("error")
            setRecoveryOtpMessage(t("otpErrorGeneric"))
        }
    }

    async function handleRecoveryOtpResend() {
        setRecoveryOtpStatus("loading")
        setRecoveryOtpMessage("")
        setRecoveryOtpCode("")
        try {
            const res = await fetch("/api/account/recovery-email", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "x-locale": locale },
                body: JSON.stringify({ email: pendingRecoveryEmail }),
            })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(recoveryEmailError(data.error, t("resendFailed")))
            setRecoveryOtpInvalidated(false)
            setRecoveryOtpStatus("success")
            setRecoveryOtpMessage(t("newCodeSent"))
            setRecoveryTimerKey(k => k + 1)
            setRecoveryResendCooldown(30)
        } catch (err: unknown) {
            setRecoveryOtpStatus("error")
            setRecoveryOtpMessage(shownError(err, t("resendFailed")))
        }
    }

    // ── Recovery email remove ────────────────────────────────────
    async function handleConfirmRemove(emailToRemove: string) {
        setRemoveLoading(true)
        try {
            const res = await fetch("/api/account/recovery-email", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailToRemove }),
            })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(recoveryEmailError(data.error))
            setRecoveryEmails(data.recoveryEmails)
            setConfirmingRemove(null)
            setRecoveryStatus("success")
            setRecoveryMessage(t("recoveryEmailRemoved"))
            router.refresh()
        } catch (err: unknown) {
            setRecoveryStatus("error")
            setRecoveryMessage(shownError(err, t("genericError")))
        } finally {
            setRemoveLoading(false)
        }
    }

    // ── Make recovery email primary (swap) ──────────────────────
    async function handleMakePrimary(recoveryEmail: string) {
        setMakePrimaryLoading(true)
        try {
            // 1. Remove the recovery email from the list
            const delRes = await fetch("/api/account/recovery-email", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: recoveryEmail }),
            })
            const delData = await delRes.json()
            if (!delRes.ok) throw new TranslatedError(recoveryEmailError(delData.error))
            setRecoveryEmails(delData.recoveryEmails)

            // 2. Trigger email change (skip recovery check since we just removed it)
            const res = await fetch("/api/account/email", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "x-locale": locale },
                body: JSON.stringify({ email: recoveryEmail, skipRecoveryCheck: true }),
            })
            const data = await res.json()
            if (!res.ok) throw new TranslatedError(emailChangeError(data.error))

            // 3. Store old email so we add it to recovery after OTP verification
            setSwapOldEmail(verifiedEmail)
            setPendingEmail(recoveryEmail)
            setConfirmingMakePrimary(null)
            setIsEditingEmail(false)
            setEmailStatus("idle")
            setEmailMessage("")
            setResendCooldown(30)
        } catch (err: unknown) {
            setRecoveryStatus("error")
            setRecoveryMessage(shownError(err, t("genericError")))
            setConfirmingMakePrimary(null)
        } finally {
            setMakePrimaryLoading(false)
        }
    }

    // ── Password submit ──────────────────────────────────────────
    async function handlePasswordSave(e: React.FormEvent) {
        e.preventDefault()
        setPasswordStatus("loading")
        setPasswordMessage("")
        setPasswordErrorField(null)

        if (hasPassword && !resetOtpVerified && !currentPassword) {
            setPasswordStatus("error")
            setPasswordMessage(t("currentPasswordRequired"))
            setPasswordErrorField("current")
            return
        }
        const failing = passwordRules.filter(r => !r.test(newPassword))
        if (failing.length > 0) {
            setPasswordTouched(true)
            setPasswordStatus("error")
            setPasswordMessage(t("passwordRequirementsNotMet"))
            setPasswordErrorField("new")
            return
        }
        if (newPassword !== confirmPassword) {
            setPasswordStatus("error")
            setPasswordMessage(t("passwordsDoNotMatch"))
            setPasswordErrorField("confirm")
            return
        }

        // A refusal about the current password marks that field; anything else, the new one.
        let errorField: "current" | "new" = "new"
        try {
            if (resetOtpVerified) {
                // OTP recovery flow — session already verified, update directly
                const insforge = createClient()
                const { error } = await insforge.auth.updateUser({ password: newPassword })
                if (error) throw new TranslatedError(t("genericError"))
            } else {
                const res = await fetch("/api/account/password", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(hasPassword ? { currentPassword, newPassword } : { newPassword }),
                })
                const data = await res.json()
                if (!res.ok) {
                    if (data.error === "Current password is incorrect." || data.error === "Current password is required.") errorField = "current"
                    throw new TranslatedError(passwordError(data.error))
                }
            }
            setPasswordStatus("success")
            setPasswordMessage(t("passwordUpdated"))
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            setPasswordTouched(false)
            setIsEditingPassword(false)
            // Mark that the user now has a password — shows "Current Password" field
            // and updates section title/subtitle
            setHasPassword(true)
            // Refresh server component so ConnectedAccounts picks up the new metadata
            router.refresh()
        } catch (err: unknown) {
            setPasswordStatus("error")
            setPasswordMessage(shownError(err, t("genericError")))
            setPasswordErrorField(errorField)
        }
    }

    // ── Shared sub-components ─────────────────────────────────────
    function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
        return (
            <button
                type="button"
                onClick={onToggle}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                tabIndex={-1}
            >
                {show ? (
                    <EyeSlashIcon className="w-5 h-5" />
                ) : (
                    <EyeIcon className="w-5 h-5" />
                )}
            </button>
        )
    }

    function PencilIcon() {
        return (
            <PencilShortSeamIcon className="w-4 h-4" strokeWidth={1.75} />
        )
    }

    function SectionHeader({
        title,
        titleId,
        subtitle,
        isEditing,
        onEdit,
        onCancel,
        loading,
        submitLabel,
        loadingLabel,
    }: {
        title: string
        /** Lets a field without its own label be named by the section title. */
        titleId?: string
        subtitle: string
        isEditing: boolean
        onEdit: () => void
        onCancel: () => void
        loading: boolean
        submitLabel: string
        loadingLabel: string
    }) {
        return (
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h2 id={titleId} className="font-display text-xl font-bold text-wg-text dark:text-wg-dark-text">
                        {title}
                    </h2>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-0.5">
                        {subtitle}
                    </p>
                </div>

                {isEditing ? (
                    <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-primary/40 dark:hover:border-wg-dark-primary/40 transition-colors"
                        >
                            {t("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Spinner className="animate-spin h-3.5 w-3.5" />
                                    {loadingLabel}
                                </>
                            ) : submitLabel}
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onEdit}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-brand border border-wg-border/70 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-accent dark:hover:text-wg-dark-accent hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/40 hover:bg-wg-accent/5 dark:hover:bg-wg-dark-accent/5 transition-all flex-shrink-0"
                        aria-label={t("editSection", { section: title })}
                    >
                        <PencilIcon />
                        {t("edit")}
                    </button>
                )}
            </div>
        )
    }

    function StatusBanner({ status, message }: { status: SectionStatus; message: string }) {
        if ((status !== "success" && status !== "error") || !message) return null
        const isSuccess = status === "success"
        return (
            <div className={`p-3 rounded-brand flex items-start gap-3 ${
                isSuccess
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30"
            }`}>
                {isSuccess
                    ? <CheckCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    : <ExclamationTriangleReversedIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                }
                <p className={`text-sm ${
                    isSuccess ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                }`}>{message}</p>
            </div>
        )
    }

    // ── Countdown badge ───────────────────────────────────────────
    function CountdownBadge({ seconds }: { seconds: number }) {
        return (
            <div className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-brand text-sm font-mono font-semibold tabular-nums transition-colors ${
                seconds <= 60
                    ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/30"
                    : "bg-wg-bg dark:bg-wg-dark-raised text-wg-muted dark:text-wg-dark-muted border border-wg-border dark:border-wg-dark-border"
            }`}>
                <ClockCircleIcon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                {`${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* ═══════════════════════════════════════════════════════
                Profile + Phone — side by side on xl
            ═══════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* ── Section 1 — Profile ── */}
            <form onSubmit={handleProfileSave} className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <SectionHeader
                    title={t("profileTitle")}
                    subtitle={t("profileSubtitle")}
                    isEditing={isEditingProfile}
                    onEdit={() => setIsEditingProfile(true)}
                    onCancel={cancelProfile}
                    loading={profileStatus === "loading"}
                    submitLabel={t("saveProfile")}
                    loadingLabel={t("saving")}
                />

                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor={`${fieldId}-first-name`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">{t("firstNameLabel")}</label>
                            <input
                                id={`${fieldId}-first-name`}
                                ref={nameFieldRef}
                                type="text"
                                value={firstName}
                                disabled={!isEditingProfile}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^[\p{L}\s'-]/gu, '')
                                    setFirstName(val)
                                    if (profileStatus !== "idle") setProfileStatus("idle")
                                }}
                                placeholder={t("firstNamePlaceholder")}
                                required
                                autoComplete="given-name"
                                className={`${inputBase} ${inputNormal} ${highlightActive === "name" ? "ring-2 ring-wg-accent dark:ring-wg-dark-accent" : ""}`}
                            />
                        </div>
                        <div>
                            <label htmlFor={`${fieldId}-last-name`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">{t("lastNameLabel")}</label>
                            <input
                                id={`${fieldId}-last-name`}
                                type="text"
                                value={lastName}
                                disabled={!isEditingProfile}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^[\p{L}\s'-]/gu, '')
                                    setLastName(val)
                                    if (profileStatus !== "idle") setProfileStatus("idle")
                                }}
                                placeholder={t("lastNamePlaceholder")}
                                required
                                autoComplete="family-name"
                                className={`${inputBase} ${inputNormal}`}
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor={`${fieldId}-username`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">{t("usernameLabel")}</label>
                        <div className="relative">
                            <input
                                id={`${fieldId}-username`}
                                type="text"
                                value={username}
                                disabled={!isEditingProfile}
                                onChange={(e) => {
                                    const val = e.target.value.toLowerCase().replace(/\s/g, '')
                                    setUsername(val)
                                    if (profileStatus !== "idle") setProfileStatus("idle")
                                    checkUsername(val)
                                }}
                                placeholder={t("usernamePlaceholder")}
                                required
                                autoComplete="username"
                                className={`${inputBase} pr-10 ${usernameStatus === "taken" ? inputErr : inputNormal}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {usernameStatus === "checking" && (
                                    <Spinner className="animate-spin w-4 h-4 text-wg-muted" />
                                )}
                                {usernameStatus === "available" && (
                                    <CheckIcon className="w-4 h-4 text-emerald-500" strokeWidth={2} />
                                )}
                                {usernameStatus === "taken" && (
                                    <CloseIcon className="w-4 h-4 text-red-500" strokeWidth={2} />
                                )}
                            </div>
                        </div>
                        {usernameStatus === "taken" && (
                            <p className="text-xs text-red-500 mt-1">{t("usernameTaken")}</p>
                        )}
                        {usernameStatus === "too_short" && username.length > 0 && (
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">{t("usernameMinLength")}</p>
                        )}
                    </div>

                    <StatusBanner status={profileStatus} message={profileMessage} />
                </div>
            </form>

            {/* ═══════════════════════════════════════════════════════
                Section 1b — Phone Number
            ═══════════════════════════════════════════════════════ */}
            <form onSubmit={handlePhoneSave} className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <SectionHeader
                    title={t("phoneTitle")}
                    titleId={`${fieldId}-phone-title`}
                    subtitle={t("phoneSubtitle")}
                    isEditing={isEditingPhone}
                    onEdit={() => setIsEditingPhone(true)}
                    onCancel={cancelPhone}
                    loading={phoneStatus === "loading"}
                    submitLabel={t("savePhone")}
                    loadingLabel={t("saving")}
                />

                <div ref={phoneFieldRef}>
                    <div className="flex items-center gap-2">
                        <PhoneInput
                            value={phone}
                            labelledBy={`${fieldId}-phone-title`}
                            onChange={(v) => {
                                setPhone(v)
                                if (phoneStatus !== "idle") setPhoneStatus("idle")
                            }}
                            disabled={!isEditingPhone}
                            locale={locale}
                            searchPlaceholder={tc("phoneCountrySearch")}
                            noResultsLabel={tc("phoneCountryNoResults")}
                            countryCodeLabel={tc("selectCountryCode")}
                            className={`flex-1 ${highlightActive === "phone" ? "ring-2 ring-wg-accent dark:ring-wg-dark-accent rounded-brand" : ""}`}
                        />
                        {phone && !isEditingPhone && !confirmingDeletePrimaryPhone && (
                            <button
                                type="button"
                                onClick={() => setConfirmingDeletePrimaryPhone(true)}
                                title={t("remove")}
                                className="p-1.5 rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {!phone && !isEditingPhone && (
                        <p className="mt-2 text-sm text-wg-muted dark:text-wg-dark-muted italic">
                            {t("noPhoneYet")}
                        </p>
                    )}
                    {phone && !isEditingPhone && confirmingDeletePrimaryPhone && (
                        <div className="flex items-center gap-2 mt-3 px-3 py-2.5 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-red-500" />
                            <span className="text-xs text-red-700 dark:text-red-300 flex-1">{t("removePrimaryPhoneConfirm")}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDeletePrimaryPhone(false)}
                                    className="px-2.5 py-1 text-xs rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                                >
                                    {t("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeletePrimaryPhone}
                                    disabled={deletePrimaryPhoneLoading}
                                    className="px-2.5 py-1 text-xs font-medium rounded-brand bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60 flex items-center gap-1"
                                >
                                    {deletePrimaryPhoneLoading ? <><Spinner className="animate-spin h-3.5 w-3.5" />{t("removingAction")}</> : t("remove")}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <StatusBanner status={phoneStatus} message={phoneMessage} />

                {/* ── Recovery Phones divider ─────────────────────── */}
                <div className="border-t border-wg-border/50 dark:border-wg-dark-border pt-5 mt-5">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{t("recoveryPhones")}</p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                {t("recoveryPhonesSubtitle")}
                            </p>
                        </div>
                        {!isAddingRecoveryPhone && (
                            <button
                                type="button"
                                onClick={() => setIsAddingRecoveryPhone(true)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-brand border border-wg-border/70 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-accent dark:hover:text-wg-dark-accent hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/40 hover:bg-wg-accent/5 dark:hover:bg-wg-dark-accent/5 transition-all"
                            >
                                <PlusIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                {t("add")}
                            </button>
                        )}
                    </div>

                    {/* List of recovery phones */}
                    {recoveryPhones.length > 0 && (
                        <div className="space-y-2 mb-3">
                            {recoveryPhones.map(rp => (
                                <div key={rp}>
                                    {confirmingRemovePhone === rp ? (
                                        /* Confirmation row — remove */
                                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                                            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-red-500" />
                                            <span className="text-xs text-red-700 dark:text-red-300 flex-1 min-w-0 truncate">
                                                {t("remove")} <strong>{rp}</strong>?
                                            </span>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmingRemovePhone(null)}
                                                    className="px-2.5 py-1 text-xs rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                                                >
                                                    {t("cancel")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleConfirmRemovePhone(rp)}
                                                    disabled={removePhoneLoading}
                                                    className="px-2.5 py-1 text-xs font-medium rounded-brand bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60 flex items-center gap-1"
                                                >
                                                    {removePhoneLoading ? <><Spinner className="animate-spin h-3.5 w-3.5" />{t("removingAction")}</> : t("remove")}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Normal row */
                                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-brand border border-wg-border/60 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                                            <PhoneIcon className="w-4 h-4 flex-shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                                            <span className="text-sm text-wg-text/50 dark:text-wg-dark-text/50 flex-1 min-w-0 truncate">
                                                {(() => { const p = parsePhone(rp); return p ? `+${p.country.dialCode} ${p.localNumber}` : rp })()}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmingRemovePhone(rp)}
                                                title={t("remove")}
                                                className="p-1.5 rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {isAddingRecoveryPhone ? (
                        /* Add recovery phone form */
                        <div className="rounded-brand border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised p-4 space-y-3">
                            <p id={`${fieldId}-recovery-phone-title`} className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{t("addRecoveryPhone")}</p>
                            <PhoneInput
                                labelledBy={`${fieldId}-recovery-phone-title`}
                                value={newRecoveryPhone}
                                onChange={(v) => {
                                    setNewRecoveryPhone(v)
                                    if (recoveryPhoneStatus !== "idle") setRecoveryPhoneStatus("idle")
                                }}
                                locale={locale}
                                searchPlaceholder={tc("phoneCountrySearch")}
                                noResultsLabel={tc("phoneCountryNoResults")}
                                countryCodeLabel={tc("selectCountryCode")}
                                className="w-full"
                            />
                            <StatusBanner status={recoveryPhoneStatus} message={recoveryPhoneMessage} />
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={cancelAddRecoveryPhone}
                                    className="px-3.5 py-1.5 text-xs font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors">
                                    {t("cancel")}
                                </button>
                                <button type="button" onClick={handleRecoveryPhoneAdd} disabled={recoveryPhoneStatus === "loading"}
                                    className="px-4 py-1.5 text-xs font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-1.5">
                                    {recoveryPhoneStatus === "loading" ? <><Spinner className="animate-spin h-3.5 w-3.5" />{t("adding")}</> : t("addPhone")}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Empty state or status banner */
                        <>
                            {recoveryPhones.length === 0 && (
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted italic">{t("noRecoveryPhonesYet")}</p>
                            )}
                            <StatusBanner status={recoveryPhoneStatus} message={recoveryPhoneMessage} />
                        </>
                    )}
                </div>
            </form>
            </div>{/* /grid Profile+Phone */}

            {/* ═══════════════════════════════════════════════════════
                Section 2 — Email Address (+ Recovery Emails)
            ═══════════════════════════════════════════════════════ */}
            {pendingEmail ? (
                /* ── Primary email OTP — takes over full card ── */
                <div className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <h2 className="font-display text-xl font-bold text-wg-text dark:text-wg-dark-text">{t("verifyEmailTitle")}</h2>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                {t("codeSentTo")}{" "}
                                <span className="font-medium text-wg-text dark:text-wg-dark-text">{pendingEmail}</span>.
                            </p>
                        </div>
                        <CountdownBadge seconds={timeLeft} />
                    </div>

                    <form onSubmit={handleOtpVerify} className="space-y-5">
                        <div>
                            <label htmlFor={`${fieldId}-email-code`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">{t("verificationCode")}</label>
                            <input
                                id={`${fieldId}-email-code`}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => {
                                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                                    if (otpStatus !== "idle") setOtpStatus("idle")
                                }}
                                placeholder="123456"
                                autoComplete="one-time-code"
                                autoFocus
                                className={`${inputBase} text-center text-2xl font-mono tracking-[0.5em] ${inputNormal}`}
                            />
                        </div>
                        <StatusBanner status={otpStatus} message={otpMessage} />
                        <div className="flex items-center gap-3 flex-wrap">
                            <button type="button" onClick={cancelOtp}
                                className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-primary/40 dark:hover:border-wg-dark-primary/40 transition-colors">
                                {t("cancel")}
                            </button>
                            <button type="submit" disabled={otpCode.length !== 6 || otpStatus === "loading"}
                                className="px-5 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2">
                                {otpStatus === "loading" ? <><Spinner className="animate-spin h-3.5 w-3.5" />{t("verifying")}</> : t("verify")}
                            </button>
                            <button type="button" onClick={handleOtpResend} disabled={otpStatus === "loading" || resendCooldown > 0}
                                className="text-sm text-wg-accent dark:text-wg-dark-accent hover:underline disabled:opacity-50 disabled:no-underline transition-opacity">
                                {resendCooldown > 0 ? t("resendCooldown", { seconds: resendCooldown }) : t("resendCode")}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                /* ── Normal email card (primary + recovery emails) ── */
                <form onSubmit={handleEmailSave} className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                    <SectionHeader
                        title={t("emailTitle")}
                        subtitle={t("emailSubtitle")}
                        isEditing={isEditingEmail}
                        onEdit={() => setIsEditingEmail(true)}
                        onCancel={cancelEmail}
                        loading={emailStatus === "loading"}
                        submitLabel={t("updateEmail")}
                        loadingLabel={t("updating")}
                    />

                    <div className="space-y-5">
                        {/* Primary email */}
                        <div>
                            <label htmlFor={`${fieldId}-new-email`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">{t("emailLabel")}</label>
                            <input
                                id={`${fieldId}-new-email`}
                                ref={emailFieldRef}
                                type="email"
                                value={email}
                                disabled={!isEditingEmail}
                                onChange={(e) => {
                                    setEmail(e.target.value)
                                    if (emailStatus !== "idle") setEmailStatus("idle")
                                }}
                                placeholder="name@example.com"
                                required
                                autoComplete="email"
                                className={`${inputBase} ${inputNormal} ${highlightActive === "email" ? "ring-2 ring-wg-accent dark:ring-wg-dark-accent" : ""}`}
                            />
                        </div>

                        <StatusBanner status={emailStatus} message={emailMessage} />

                        {/* ── Recovery Emails divider ─────────────────────── */}
                        <div className="border-t border-wg-border/50 dark:border-wg-dark-border pt-5">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{t("recoveryEmails")}</p>
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                        {t("recoverySubtitle")}
                                    </p>
                                </div>
                                {!isAddingRecovery && !pendingRecoveryEmail && (
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingRecovery(true)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-brand border border-wg-border/70 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-accent dark:hover:text-wg-dark-accent hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/40 hover:bg-wg-accent/5 dark:hover:bg-wg-dark-accent/5 transition-all"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                        {t("add")}
                                    </button>
                                )}
                            </div>

                            {/* List of verified recovery emails */}
                            {recoveryEmails.length > 0 && (
                                <div className="space-y-2 mb-3">
                                    {recoveryEmails.map(re => (
                                        <div key={re}>
                                            {confirmingRemove === re ? (
                                                /* Confirmation row — remove */
                                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                                                    <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-red-500" />
                                                    <span className="text-xs text-red-700 dark:text-red-300 flex-1 min-w-0 truncate">
                                                        {t("remove")} <strong>{re}</strong>?
                                                    </span>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmingRemove(null)}
                                                            className="px-2.5 py-1 text-xs rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                                                        >
                                                            {t("cancel")}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleConfirmRemove(re)}
                                                            disabled={removeLoading}
                                                            className="px-2.5 py-1 text-xs font-medium rounded-brand bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60 flex items-center gap-1"
                                                        >
                                                            {removeLoading ? <><Spinner className="animate-spin h-3.5 w-3.5" />{t("removingAction")}</> : t("remove")}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : confirmingMakePrimary === re ? (
                                                /* Confirmation row — make primary */
                                                <div className="rounded-brand border border-wg-accent/40 dark:border-wg-dark-accent/40 bg-wg-accent/5 dark:bg-wg-dark-accent/5 p-3 space-y-2.5">
                                                    <div className="flex items-start gap-2">
                                                        <ArrowsRightLeftIcon className="w-4 h-4 flex-shrink-0 text-wg-accent dark:text-wg-dark-accent mt-0.5" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-wg-text dark:text-wg-dark-text">{t("makePrimaryTitle")}</p>
                                                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                                                {t("makePrimaryDescription", { newEmail: re, currentEmail: verifiedEmail })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 pl-6">
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmingMakePrimary(null)}
                                                            className="px-2.5 py-1 text-xs rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                                                        >
                                                            {t("cancel")}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMakePrimary(re)}
                                                            disabled={makePrimaryLoading}
                                                            className="px-2.5 py-1 text-xs font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-colors disabled:opacity-60 flex items-center gap-1"
                                                        >
                                                            {makePrimaryLoading ? <><Spinner className="animate-spin h-3.5 w-3.5" />{t("makingPrimary")}</> : t("makePrimaryConfirm")}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Normal row */
                                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-brand border border-wg-border/60 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                                                    <EnvelopeIcon className="w-4 h-4 flex-shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                                                    <span className="text-sm text-wg-text/50 dark:text-wg-dark-text/50 flex-1 min-w-0 truncate">{re}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setConfirmingMakePrimary(re); setConfirmingRemove(null) }}
                                                        title={t("makePrimary")}
                                                        className="p-1.5 rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-wg-accent dark:hover:text-wg-dark-accent hover:bg-wg-accent/5 dark:hover:bg-wg-dark-accent/10 transition-colors flex-shrink-0"
                                                    >
                                                        <StarOutlineIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setConfirmingRemove(re); setConfirmingMakePrimary(null) }}
                                                        title={t("remove")}
                                                        className="p-1.5 rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Recovery email OTP step */}
                            {pendingRecoveryEmail ? (
                                <div className="rounded-brand border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised p-4 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{t("verifyRecoveryTitle")}</p>
                                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                                {t("codeSentToRecovery")} <span className="font-medium text-wg-text dark:text-wg-dark-text">{pendingRecoveryEmail}</span>
                                            </p>
                                        </div>
                                        <CountdownBadge seconds={recoveryTimeLeft} />
                                    </div>

                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={6}
                                            value={recoveryOtpCode}
                                            onChange={(e) => {
                                                setRecoveryOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                                                if (recoveryOtpStatus !== "idle") setRecoveryOtpStatus("idle")
                                            }}
                                            placeholder="123456"
                                            autoComplete="one-time-code"
                                            autoFocus
                                            disabled={recoveryOtpInvalidated || recoveryOtpStatus === "loading"}
                                            className={`${inputBase} text-center text-2xl font-mono tracking-[0.5em] ${inputNormal}`}
                                        />
                                        <StatusBanner status={recoveryOtpStatus} message={recoveryOtpMessage} />
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button type="button" onClick={cancelRecoveryOtp}
                                                className="px-3.5 py-1.5 text-xs font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors">
                                                {t("cancel")}
                                            </button>
                                            {!recoveryOtpInvalidated && (
                                                <button type="button" onClick={handleRecoveryOtpVerify} disabled={recoveryOtpCode.length !== 6 || recoveryOtpStatus === "loading"}
                                                    className="px-4 py-1.5 text-xs font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-1.5">
                                                    {recoveryOtpStatus === "loading" ? <><Spinner className="animate-spin h-3.5 w-3.5" />{t("verifying")}</> : t("verify")}
                                                </button>
                                            )}
                                            {recoveryOtpInvalidated ? (
                                                <button type="button" onClick={handleRecoveryOtpResend} disabled={recoveryOtpStatus === "loading"}
                                                    className="px-4 py-1.5 text-xs font-medium rounded-brand bg-wg-primary hover:bg-wg-primary/90 dark:bg-wg-dark-primary dark:hover:bg-wg-dark-primary/90 text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5">
                                                    {recoveryOtpStatus === "loading" ? <><Spinner className="animate-spin h-3.5 w-3.5" />{t("resendCode")}</> : t("resendCode")}
                                                </button>
                                            ) : (
                                                <button type="button" onClick={handleRecoveryOtpResend} disabled={recoveryOtpStatus === "loading" || recoveryResendCooldown > 0}
                                                    className="text-xs text-wg-accent dark:text-wg-dark-accent hover:underline disabled:opacity-50 disabled:no-underline transition-opacity">
                                                    {recoveryResendCooldown > 0 ? t("resendCooldown", { seconds: recoveryResendCooldown }) : t("resendCode")}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : isAddingRecovery ? (
                                /* Add recovery email form */
                                <div className="rounded-brand border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised p-4 space-y-3">
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{t("addRecoveryEmail")}</p>
                                    <input
                                        type="email"
                                        value={newRecoveryInput}
                                        onChange={(e) => {
                                            setNewRecoveryInput(e.target.value)
                                            if (recoveryStatus !== "idle") setRecoveryStatus("idle")
                                        }}
                                        placeholder="alternate@example.com"
                                        autoComplete="email"
                                        autoFocus
                                        className={`${inputBase} ${inputNormal}`}
                                    />
                                    <StatusBanner status={recoveryStatus} message={recoveryMessage} />
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={cancelAddRecovery}
                                            className="px-3.5 py-1.5 text-xs font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors">
                                            {t("cancel")}
                                        </button>
                                        <button type="button" onClick={handleRecoveryEmailSend} disabled={recoveryStatus === "loading"}
                                            className="px-4 py-1.5 text-xs font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-1.5">
                                            {recoveryStatus === "loading" ? <><Spinner className="animate-spin h-3.5 w-3.5" />{t("sendingCode")}</> : t("sendCode")}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Empty state or status banner */
                                <>
                                    {recoveryEmails.length === 0 && (
                                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted italic">{t("noRecoveryYet")}</p>
                                    )}
                                    <StatusBanner status={recoveryStatus} message={recoveryMessage} />
                                </>
                            )}
                        </div>
                    </div>
                </form>
            )}

            {/* ═══════════════════════════════════════════════════════
                Section 3 — Password
            ═══════════════════════════════════════════════════════ */}
            <form id="password-section" onSubmit={handlePasswordSave} className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <>
                <SectionHeader
                    title={hasPassword ? t("passwordTitle") : t("setPasswordTitle")}
                    subtitle={hasPassword ? t("passwordSubtitleChange") : t("passwordSubtitleSet")}
                    isEditing={isEditingPassword}
                    onEdit={() => setIsEditingPassword(true)}
                    onCancel={cancelPassword}
                    loading={passwordStatus === "loading"}
                    submitLabel={hasPassword ? t("changePassword") : t("setPassword")}
                    loadingLabel={hasPassword ? t("changingPassword") : t("settingPassword")}
                />

                <div className="space-y-5">
                    {hasPassword && (
                        forgotPasswordStatus === "sent" && !resetOtpVerified ? (
                            /* ── OTP verification input ── */
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <label htmlFor={`${fieldId}-reset-code`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text">{t("resetCodeLabel")}</label>
                                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                            {recoveryEmails.length > 0 ? t("resetSentWithRecovery", { email: initialEmail }) : t("resetSent", { email: initialEmail })}
                                        </p>
                                    </div>
                                    <CountdownBadge seconds={resetTimeLeft} />
                                </div>
                                <input
                                    id={`${fieldId}-reset-code`}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    value={resetOtp}
                                    onChange={(e) => {
                                        setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                                        if (resetOtpStatus !== "idle") setResetOtpStatus("idle")
                                    }}
                                    placeholder="123456"
                                    autoComplete="one-time-code"
                                    autoFocus
                                    className={`${inputBase} text-center text-2xl font-mono tracking-[0.5em] ${inputNormal}`}
                                />
                                <StatusBanner status={resetOtpStatus} message={resetOtpMessage} />
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForgotPasswordStatus("idle")
                                            setResetOtp("")
                                            setResetOtpStatus("idle")
                                            setResetOtpMessage("")
                                        }}
                                        className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-primary/40 dark:hover:border-wg-dark-primary/40 transition-colors"
                                    >
                                        {t("cancel")}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={resetOtp.length !== 6 || resetOtpStatus === "loading"}
                                        onClick={handleVerifyResetOtp}
                                        className="px-5 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
                                    >
                                        {resetOtpStatus === "loading" ? <><Spinner className="animate-spin h-3.5 w-3.5" />{t("verifying")}</> : t("verify")}
                                    </button>
                                </div>
                            </div>
                        ) : resetOtpVerified ? (
                            /* ── Verified badge ── */
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-brand bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30">
                                <CheckCircleIcon
                                    className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0"
                                    strokeWidth={2}
                                />
                                <span className="text-sm text-emerald-700 dark:text-emerald-300">{t("resetCodeVerified")}</span>
                            </div>
                        ) : (
                            /* ── Normal current password field ── */
                            <div>
                                <label htmlFor={`${fieldId}-current-password`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">{t("currentPasswordLabel")}</label>
                                <div className="relative">
                                    <input
                                        id={`${fieldId}-current-password`}
                                        type={showCurrentPassword ? "text" : "password"}
                                        value={currentPassword}
                                        disabled={!isEditingPassword}
                                        onChange={(e) => {
                                            setCurrentPassword(e.target.value)
                                            if (passwordStatus !== "idle") setPasswordStatus("idle")
                                            if (passwordErrorField) setPasswordErrorField(null)
                                        }}
                                        placeholder={isEditingPassword ? t("currentPasswordPlaceholder") : "••••••••"}
                                        required
                                        autoComplete="current-password"
                                        className={`${inputBase} pr-12 ${passwordErrorField === "current" ? inputErr : inputNormal}`}
                                    />
                                    {isEditingPassword && (
                                        <EyeToggle show={showCurrentPassword} onToggle={() => setShowCurrentPassword(!showCurrentPassword)} />
                                    )}
                                </div>
                                {isEditingPassword && (
                                    <div className="flex justify-end mt-1.5">
                                        {forgotPasswordStatus === "error" ? (
                                            <p className="text-xs text-red-500 dark:text-red-400">{t("resetFailed")}</p>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setShowForgotPasswordConfirm(true)}
                                                disabled={forgotPasswordStatus === "loading"}
                                                className="text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors disabled:opacity-50"
                                            >
                                                {forgotPasswordStatus === "loading" ? t("sendingReset") : t("forgotPassword")}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    )}

                    <div>
                        <label htmlFor={`${fieldId}-new-password`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">{t("newPasswordLabel")}</label>
                        <div className="relative">
                            <input
                                id={`${fieldId}-new-password`}
                                ref={newPasswordRef}
                                type={showNewPasswords ? "text" : "password"}
                                value={newPassword}
                                disabled={!isEditingPassword}
                                onChange={(e) => {
                                    setNewPassword(e.target.value)
                                    if (passwordStatus !== "idle") setPasswordStatus("idle")
                                    if (passwordErrorField) setPasswordErrorField(null)
                                }}
                                onFocus={() => {
                                    if (passwordBlurTimer.current) clearTimeout(passwordBlurTimer.current)
                                    setPasswordSectionFocused(true)
                                    setPasswordTouched(true)
                                }}
                                onBlur={() => {
                                    passwordBlurTimer.current = setTimeout(() => setPasswordSectionFocused(false), 150)
                                }}
                                placeholder={isEditingPassword ? t("newPasswordPlaceholder") : "••••••••"}
                                required
                                autoComplete="new-password"
                                className={`${inputBase} ${passwordErrorField === "new" ? inputErr : inputNormal}`}
                            />
                        </div>

                        {/* Bridge + rules — when editing and (focused OR has content typed) */}
                        {isEditingPassword && (passwordSectionFocused || newPassword.length > 0) && (
                            <div className="mt-3 flex items-stretch gap-3 min-h-[2.5rem]">
                                <div className="flex-1">
                                    {passwordTouched && (
                                        <div className="grid grid-cols-1 gap-1.5 px-1 py-0.5">
                                            {passwordRules.map(rule => {
                                                const met = rule.test(newPassword)
                                                return (
                                                    <div key={rule.id} className="flex items-center gap-2">
                                                        <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                                                            met ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
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
                                                        }`}>{t(({ length: "ruleLength", lowercase: "ruleLowercase", uppercase: "ruleUppercase", digit: "ruleDigit", symbol: "ruleSymbol" } as Record<string, Parameters<typeof t>[0]>)[rule.id])}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                                {/* Vertical bridge: -mt-3 reaches new-password input, -mb-9 reaches confirm input */}
                                <div className="flex flex-col items-center w-8 flex-shrink-0 -mt-3 -mb-9">
                                    <div className="flex-1 w-px bg-wg-border dark:bg-wg-dark-border" />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPasswords(!showNewPasswords)}
                                        onMouseDown={(e) => e.preventDefault()}
                                        className="p-2 rounded-full text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text border border-wg-border dark:border-wg-dark-border hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50 bg-wg-surface dark:bg-wg-dark-surface transition-all my-1.5 flex-shrink-0"
                                        tabIndex={-1}
                                        aria-label={showNewPasswords ? t("hidePasswords") : t("showPasswords")}
                                    >
                                        {showNewPasswords ? (
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

                    <div>
                        <label htmlFor={`${fieldId}-confirm-password`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">{t("confirmPasswordLabel")}</label>
                        <div className="relative">
                            <input
                                id={`${fieldId}-confirm-password`}
                                type={showNewPasswords ? "text" : "password"}
                                value={confirmPassword}
                                disabled={!isEditingPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value)
                                    if (passwordStatus !== "idle") setPasswordStatus("idle")
                                    if (passwordErrorField) setPasswordErrorField(null)
                                }}
                                onFocus={() => {
                                    if (passwordBlurTimer.current) clearTimeout(passwordBlurTimer.current)
                                    setPasswordSectionFocused(true)
                                }}
                                onBlur={() => {
                                    passwordBlurTimer.current = setTimeout(() => setPasswordSectionFocused(false), 150)
                                }}
                                placeholder={isEditingPassword ? t("confirmPasswordPlaceholder") : "••••••••"}
                                required
                                autoComplete="new-password"
                                className={`${inputBase} ${passwordErrorField === "confirm" ? inputErr : inputNormal}`}
                            />
                        </div>
                    </div>

                    <StatusBanner status={passwordStatus} message={passwordMessage} />
                </div>
                </>
            </form>

            {/* Forgot password confirmation dialog */}
            {showForgotPasswordConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border rounded-card shadow-card p-6 max-w-sm w-full mx-4">
                        <h3 className="text-base font-semibold text-wg-text dark:text-wg-dark-text mb-2">
                            {t("forgotPasswordTitle")}
                        </h3>
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-6">
                            {t("forgotPasswordDescription", { email: initialEmail })}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowForgotPasswordConfirm(false)}
                                className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-primary/40 dark:hover:border-wg-dark-primary/40 transition-colors"
                            >
                                {t("cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForgotPasswordConfirm(false)
                                    handleForgotPassword()
                                }}
                                className="px-5 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card"
                            >
                                {t("sendResetLink")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
