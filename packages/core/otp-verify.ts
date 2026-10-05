// ══════════════════════════════════════════════════════════════════
// OTP verification hardening
//
// For the OTP codes we issue ourselves (recovery email and primary
// email change), a 6-digit code is guessable, so we cap the number of
// failed attempts per code. After MAX_OTP_ATTEMPTS wrong tries the
// code is invalidated and the user must request a new one. Combined
// with the per-IP/user otpLimiter (lib/rate-limit.ts), this blocks
// brute-force takeover.
// ══════════════════════════════════════════════════════════════════

import { prisma } from "@wildgrove/db"

export const MAX_OTP_ATTEMPTS = 3

export type OtpCheckResult =
  | { ok: true }
  | { ok: false; status: number; error: string; remaining?: number; invalidated?: boolean }

/**
 * Validate a stored email OTP, counting failed attempts. On a wrong
 * code the attempt counter is incremented; once it reaches
 * MAX_OTP_ATTEMPTS the code is deleted. Returns { ok: true } only on
 * an exact match. The caller is responsible for the success-path side
 * effects.
 */
export async function verifyEmailCode(
  profileId: string,
  email: string,
  token: string,
): Promise<OtpCheckResult> {
  const record = await prisma.verificationCode.findFirst({
    where: { profileId, email, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })

  if (!record) return { ok: false, status: 400, error: "Invalid or expired code. Please try again." }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.verificationCode.deleteMany({ where: { profileId, email } })
    return { ok: false, status: 429, error: "Too many incorrect attempts. Please request a new code.", invalidated: true }
  }

  if (record.code !== token) {
    const attempts = record.attempts + 1
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.verificationCode.deleteMany({ where: { profileId, email } })
      return { ok: false, status: 429, error: "Too many incorrect attempts. Please request a new code.", invalidated: true }
    }
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts },
    })
    const remaining = MAX_OTP_ATTEMPTS - attempts
    return { ok: false, status: 400, error: "Invalid or expired code. Please try again.", remaining }
  }

  return { ok: true }
}
