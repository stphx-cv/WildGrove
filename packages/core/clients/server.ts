import { createCompatServerClient } from "../insforge/server"

/**
 * Server InsForge client with Supabase-shaped auth helpers.
 */
export async function createClient() {
  return createCompatServerClient()
}
