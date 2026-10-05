import { createRefreshAuthRouter } from "@insforge/sdk/ssr"
import { getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { authCookieSettings } from "@wildgrove/core/insforge/cookies"

export const { POST } = createRefreshAuthRouter({
  baseUrl: getInsforgeUrl(),
  anonKey: getInsforgeAnonKey(),
  ...authCookieSettings,
})
