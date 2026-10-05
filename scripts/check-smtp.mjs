#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// Does SMTP actually work? Connects and authenticates against the
// server named by SMTP_HOST, using the same settings the app uses.
//
//   node --env-file=wildgrove-web/.env.local scripts/check-smtp.mjs
//   node --env-file=wildgrove-web/.env.local scripts/check-smtp.mjs you@example.com
//
// With an address it also sends one plain test message there, which is
// the only way to prove delivery rather than just authentication.
//
// It prints the host, port, user and from address, never the password —
// only whether one is set and how long it is, which is enough to catch
// the copy-paste failures (a stray space, a truncated value) without
// putting the credential on screen or in a terminal scrollback.
// ══════════════════════════════════════════════════════════════════

import nodemailer from "nodemailer"

const host = process.env.SMTP_HOST?.trim() ?? ""
const user = process.env.SMTP_USER?.trim() ?? ""
const pass = process.env.SMTP_PASS ?? ""
const from = process.env.SMTP_FROM?.trim() || user
const port = Number.parseInt(process.env.SMTP_PORT?.trim() ?? "", 10)

console.log("SMTP_HOST :", host || "(empty)")
console.log("SMTP_PORT :", Number.isInteger(port) ? port : `(not a number: ${JSON.stringify(process.env.SMTP_PORT)})`)
console.log("SMTP_USER :", user || "(empty)")
console.log("SMTP_FROM :", from || "(empty)")
console.log("SMTP_PASS :", pass === "" ? "(empty)" : `set, ${pass.length} chars`)
if (pass !== pass.trim()) console.log("            ⚠  it has leading or trailing whitespace")

if (!host || !user || !pass || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("\n✗ getEmailConfig() would return null here — the app sends no email with these values.")
    process.exit(1)
}

// secure: true matches createTransporter() in packages/core/email.ts, which is
// why the port has to be an implicit-TLS one (465), not 587.
const transporter = nodemailer.createTransport({ host, port, secure: true, auth: { user, pass } })

try {
    await transporter.verify()
    console.log("\n✓ connected and authenticated")
} catch (err) {
    console.error("\n✗ could not connect or authenticate")
    console.error(`  ${err.message}`)
    if (err.code) console.error(`  code: ${err.code}`)
    process.exit(1)
}

const to = process.argv[2]
if (!to) {
    console.log("\nPass an address to also send a test message:")
    console.log("  node --env-file=wildgrove-web/.env.local scripts/check-smtp.mjs you@example.com")
    process.exit(0)
}

try {
    const info = await transporter.sendMail({
        from: `Wild Grove <${from}>`,
        to,
        subject: "Wild Grove SMTP check",
        text: "If you are reading this, SMTP works.",
    })
    console.log(`✓ sent to ${to} (${info.messageId})`)
    if (info.rejected?.length) console.log(`  rejected: ${info.rejected.join(", ")}`)
} catch (err) {
    console.error(`✗ authenticated, but the send failed: ${err.message}`)
    process.exit(1)
}
