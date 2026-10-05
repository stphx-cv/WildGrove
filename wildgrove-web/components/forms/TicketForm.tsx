"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "@/i18n/routing"
import { useTranslations, useLocale } from "next-intl"
import type { UserProfile } from "@wildgrove/core/types"
import { PhoneInput } from "@wildgrove/ui/PhoneInput"
import { Textarea } from "@wildgrove/ui/Textarea"
import {
    ArrowUpTrayIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    CloseIcon,
    DocumentIcon,
    LockClosedIcon,
    PencilSquareIcon,
    Spinner,
} from "@wildgrove/ui/icons"

type FormStatus = "idle" | "loading" | "success" | "error"

interface FormData {
    name: string
    email: string
    phone: string
    category: string
    priority: string
    subject: string
    message: string
}

interface TicketFormProps {
    user?: UserProfile | null
    onTicketCreated?: () => void
}

const CATEGORIES = [
    "GENERAL_INQUIRY",
    "RESERVATIONS",
    "COMPLAINTS_SUGGESTIONS",
    "BILLING",
    "OTHER",
] as const

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const

// ── CustomSelect ────────────────────────────────────────────────
interface CustomSelectOption {
    value: string
    label: string
}

interface CustomSelectProps {
    id: string
    value: string
    onChange: (value: string) => void
    options: CustomSelectOption[]
    placeholder?: string
    required?: boolean
}

