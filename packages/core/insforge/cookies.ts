// ══════════════════════════════════════════════════════════════════
// Session cookie options.
//
// InsForge issues two cookies: a short-lived access token and a long-lived
// refresh token. Both are set with `httpOnly`, so neither is readable from
// scripts running on the page.
//
// The browser client does not need to read the access token: it asks
// `/api/auth/refresh` for one and keeps it in memory for the life of the page
// (see packages/core/insforge/client.ts, and `refreshUrl` in the SDK).
//
// Pass these settings to every SDK entry point that WRITES cookies —
// `createAuthActions`, `createRefreshAuthRouter`, `updateSession` — because the
// options travel with the call, not with the cookie.
// ══════════════════════════════════════════════════════════════════

/** Cookie settings for every InsForge call that issues a session. */
export const authCookieSettings = {
  options: {
    accessToken: { httpOnly: true },
  },
} as const
