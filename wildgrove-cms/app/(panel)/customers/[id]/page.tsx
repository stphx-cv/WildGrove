"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Customer Detail Page — /customers/[id]
// Section-per-card design inspired by /account page.
// ADMIN: edit name, username, phone
// OWNER: edit all + email + role + recovery + delete
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AdminSelect } from "@/components/AdminSelect"
import { PhoneInput } from "@wildgrove/ui/PhoneInput"
import { LoadingState } from "@/components/LoadingState"
import { useCmsQuery } from "@/lib/cms-query"
import {
    ArrowLeftIcon,
    CalendarBandIcon,
    CloseIcon,
    DevicePhoneMobileIcon,
    EnvelopeIcon,
    ExclamationTriangleIcon,
    GoogleMonoLogo,
    LockClosedIcon,
    PlusIcon,
    ShieldCheckIcon,
    SpinnerThinIcon,
    TrashIcon,
} from "@wildgrove/ui/icons"

interface WalletBalance {
    currency: string
    balance: string
}

interface CustomerDetail {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
    email: string | null
    recoveryEmails: string[]
    recoveryPhones: string[]
    phoneCountryCode: string | null
    phoneNumber: string | null
    avatarUrl: string | null
    role: "CUSTOMER" | "ADMIN" | "OWNER"
    connections: string[]
    createdAt: string
    updatedAt: string
    reservationCount: number
    messageCount: number
    wallets?: WalletBalance[]
    orderCount?: number
}

const ROLE_OPTIONS = [
    { value: "CUSTOMER", label: "Customer", icon: <span className="w-2 h-2 rounded-full bg-blue-400" /> },
    { value: "ADMIN", label: "Admin", icon: <span className="w-2 h-2 rounded-full bg-amber-400" /> },
    { value: "OWNER", label: "Owner", icon: <span className="w-2 h-2 rounded-full bg-violet-400" /> },
]

const ROLE_BADGE: Record<string, string> = {
    CUSTOMER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    ADMIN: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    OWNER: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
}

const CONNECTION_ICONS: Record<string, { label: string; icon: ReactNode }> = {
    EMAIL: {
        label: "Email",
        icon: (
            <EnvelopeIcon className="w-3.5 h-3.5" />
        ),
    },
    GOOGLE: {
        label: "Google",
        icon: (
            <GoogleMonoLogo className="w-3.5 h-3.5" />
        ),
    },
    PHONE: {
        label: "Phone",
        icon: (
            <DevicePhoneMobileIcon className="w-3.5 h-3.5" />
        ),
    },
}

const inputCls =
    "w-full px-3.5 py-2.5 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border " +
    "bg-wg-bg dark:bg-wg-dark-bg text-wg-text dark:text-wg-dark-text " +
    "placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 " +
    "focus:outline-none focus:ring-2 focus:ring-wg-accent/30 focus:border-wg-accent dark:focus:border-wg-dark-accent " +
    "transition-all"

const readOnlyCls =
    "w-full px-3.5 py-2.5 text-sm rounded-brand border border-wg-border/30 dark:border-wg-dark-border/30 " +
    "bg-wg-border/10 dark:bg-wg-dark-border/20 text-wg-muted dark:text-wg-dark-muted cursor-not-allowed"

/** Convert separate phoneCountryCode + phoneNumber to E.164 */
function toE164(code: string | null, number: string | null): string {
    if (code && number) return `+${code}${number}`
    return ""
}

/** Parse E.164 back to { countryCode, localNumber } for the API */
function fromE164(e164: string): { countryCode: string; localNumber: string } | null {
    if (!e164 || !e164.startsWith("+")) return null
    // Try to match known LATAM country codes (3 digits first, then 2, then 1)
    const digits = e164.slice(1)
    // 3-digit codes: 501-509, 590-599
    for (const len of [3, 2, 1]) {
        if (digits.length > len) {
            return { countryCode: digits.slice(0, len), localNumber: digits.slice(len) }
        }
    }
    return null
}

