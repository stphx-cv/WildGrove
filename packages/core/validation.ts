// ══════════════════════════════════════════════════════════════════
// Shared validation constants — used by AuthForm, AccountForm, and
// server-side API routes for consistent input validation.
// ══════════════════════════════════════════════════════════════════

export const passwordRules = [
    { id: "length",    label: "At least 6 characters",      test: (p: string) => p.length >= 6 },
    { id: "lowercase", label: "One lowercase letter (a–z)", test: (p: string) => /[a-z]/.test(p) },
    { id: "uppercase", label: "One uppercase letter (A–Z)", test: (p: string) => /[A-Z]/.test(p) },
    { id: "digit",     label: "One number (0–9)",           test: (p: string) => /[0-9]/.test(p) },
    { id: "symbol",    label: "One symbol (!@#$…)",         test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
]

export const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/
// Only letters, spaces, hyphens, apostrophes (handles names like O'Brien, Mary-Jane)
export const NAME_REGEX = /^[\p{L}\s'-]+$/u
// E.164 phone format: +{country_code}{number}, 7–15 digits after "+"
export const PHONE_REGEX = /^\+\d{7,15}$/

// RFC 5321 caps a forward path at 256 octets, so an address is at most 254.
export const EMAIL_MAX_LENGTH = 254
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * A plausible email address: something, an @, and a dotted domain. The length
 * check runs first because the pattern backtracks quadratically on a long run
 * of dots, and a body field has no size limit of its own.
 */
export function isValidEmail(value: string): boolean {
    return value.length <= EMAIL_MAX_LENGTH && EMAIL_REGEX.test(value)
}
