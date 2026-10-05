import { getRequestConfig } from "next-intl/server"
import { routing } from "@wildgrove/core/i18n/routing"
import { messagesFor } from "./messages"

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale

  if (!locale || !routing.locales.includes(locale as "en" | "es")) {
    locale = routing.defaultLocale
  }

  // Statically imported — see ./messages.ts for why this is not `await import`.
  return {
    locale,
    messages: messagesFor(locale),
  }
})