export default function AdminCustomerDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [customer, setCustomer] = useState<CustomerDetail | null>(null)
    // Shared with every other `/api/role` reader in the panel: one request.
    const { data: roleData } = useCmsQuery<{ role?: "ADMIN" | "OWNER" }>("/api/role")
    const adminRole = roleData?.role ?? "ADMIN"
    const [isLoading, setIsLoading] = useState(true)

    // ── Edit state (per-section) ──
    const [editSection, setEditSection] = useState<"profile" | "contact" | "role" | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState("")
    const [saveSuccess, setSaveSuccess] = useState("")

    // Profile fields
    const [editFirstName, setEditFirstName] = useState("")
    const [editLastName, setEditLastName] = useState("")
    const [editUsername, setEditUsername] = useState("")

    // Contact fields
    const [editEmail, setEditEmail] = useState("")
    const [editPhone, setEditPhone] = useState("") // E.164
    const [editRecoveryEmails, setEditRecoveryEmails] = useState<string[]>([])
    const [editRecoveryPhones, setEditRecoveryPhones] = useState<string[]>([])
    const [newRecoveryEmail, setNewRecoveryEmail] = useState("")
    const [newRecoveryPhone, setNewRecoveryPhone] = useState("") // E.164
    const [showAddRecoveryEmail, setShowAddRecoveryEmail] = useState(false)
    const [showAddRecoveryPhone, setShowAddRecoveryPhone] = useState(false)

    // Role
    const [editRole, setEditRole] = useState("")

    // ── Delete state ──
    const [showDelete, setShowDelete] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [delReservations, setDelReservations] = useState(false)
    const [delChats, setDelChats] = useState(false)

    const isOwner = adminRole === "OWNER"

    // ── Fetch data ──
    const fetchCustomer = useCallback(async () => {
        try {
            const res = await fetch(`/api/customers/${id}`)
            const ct = res.headers.get("content-type") ?? ""
            if (!ct.includes("application/json")) { console.error("Customer API returned non-JSON"); return }
            const json = await res.json()
            if (json.success) setCustomer(json.data)
        } catch (error) {
            console.error("Failed to fetch customer:", error)
        } finally {
            setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        fetchCustomer()
    }, [fetchCustomer])

    // ── Section edit helpers ──
    const startEditProfile = useCallback(() => {
        if (!customer) return
        setEditFirstName(customer.firstName ?? "")
        setEditLastName(customer.lastName ?? "")
        setEditUsername(customer.username ?? "")
        setSaveError("")
        setSaveSuccess("")
        setEditSection("profile")
    }, [customer])

    const startEditContact = useCallback(() => {
        if (!customer) return
        setEditEmail(customer.email ?? "")
        setEditPhone(toE164(customer.phoneCountryCode, customer.phoneNumber))
        setEditRecoveryEmails([...customer.recoveryEmails])
        setEditRecoveryPhones([...customer.recoveryPhones])
        setNewRecoveryEmail("")
        setNewRecoveryPhone("")
        setShowAddRecoveryEmail(false)
        setShowAddRecoveryPhone(false)
        setSaveError("")
        setSaveSuccess("")
        setEditSection("contact")
    }, [customer])

    const startEditRole = useCallback(() => {
        if (!customer) return
        setEditRole(customer.role)
        setSaveError("")
        setSaveSuccess("")
        setEditSection("role")
    }, [customer])

    const cancelEdit = useCallback(() => {
        setEditSection(null)
        setSaveError("")
    }, [])

    // ── Recovery helpers ──
    const addRecoveryEmail = useCallback(() => {
        const trimmed = newRecoveryEmail.trim().toLowerCase()
        if (!trimmed || !trimmed.includes("@")) return
        if (editRecoveryEmails.includes(trimmed)) return
        setEditRecoveryEmails(prev => [...prev, trimmed])
        setNewRecoveryEmail("")
        setShowAddRecoveryEmail(false)
    }, [newRecoveryEmail, editRecoveryEmails])

    const removeRecoveryEmail = useCallback((email: string) => {
        setEditRecoveryEmails(prev => prev.filter(e => e !== email))
    }, [])

    const addRecoveryPhone = useCallback(() => {
        if (!newRecoveryPhone || newRecoveryPhone.length < 8) return
        if (editRecoveryPhones.includes(newRecoveryPhone)) return
        setEditRecoveryPhones(prev => [...prev, newRecoveryPhone])
        setNewRecoveryPhone("")
        setShowAddRecoveryPhone(false)
    }, [newRecoveryPhone, editRecoveryPhones])

    const removeRecoveryPhone = useCallback((phone: string) => {
        setEditRecoveryPhones(prev => prev.filter(p => p !== phone))
    }, [])

    // ── Save handler ──
    const handleSave = useCallback(async () => {
        if (!customer) return
        setIsSaving(true)
        setSaveError("")
        setSaveSuccess("")

        try {
            const body: Record<string, unknown> = {}

            if (editSection === "profile") {
                const trimmedFirst = editFirstName.trim()
                const trimmedLast = editLastName.trim()
                const trimmedUser = editUsername.trim().toLowerCase()
                if (trimmedFirst !== (customer.firstName ?? "")) body.firstName = trimmedFirst || undefined
                if (trimmedLast !== (customer.lastName ?? "")) body.lastName = trimmedLast || undefined
                if (trimmedUser !== (customer.username ?? "")) body.username = trimmedUser || undefined
            }

            if (editSection === "contact") {
                // Phone: parse E.164 back to parts
                const parsed = fromE164(editPhone)
                const newCode = parsed?.countryCode ?? null
                const newNumber = parsed?.localNumber ?? null
                const oldCode = customer.phoneCountryCode ?? null
                const oldNumber = customer.phoneNumber ?? null
                if (newCode !== oldCode || newNumber !== oldNumber) {
                    body.phoneCountryCode = newCode
                    body.phoneNumber = newNumber
                }

                if (isOwner) {
                    const trimmedEmail = editEmail.trim()
                    if (trimmedEmail !== (customer.email ?? "")) body.email = trimmedEmail || undefined

                    // Recovery fields: always send if changed
                    const recoveryEmailsChanged =
                        JSON.stringify(editRecoveryEmails) !== JSON.stringify(customer.recoveryEmails)
                    const recoveryPhonesChanged =
                        JSON.stringify(editRecoveryPhones) !== JSON.stringify(customer.recoveryPhones)
                    if (recoveryEmailsChanged) body.recoveryEmails = editRecoveryEmails
                    if (recoveryPhonesChanged) body.recoveryPhones = editRecoveryPhones
                }
            }

            if (editSection === "role" && isOwner) {
                if (editRole !== customer.role) body.role = editRole
            }

            if (Object.keys(body).length === 0) {
                setEditSection(null)
                return
            }

            const res = await fetch(`/api/customers/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })

            const ct = res.headers.get("content-type") ?? ""
            if (!ct.includes("application/json")) { setSaveError("Server error — please try again"); return }
            const json = await res.json()
            if (json.success) {
                setCustomer(json.data)
                setEditSection(null)
                setSaveSuccess("Changes saved")
                setTimeout(() => setSaveSuccess(""), 3000)
            } else {
                setSaveError(json.error || "Failed to save changes")
            }
        } catch {
            setSaveError("Network error — please try again")
        } finally {
            setIsSaving(false)
        }
    }, [customer, id, isOwner, editSection, editFirstName, editLastName, editUsername, editEmail, editPhone, editRecoveryEmails, editRecoveryPhones, editRole])

    // ── Delete handler ──
    const handleDelete = useCallback(async () => {
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/customers/${id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    deleteReservations: delReservations,
                    deleteChatSessions: delChats,
                }),
            })
            const ct = res.headers.get("content-type") ?? ""
            if (!ct.includes("application/json")) { setSaveError("Server error — please try again"); setShowDelete(false); return }
            const json = await res.json()
            if (json.success) {
                router.push("/customers")
            } else {
                setSaveError(json.error || "Failed to delete customer")
                setShowDelete(false)
            }
        } catch {
            setSaveError("Network error — please try again")
            setShowDelete(false)
        } finally {
            setIsDeleting(false)
        }
    }, [id, router, delReservations, delChats])

    // ── Loading / not found ──
    if (isLoading) {
        return (
            <LoadingState size="page" message="Loading customer…" />
        )
    }

    if (!customer) {
        return (
            <div className="text-center py-12">
                <p className="text-wg-muted dark:text-wg-dark-muted">Customer not found</p>
            </div>
        )
    }

    const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "No name"
    const initials = [customer.firstName?.[0], customer.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?"
    const phone = customer.phoneCountryCode && customer.phoneNumber
        ? `+${customer.phoneCountryCode} ${customer.phoneNumber}`
        : null

    // ── Shared components ──
    const SectionHeader = ({ title, onEdit, editing }: { title: string; onEdit: () => void; editing: boolean }) => (
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-wg-text dark:text-wg-dark-text">{title}</h2>
            {!editing && (
                <button onClick={onEdit} className="rounded-brand bg-wg-primary dark:bg-wg-dark-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity">
                    Edit
                </button>
            )}
        </div>
    )

    const EditActions = () => (
        <div className="flex gap-2 pt-3">
            <button onClick={handleSave} disabled={isSaving} className="flex-1 rounded-brand bg-wg-primary dark:bg-wg-dark-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                {isSaving ? "Saving..." : "Save"}
            </button>
            <button onClick={cancelEdit} disabled={isSaving} className="flex-1 rounded-brand border border-wg-border/50 dark:border-wg-dark-border px-3 py-2 text-sm font-medium text-wg-text dark:text-wg-dark-text hover:bg-wg-border/20 dark:hover:bg-wg-dark-border transition-colors disabled:opacity-50">
                Cancel
            </button>
        </div>
    )

    return (
        <div className="space-y-6">

            {/* ── Admin account notice (OWNER only) ── */}
            {isOwner && customer.role === "ADMIN" && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-brand border border-amber-300/50 dark:border-amber-600/40 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
                    <ShieldCheckIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-medium">
                        This is an admin account. As owner, you can edit their profile and change or remove their admin role.
                    </p>
                </div>
            )}

            {/* ── Profile banner ── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card overflow-hidden">
                <div className="h-24 sm:h-28 w-full relative" style={{ background: "linear-gradient(135deg, #3A5A40 0%, #1E2D22 40%, #C17F3A 100%)" }}>
                    <button
                        onClick={() => router.push("/customers")}
                        className="absolute left-4 top-4 p-2 rounded-brand bg-black/20 text-white/80 hover:bg-black/30 hover:text-white transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 sm:px-8 pb-6">
                    {/* Avatar overlapping the gradient */}
                    <div className="-mt-12 sm:-mt-14 mb-4 flex justify-center sm:justify-start relative z-10">
                        {customer.avatarUrl ? (
                            <FadeInImage src={customer.avatarUrl} alt={fullName} width={112} height={112} className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-[5px] border-wg-surface dark:border-wg-dark-surface object-cover shadow-card" />
                        ) : (
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-[5px] border-wg-surface dark:border-wg-dark-surface bg-wg-primary dark:bg-wg-dark-primary flex items-center justify-center shadow-card">
                                <span className="text-2xl sm:text-3xl font-bold text-white">{initials}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                        <div className="text-center sm:text-left min-w-0">
                            <div className="flex items-center gap-3 justify-center sm:justify-start flex-wrap">
                                <h1 className="font-display text-xl sm:text-2xl font-bold text-wg-text dark:text-wg-dark-text leading-tight">{fullName}</h1>
                                <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full uppercase tracking-wide ${ROLE_BADGE[customer.role] ?? ROLE_BADGE.CUSTOMER}`}>{customer.role}</span>
                            </div>
                            {customer.username && <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-0.5">@{customer.username}</p>}
                            <p className="text-xs text-wg-muted/70 dark:text-wg-dark-muted/70 mt-1 truncate">{customer.email || "No email"}</p>
                        </div>
                        <div className="flex flex-col items-center sm:items-end gap-1 flex-shrink-0">
                            <div className="flex items-center gap-2 text-xs text-wg-muted dark:text-wg-dark-muted">
                                <CalendarBandIcon className="w-3.5 h-3.5" />
                                Member since {new Date(customer.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                            </div>
                            <div className="flex gap-1.5 flex-wrap justify-center sm:justify-end">
                                {customer.connections.map((conn) => {
                                    const info = CONNECTION_ICONS[conn]
                                    return (
                                        <span key={conn} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-wg-border/20 dark:bg-wg-dark-border/40 text-wg-muted dark:text-wg-dark-muted">
                                            {info?.icon}{info?.label ?? conn}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status messages */}
            {saveError && <div className="rounded-brand p-3 text-sm bg-red-500/10 text-red-600 dark:text-red-400">{saveError}</div>}
            {saveSuccess && <div className="rounded-brand p-3 text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{saveSuccess}</div>}

            {/* ── Form sections ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── Left column ── */}
                <div className="space-y-6">

                    {/* PROFILE */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface p-6 shadow-card">
                        <SectionHeader title="Profile" onEdit={startEditProfile} editing={editSection === "profile"} />
                        {editSection === "profile" ? (
                            <div className="space-y-4 rounded-brand bg-wg-bg/50 dark:bg-wg-dark-bg/50 p-4">
                                <div>
                                    <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">First Name</label>
                                    <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} placeholder="First name" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Last Name</label>
                                    <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} placeholder="Last name" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Username</label>
                                    <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="username" className={inputCls} />
                                </div>
                                <EditActions />
                            </div>
                        ) : (
                            <div className="space-y-2 text-sm">
                                <p className="text-wg-text dark:text-wg-dark-text"><span className="font-medium">First Name:</span> {customer.firstName || <span className="text-wg-muted dark:text-wg-dark-muted italic">Not set</span>}</p>
                                <p className="text-wg-text dark:text-wg-dark-text"><span className="font-medium">Last Name:</span> {customer.lastName || <span className="text-wg-muted dark:text-wg-dark-muted italic">Not set</span>}</p>
                                <p className="text-wg-text dark:text-wg-dark-text"><span className="font-medium">Username:</span> {customer.username ? `@${customer.username}` : <span className="text-wg-muted dark:text-wg-dark-muted italic">Not set</span>}</p>
                            </div>
                        )}
                    </div>

                    {/* CONTACT */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface p-6 shadow-card">
                        <SectionHeader title="Contact" onEdit={startEditContact} editing={editSection === "contact"} />
                        {editSection === "contact" ? (
                            <div className="space-y-5 rounded-brand bg-wg-bg/50 dark:bg-wg-dark-bg/50 p-4">

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                                        Email
                                        {!isOwner && <span className="ml-2 font-normal text-wg-muted/70 dark:text-wg-dark-muted/70">— only the customer can change this</span>}
                                    </label>
                                    <div className="relative">
                                        <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@example.com" readOnly={!isOwner} className={isOwner ? inputCls : readOnlyCls} />
                                        {!isOwner && (
                                            <LockClosedIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wg-muted/50" />
                                        )}
                                    </div>
                                </div>

                                {/* Phone with PhoneInput */}
                                <div>
                                    <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Phone</label>
                                    <PhoneInput value={editPhone} onChange={setEditPhone} />
                                </div>

                                {/* Recovery Emails (OWNER only) */}
                                {isOwner && (
                                    <div>
                                        <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Recovery Emails</label>
                                        {editRecoveryEmails.length > 0 && (
                                            <div className="space-y-1.5 mb-2">
                                                {editRecoveryEmails.map((email) => (
                                                    <div key={email} className="flex items-center justify-between gap-2 px-3 py-2 rounded-brand bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/30 dark:border-wg-dark-border/30">
                                                        <span className="text-sm text-wg-text dark:text-wg-dark-text truncate">{email}</span>
                                                        <button onClick={() => removeRecoveryEmail(email)} className="flex-shrink-0 text-red-400 hover:text-red-500 transition-colors" title="Remove">
                                                            <CloseIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {showAddRecoveryEmail ? (
                                            <div className="flex gap-2">
                                                <input type="email" value={newRecoveryEmail} onChange={(e) => setNewRecoveryEmail(e.target.value)} placeholder="recovery@email.com" className={`${inputCls} flex-1`} onKeyDown={(e) => e.key === "Enter" && addRecoveryEmail()} />
                                                <button onClick={addRecoveryEmail} className="px-3 py-2 rounded-brand bg-wg-primary dark:bg-wg-dark-primary text-white text-sm font-medium hover:opacity-90 transition-opacity">Add</button>
                                                <button onClick={() => { setShowAddRecoveryEmail(false); setNewRecoveryEmail("") }} className="px-3 py-2 rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-sm text-wg-muted dark:text-wg-dark-muted hover:bg-wg-border/20 dark:hover:bg-wg-dark-border transition-colors">Cancel</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setShowAddRecoveryEmail(true)} className="inline-flex items-center gap-1.5 text-sm text-wg-primary dark:text-wg-dark-primary hover:opacity-80 transition-opacity">
                                                <PlusIcon className="w-4 h-4" strokeWidth={2} />
                                                Add recovery email
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Recovery Phones (OWNER only) */}
                                {isOwner && (
                                    <div>
                                        <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Recovery Phones</label>
                                        {editRecoveryPhones.length > 0 && (
                                            <div className="space-y-1.5 mb-2">
                                                {editRecoveryPhones.map((p) => (
                                                    <div key={p} className="flex items-center justify-between gap-2 px-3 py-2 rounded-brand bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/30 dark:border-wg-dark-border/30">
                                                        <span className="text-sm text-wg-text dark:text-wg-dark-text">{p}</span>
                                                        <button onClick={() => removeRecoveryPhone(p)} className="flex-shrink-0 text-red-400 hover:text-red-500 transition-colors" title="Remove">
                                                            <CloseIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {showAddRecoveryPhone ? (
                                            <div className="space-y-2">
                                                <PhoneInput value={newRecoveryPhone} onChange={setNewRecoveryPhone} />
                                                <div className="flex gap-2">
                                                    <button onClick={addRecoveryPhone} className="flex-1 px-3 py-2 rounded-brand bg-wg-primary dark:bg-wg-dark-primary text-white text-sm font-medium hover:opacity-90 transition-opacity">Add</button>
                                                    <button onClick={() => { setShowAddRecoveryPhone(false); setNewRecoveryPhone("") }} className="flex-1 px-3 py-2 rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-sm text-wg-muted dark:text-wg-dark-muted hover:bg-wg-border/20 dark:hover:bg-wg-dark-border transition-colors">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => setShowAddRecoveryPhone(true)} className="inline-flex items-center gap-1.5 text-sm text-wg-primary dark:text-wg-dark-primary hover:opacity-80 transition-opacity">
                                                <PlusIcon className="w-4 h-4" strokeWidth={2} />
                                                Add recovery phone
                                            </button>
                                        )}
                                    </div>
                                )}

                                <EditActions />
                            </div>
                        ) : (
                            <div className="space-y-3 text-sm">
                                <p className="text-wg-text dark:text-wg-dark-text"><span className="font-medium">Email:</span> {customer.email || <span className="text-wg-muted dark:text-wg-dark-muted italic">Not set</span>}</p>
                                <p className="text-wg-text dark:text-wg-dark-text"><span className="font-medium">Phone:</span> {phone || <span className="text-wg-muted dark:text-wg-dark-muted italic">Not set</span>}</p>

                                {/* Recovery Emails display */}
                                <div>
                                    <p className="font-medium text-wg-text dark:text-wg-dark-text mb-1">Recovery Emails:</p>
                                    {customer.recoveryEmails.length > 0 ? (
                                        <ul className="pl-4 space-y-0.5">
                                            {customer.recoveryEmails.map((email, i) => (
                                                <li key={i} className="text-wg-text dark:text-wg-dark-text">{email}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-wg-muted dark:text-wg-dark-muted italic pl-4">None</p>
                                    )}
                                </div>

                                {/* Recovery Phones display */}
                                <div>
                                    <p className="font-medium text-wg-text dark:text-wg-dark-text mb-1">Recovery Phones:</p>
                                    {customer.recoveryPhones.length > 0 ? (
                                        <ul className="pl-4 space-y-0.5">
                                            {customer.recoveryPhones.map((p, i) => (
                                                <li key={i} className="text-wg-text dark:text-wg-dark-text">{p}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-wg-muted dark:text-wg-dark-muted italic pl-4">None</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ROLE (OWNER only) */}
                    {isOwner && (
                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface p-6 shadow-card">
                            <SectionHeader title="Role" onEdit={startEditRole} editing={editSection === "role"} />
                            {editSection === "role" ? (
                                <div className="space-y-4 rounded-brand bg-wg-bg/50 dark:bg-wg-dark-bg/50 p-4">
                                    <AdminSelect value={editRole} onChange={setEditRole} options={ROLE_OPTIONS} required />
                                    <EditActions />
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full uppercase tracking-wide ${ROLE_BADGE[customer.role] ?? ROLE_BADGE.CUSTOMER}`}>{customer.role}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Right column ── */}
                <div className="space-y-6">

                    {/* ACCOUNT */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface p-6 shadow-card">
                        <h2 className="text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-4">Account</h2>
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="font-medium text-wg-muted dark:text-wg-dark-muted mb-1">Joined</p>
                                    <p className="text-wg-text dark:text-wg-dark-text tabular-nums">{new Date(customer.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                                </div>
                                <div>
                                    <p className="font-medium text-wg-muted dark:text-wg-dark-muted mb-1">Last Updated</p>
                                    <p className="text-wg-text dark:text-wg-dark-text tabular-nums">{new Date(customer.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                                </div>
                            </div>
                            <div>
                                <p className="font-medium text-wg-muted dark:text-wg-dark-muted mb-1">Auth Providers</p>
                                <div className="flex gap-1.5 flex-wrap">
                                    {customer.connections.length > 0 ? customer.connections.map((conn) => {
                                        const info = CONNECTION_ICONS[conn]
                                        return (
                                            <span key={conn} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-wg-border/20 dark:bg-wg-dark-border/40 text-wg-text dark:text-wg-dark-text">
                                                {info?.icon}{info?.label ?? conn}
                                            </span>
                                        )
                                    }) : (
                                        <span className="text-wg-muted dark:text-wg-dark-muted italic">None</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACTIVITY */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface p-6 shadow-card">
                        <h2 className="text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-4">Activity</h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-wg-text dark:text-wg-dark-text tabular-nums">{customer.reservationCount}</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">Reservations</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-wg-text dark:text-wg-dark-text tabular-nums">{customer.messageCount}</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">Chats</p>
                            </div>
                            {customer.orderCount !== undefined && (
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-wg-text dark:text-wg-dark-text tabular-nums">{customer.orderCount}</p>
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">Orders</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* WALLET */}
                    {customer.wallets && customer.wallets.length > 0 && (
                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface p-6 shadow-card">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-wg-text dark:text-wg-dark-text">Wallet</h2>
                                <Link
                                    href={`/wallets/${customer.id}`}
                                    className="text-xs text-wg-accent dark:text-wg-dark-accent hover:underline"
                                >
                                    View ledger
                                </Link>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {customer.wallets.map((w) => (
                                    <div key={w.currency} className="rounded-brand border border-wg-border/30 dark:border-wg-dark-border p-3 text-center">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-1">{w.currency}</p>
                                        <p className="text-xl font-bold tabular-nums text-wg-text dark:text-wg-dark-text">
                                            {w.currency === "USD" ? "$" : "S/ "}{parseFloat(w.balance).toFixed(2)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* DANGER ZONE */}
                    {isOwner && (
                        <div className="rounded-card border border-red-200 dark:border-red-900/40 bg-wg-surface dark:bg-wg-dark-surface p-6 shadow-card">
                            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h2>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-4">Permanently delete this customer account and optionally all associated data.</p>
                            <button
                                onClick={() => { setDelReservations(false); setDelChats(false); setShowDelete(true) }}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-brand border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Delete Account
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Delete dialog ── */}
            {showDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setShowDelete(false) }} role="dialog" aria-modal="true">
                    <div className="w-full max-w-md bg-wg-surface dark:bg-wg-dark-surface rounded-card border border-wg-border/50 dark:border-wg-dark-border shadow-elevated p-6">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-red-100 dark:bg-red-900/30">
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-2">Delete Account</h3>
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-4">Permanently delete <strong className="text-wg-text dark:text-wg-dark-text">{fullName}</strong>&apos;s account. This cannot be undone.</p>
                        <div className="space-y-2 mb-6">
                            <p className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-2">Also delete associated data</p>
                            <label className="flex items-center gap-2.5 cursor-pointer text-sm text-wg-text dark:text-wg-dark-text">
                                <input type="checkbox" checked={delReservations} onChange={(e) => setDelReservations(e.target.checked)} className="wg-check wg-control-danger w-4 h-4" />
                                Reservations ({customer.reservationCount})
                            </label>
                            <label className="flex items-center gap-2.5 cursor-pointer text-sm text-wg-text dark:text-wg-dark-text">
                                <input type="checkbox" checked={delChats} onChange={(e) => setDelChats(e.target.checked)} className="wg-check wg-control-danger w-4 h-4" />
                                Chat sessions ({customer.messageCount})
                            </label>
                            <p className="text-xs text-wg-muted/60 dark:text-wg-dark-muted/60 mt-1">Unchecked items will be kept but unlinked from this account.</p>
                        </div>
                        <div className="flex items-center gap-3 justify-end">
                            <button onClick={() => setShowDelete(false)} disabled={isDeleting} className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border disabled:opacity-50 transition-colors">Cancel</button>
                            <button onClick={handleDelete} disabled={isDeleting} className="px-4 py-2 text-sm font-medium rounded-brand bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white transition-colors disabled:opacity-50">
                                {isDeleting ? (
                                    <span className="flex items-center gap-2">
                                        <SpinnerThinIcon className="w-4 h-4 animate-spin" />
                                        Deleting...
                                    </span>
                                ) : "Delete Account"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
