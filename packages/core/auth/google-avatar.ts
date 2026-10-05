// ══════════════════════════════════════════════════════════════════
// Google profile photos.
//
// A profile's avatar is either a file the user uploaded to storage or the
// photo of their linked Google account. The second one arrives in the auth
// metadata, which is not a place to trust an address from, so it is only
// copied to the profile when it really points at Google's photo host.
// ══════════════════════════════════════════════════════════════════

const GOOGLE_PHOTO_HOST_SUFFIX = ".googleusercontent.com"

/** True for an https address on Google's photo host; false for anything else, including non-strings. */
export function isGoogleAvatarUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length === 0) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return parsed.protocol === "https:" && parsed.hostname.endsWith(GOOGLE_PHOTO_HOST_SUFFIX)
}
