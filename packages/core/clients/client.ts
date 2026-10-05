import { createClient as createInsforgeBrowserClient } from "../insforge/client"

/**
 * Browser InsForge client (SSR helpers + deferred realtime stubs).
 * Prefer `/api/auth/*` for mutations that must set httpOnly cookies.
 */
export function createClient() {
  return createInsforgeBrowserClient()
}
