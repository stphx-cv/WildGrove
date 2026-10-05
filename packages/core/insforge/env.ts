const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
const insforgeApiKey = process.env.INSFORGE_API_KEY

export function getInsforgeUrl(): string {
  if (!insforgeUrl) throw new Error("Missing NEXT_PUBLIC_INSFORGE_URL")
  return insforgeUrl
}

export function getInsforgeAnonKey(): string {
  if (!insforgeAnonKey) throw new Error("Missing NEXT_PUBLIC_INSFORGE_ANON_KEY")
  return insforgeAnonKey
}

export function getInsforgeApiKey(): string {
  if (!insforgeApiKey) throw new Error("Missing INSFORGE_API_KEY")
  return insforgeApiKey
}

/** Public site origin for OAuth redirectTo (falls back to NEXT_PUBLIC_SITE_URL). */
export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:4680"
  return url.replace(/\/$/, "")
}