function CustomSelect({ id, value, onChange, options, placeholder, required }: CustomSelectProps) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [open])

    const selected = options.find((o) => o.value === value)

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                id={id}
                onClick={() => setOpen((v) => !v)}
                className={`w-full px-4 py-3 rounded-brand border text-left flex items-center justify-between gap-3 transition bg-wg-bg dark:bg-wg-dark-raised ${
                    open
                        ? "border-wg-accent dark:border-wg-dark-accent ring-2 ring-wg-accent/20 dark:ring-wg-dark-accent/20"
                        : "border-wg-border dark:border-wg-dark-border hover:border-wg-muted dark:hover:border-wg-dark-muted"
                }`}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className={`text-sm truncate ${!selected ? "text-wg-muted/60 dark:text-wg-dark-muted/60" : "text-wg-text dark:text-wg-dark-text"}`}>
                    {selected ? selected.label : (placeholder ?? "")}
                </span>
                <ChevronDownIcon className={`w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div
                    role="listbox"
                    className="absolute top-full mt-1.5 left-0 z-50 w-full rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated py-1"
                >
                    {placeholder && (
                        <div className="px-4 py-2.5 text-sm text-wg-muted/60 dark:text-wg-dark-muted/60 cursor-default select-none">
                            {placeholder}
                        </div>
                    )}
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={value === opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            className={`w-full px-4 py-2.5 text-sm text-left transition-colors ${
                                value === opt.value
                                    ? "bg-wg-accent/10 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent font-medium"
                                    : "text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-bg"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}

            {required && (
                <input
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{ opacity: 0, position: "absolute", height: 0, width: 0, pointerEvents: "none" }}
                    value={value}
                    required
                    onChange={() => {}}
                />
            )}
        </div>
    )
}

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = new Set([
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf", "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

export function TicketForm({ user, onTicketCreated }: TicketFormProps) {
    const router = useRouter()
    const t = useTranslations("ticketForm")
    const tc = useTranslations("common")
    const locale = useLocale()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [editPopover, setEditPopover] = useState<"name" | "email" | "phone" | null>(null)
    const [form, setForm] = useState<FormData>({
        name: user?.name ?? "",
        email: user?.email ?? "",
        phone: user?.phone ?? "",
        category: "",
        priority: "MEDIUM",
        subject: "",
        message: "",
    })
    const [files, setFiles] = useState<File[]>([])
    const [status, setStatus] = useState<FormStatus>("idle")
    const [errorMessage, setErrorMessage] = useState("")
    const [ticketResult, setTicketResult] = useState<{
        ticketId: string
        formattedNumber: string
    } | null>(null)

    function handleChange(
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function handleFiles(newFiles: FileList | File[]) {
        const fileArray = Array.from(newFiles)
        const valid: File[] = []

        for (const f of fileArray) {
            if (!ALLOWED_TYPES.has(f.type)) continue
            if (f.size > MAX_FILE_SIZE) continue
            valid.push(f)
        }

        setFiles((prev) => {
            const combined = [...prev, ...valid]
            return combined.slice(0, MAX_FILES)
        })
    }

    function removeFile(index: number) {
        setFiles((prev) => prev.filter((_, i) => i !== index))
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault()
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setStatus("loading")
        setErrorMessage("")

        if (!form.category || !form.subject.trim() || !form.message.trim()) {
            setStatus("error")
            setErrorMessage(t("errorRequired"))
            return
        }
        if (form.message.trim().length < 10) {
            setStatus("error")
            setErrorMessage(t("errorMinLength"))
            return
        }

        try {
            const formData = new FormData()
            formData.append("category", form.category)
            formData.append("subject", form.subject.trim())
            formData.append("message", form.message.trim())
            formData.append("priority", form.priority)
            for (const file of files) {
                formData.append("files", file)
            }

            const res = await fetch("/api/tickets", {
                method: "POST",
                headers: { "x-locale": locale },
                body: formData,
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(t("errorGeneric"))
            }

            setTicketResult({
                ticketId: data.data.ticketId,
                formattedNumber: data.data.formattedNumber,
            })
            setStatus("success")
            onTicketCreated?.()
        } catch (err: unknown) {
            setStatus("error")
            const message = err instanceof Error ? err.message : t("errorGeneric")
            setErrorMessage(message)
        }
    }

    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    // ── Success State ───────────────────────────────────────────
    if (status === "success" && ticketResult) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/15 flex items-center justify-center">
                    <CheckCircleIcon className="w-8 h-8 text-wg-primary dark:text-wg-dark-primary" />
                </div>
                <h3 className="font-display text-xl font-bold text-wg-text dark:text-wg-dark-text mb-2">
                    {t("successTitle")}
                </h3>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed max-w-sm mx-auto mb-2">
                    {t("successDescription")}
                </p>
                <p className="text-base font-semibold text-wg-primary dark:text-wg-dark-primary mb-6">
                    {t("successTicketNumber")}{" "}
                    <span className="font-mono">{ticketResult.formattedNumber}</span>
                </p>
                <div className="flex flex-col items-center gap-3">
                    <button
                        onClick={() => router.push(`/contact/tickets/${ticketResult.ticketId}`)}
                        className="text-sm font-medium px-5 py-2.5 rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition"
                    >
                        {t("viewTicket")}
                    </button>
                    <button
                        onClick={() => {
                            setStatus("idle")
                            setTicketResult(null)
                            setFiles([])
                            setForm({
                                name: user?.name ?? "",
                                email: user?.email ?? "",
                                phone: user?.phone ?? "",
                                category: "",
                                priority: "MEDIUM",
                                subject: "",
                                message: "",
                            })
                        }}
                        className="text-sm text-wg-accent dark:text-wg-dark-accent hover:underline transition-colors"
                    >
                        {t("submitAnother")}
                    </button>
                </div>
            </div>
        )
    }

    // ── Category/Priority labels ─────────────────────────────────
    const categoryKeys: Record<string, string> = {
        GENERAL_INQUIRY: "categoryGeneral",
        RESERVATIONS: "categoryReservations",
        COMPLAINTS_SUGGESTIONS: "categoryComplaints",
        BILLING: "categoryBilling",
        OTHER: "categoryOther",
    }

    const priorityKeys: Record<string, string> = {
        LOW: "priorityLow",
        MEDIUM: "priorityMedium",
        HIGH: "priorityHigh",
        URGENT: "priorityUrgent",
    }

    // ── Form State ──────────────────────────────────────────────
    return (
        <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Name field */}
                <div>
                    <label htmlFor="ticket-name" className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                        {t("nameLabel")}
                    </label>
                    <div className="relative">
                        <input
                            id="ticket-name"
                            name="name"
                            type="text"
                            value={form.name}
                            onChange={user ? undefined : handleChange}
                            placeholder={t("namePlaceholder")}
                            required
                            readOnly={!!user}
                            autoComplete="name"
                            className={`w-full px-4 py-3 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 focus:outline-none focus:ring-2 focus:ring-wg-accent dark:focus:ring-wg-dark-accent transition ${user ? "bg-wg-surface dark:bg-wg-dark-surface cursor-default pr-14" : "bg-wg-bg dark:bg-wg-dark-raised"}`}
                        />
                        {user && (
                            <>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button type="button" onClick={() => setEditPopover(editPopover === "name" ? null : "name")} className="p-0.5 text-wg-muted/40 dark:text-wg-dark-muted/40 hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors rounded" aria-label={t("editName")}>
                                        <PencilSquareIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <LockClosedIcon className="w-4 h-4 text-wg-muted/50 dark:text-wg-dark-muted/50" />
                                </div>
                                {editPopover === "name" && (
                                    <div className="absolute top-full left-0 right-0 z-20 mt-1.5 p-4 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated">
                                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">{t("updateName")}</p>
                                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3 leading-relaxed">{t("nameFromProfile")}</p>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => router.push({ pathname: "/account", query: { highlight: "name" } })} className="flex-1 text-xs font-medium px-3 py-2 rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition">{tc("goToAccount")}</button>
                                            <button type="button" onClick={() => setEditPopover(null)} className="flex-1 text-xs font-medium px-3 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition">{tc("notNow")}</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Email field */}
                <div>
                    <label htmlFor="ticket-email" className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                        {t("emailLabel")}
                    </label>
                    <div className="relative">
                        <input
                            id="ticket-email"
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={user ? undefined : handleChange}
                            placeholder={t("emailPlaceholder")}
                            required
                            readOnly={!!user}
                            autoComplete="email"
                            className={`w-full px-4 py-3 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 focus:outline-none focus:ring-2 focus:ring-wg-accent dark:focus:ring-wg-dark-accent transition ${user ? "bg-wg-surface dark:bg-wg-dark-surface cursor-default pr-14" : "bg-wg-bg dark:bg-wg-dark-raised"}`}
                        />
                        {user && (
                            <>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button type="button" onClick={() => setEditPopover(editPopover === "email" ? null : "email")} className="p-0.5 text-wg-muted/40 dark:text-wg-dark-muted/40 hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors rounded" aria-label={t("editEmail")}>
                                        <PencilSquareIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <LockClosedIcon className="w-4 h-4 text-wg-muted/50 dark:text-wg-dark-muted/50" />
                                </div>
                                {editPopover === "email" && (
                                    <div className="absolute top-full left-0 right-0 z-20 mt-1.5 p-4 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated">
                                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">{t("updateEmail")}</p>
                                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3 leading-relaxed">{t("emailFromProfile")}</p>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => router.push({ pathname: "/account", query: { highlight: "email" } })} className="flex-1 text-xs font-medium px-3 py-2 rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition">{tc("goToAccount")}</button>
                                            <button type="button" onClick={() => setEditPopover(null)} className="flex-1 text-xs font-medium px-3 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition">{tc("notNow")}</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Phone */}
            <div>
                <label htmlFor="ticket-phone" className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                    {t("phoneLabel")} <span className="text-wg-muted dark:text-wg-dark-muted text-xs font-normal">{tc("optional")}</span>
                </label>
                <div className="relative">
                    <PhoneInput
                        id="ticket-phone"
                        value={form.phone}
                        onChange={(v) => !user?.phone && setForm((prev) => ({ ...prev, phone: v }))}
                        readOnly={!!(user?.phone)}
                        autoComplete="tel"
                        locale={locale}
                        searchPlaceholder={tc("phoneCountrySearch")}
                        noResultsLabel={tc("phoneCountryNoResults")}
                        countryCodeLabel={tc("selectCountryCode")}
                        className="w-full"
                    />
                    {user?.phone && (
                        <>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <button type="button" onClick={() => setEditPopover(editPopover === "phone" ? null : "phone")} className="p-0.5 text-wg-muted/40 dark:text-wg-dark-muted/40 hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors rounded" aria-label={t("editPhone")}>
                                    <PencilSquareIcon className="w-3.5 h-3.5" />
                                </button>
                                <LockClosedIcon className="w-4 h-4 text-wg-muted/50 dark:text-wg-dark-muted/50" />
                            </div>
                            {editPopover === "phone" && (
                                <div className="absolute top-full left-0 right-0 z-20 mt-1.5 p-4 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated">
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">{t("updatePhone")}</p>
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3 leading-relaxed">{t("phoneFromProfile")}</p>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => router.push({ pathname: "/account", query: { highlight: "phone" } })} className="flex-1 text-xs font-medium px-3 py-2 rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition">{tc("goToAccount")}</button>
                                        <button type="button" onClick={() => setEditPopover(null)} className="flex-1 text-xs font-medium px-3 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition">{tc("notNow")}</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Category + Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label htmlFor="ticket-category" className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                        {t("categoryLabel")}
                    </label>
                    <CustomSelect
                        id="ticket-category"
                        value={form.category}
                        onChange={(v) => setForm((prev) => ({ ...prev, category: v }))}
                        options={CATEGORIES.map((cat) => ({ value: cat, label: t(categoryKeys[cat]) }))}
                        placeholder={t("categoryPlaceholder")}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="ticket-priority" className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                        {t("priorityLabel")}
                    </label>
                    <CustomSelect
                        id="ticket-priority"
                        value={form.priority}
                        onChange={(v) => setForm((prev) => ({ ...prev, priority: v }))}
                        options={PRIORITIES.map((p) => ({ value: p, label: t(priorityKeys[p]) }))}
                    />
                </div>
            </div>

            {/* Subject */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label htmlFor="ticket-subject" className="block text-sm font-medium text-wg-text dark:text-wg-dark-text">
                        {t("subjectLabel")}
                    </label>
                    <span className={`text-xs tabular-nums ${form.subject.length >= 120 ? "text-red-500" : "text-wg-muted dark:text-wg-dark-muted"}`}>
                        {form.subject.length}/120
                    </span>
                </div>
                <input
                    id="ticket-subject"
                    name="subject"
                    type="text"
                    value={form.subject}
                    onChange={handleChange}
                    maxLength={120}
                    required
                    placeholder={t("subjectPlaceholder")}
                    className="w-full px-4 py-3 rounded-brand border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 focus:outline-none focus:ring-2 focus:ring-wg-accent dark:focus:ring-wg-dark-accent transition"
                />
            </div>

            {/* Message */}
            <div>
                <label htmlFor="ticket-message" className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                    {t("messageLabel")}
                </label>
                <Textarea
                    maxHeight={320}
                    id="ticket-message"
                    name="message"
                    minRows={5}
                    value={form.message}
                    onChange={(v) => setForm((prev) => ({ ...prev, message: v }))}
                    placeholder={t("messagePlaceholder")}
                    required
                    minLength={10}
                    className="px-4 py-3 rounded-brand border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 focus:outline-none focus:ring-2 focus:ring-wg-accent dark:focus:ring-wg-dark-accent transition"
                />
            </div>

            {/* File Attachments */}
            <div>
                <label htmlFor="ticket-attachments" className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                    {t("attachmentLabel")} <span className="text-wg-muted dark:text-wg-dark-muted text-xs font-normal">{tc("optional")}</span>
                </label>
                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="relative border-2 border-dashed border-wg-border dark:border-wg-dark-border rounded-brand p-6 text-center hover:border-wg-accent dark:hover:border-wg-dark-accent has-[:focus-visible]:border-wg-accent dark:has-[:focus-visible]:border-wg-dark-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-wg-accent/30 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <ArrowUpTrayIcon className="w-8 h-8 mx-auto mb-2 text-wg-muted/40 dark:text-wg-dark-muted/40" />
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                        {t("attachmentDragDrop")}{" "}
                        <span className="text-wg-accent dark:text-wg-dark-accent font-medium">
                            {t("attachmentBrowse")}
                        </span>
                    </p>
                    <p className="text-xs text-wg-muted/60 dark:text-wg-dark-muted/60 mt-1">
                        {t("attachmentMaxSize")}
                    </p>
                    {/* Visually hidden but focusable, so the label names it and Tab reaches it. */}
                    <input
                        id="ticket-attachments"
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        className="sr-only"
                        onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    />
                </div>

                {/* File list */}
                {files.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {files.map((file, i) => (
                            <div
                                key={`${file.name}-${i}`}
                                className="flex items-center gap-3 p-2.5 rounded-brand bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border"
                            >
                                {file.type.startsWith("image/") ? (
                                    <div className="w-8 h-8 rounded bg-wg-border/30 dark:bg-wg-dark-border flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={URL.createObjectURL(file)}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded bg-wg-primary/10 dark:bg-wg-dark-primary/15 flex items-center justify-center flex-shrink-0">
                                        <DocumentIcon className="w-4 h-4 text-wg-primary dark:text-wg-dark-primary" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-wg-text dark:text-wg-dark-text truncate">{file.name}</p>
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{formatFileSize(file.size)}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeFile(i)}
                                    className="p-1 text-wg-muted/50 hover:text-red-500 transition-colors flex-shrink-0"
                                >
                                    <CloseIcon className="w-4 h-4" strokeWidth={2} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Error */}
            {status === "error" && (
                <div className="p-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                    <p className="text-sm text-red-700 dark:text-red-300">
                        {errorMessage || t("errorGeneric")}
                    </p>
                </div>
            )}

            {/* Submit */}
            <button
                type="submit"
                disabled={status === "loading"}
                className="w-full px-7 py-4 text-base font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
                {status === "loading" ? (
                    <>
                        <Spinner className="animate-spin h-5 w-5" />
                        {t("sending")}
                    </>
                ) : (
                    t("sendTicket")
                )}
            </button>
        </form>
    )
}
