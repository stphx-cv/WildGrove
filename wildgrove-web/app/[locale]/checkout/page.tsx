import { setRequestLocale } from "next-intl/server"
import { pageMetadata } from "@/i18n/messages"
import { getAppSettings } from "@wildgrove/core/settings"
import { CheckoutClient } from "./CheckoutClient"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  // Synchronous on purpose — see i18n/messages.ts: an awaited lookup here
  // lets the HTML shell win the race and pushes <title> out of <head>.
  return pageMetadata(locale, "checkout")
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const settings = await getAppSettings()

  return (
    <CheckoutClient
      switches={{
        walletEnabled: settings.walletEnabled,
        pickupEnabled: settings.pickupEnabled,
        deliveryEnabled: settings.deliveryEnabled,
        boletaEnabled: settings.boletaEnabled,
        facturaEnabled: settings.facturaEnabled,
        storeCurrency: settings.storeCurrency,
      }}
    />
  )
}
