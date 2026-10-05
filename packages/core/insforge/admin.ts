import { createAdminClient } from "@insforge/sdk"
import { getInsforgeApiKey, getInsforgeUrl } from "./env"

/** Project-admin client (server-only). Equivalent to former service-role. */
export function createInsforgeAdmin() {
  return createAdminClient({
    baseUrl: getInsforgeUrl(),
    apiKey: getInsforgeApiKey(),
  })
}
