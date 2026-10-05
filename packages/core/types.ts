// ══════════════════════════════════════════════════════════════════
// Shared types for the Wild Grove API
// ══════════════════════════════════════════════════════════════════

/** Standard API response envelope — used on ALL routes */
export interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

/** Serializable summary of a Supabase Auth identity (one per linked provider) */
export interface LinkedIdentity {
    provider: string      // "google" | "email"
    email: string | null  // identity_data.email — may differ from the account's primary email
}

/** Authenticated user profile — passed to forms for auto-fill */
export interface UserProfile {
    id: string
    name: string
    firstName: string | null
    lastName: string | null
    email: string
    phone: string | null
}
