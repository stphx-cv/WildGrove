// ══════════════════════════════════════════════════════════════════
// Storage object addresses.
//
// The rows keep the full address of each uploaded file. Two formats exist:
//
//   /api/storage/buckets/<bucket>/objects/<key>   the storage client today
//   /storage/v1/object/public/<bucket>/<key>      rows written before it
//
// Both are read on any host, because the host is whatever the storage URL was
// when the file was uploaded. The key comes back decoded, as the storage API
// expects it.
// ══════════════════════════════════════════════════════════════════

export type StorageObjectRef = { bucket: string; key: string }

const CURRENT_FORMAT = /^\/api\/storage\/buckets\/([^/]+)\/objects\/(.+)$/
const LEGACY_FORMAT = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/

/** The bucket and key an address points at, or null when it is not a storage object. */
export function parseStorageObjectUrl(url: unknown): StorageObjectRef | null {
    if (typeof url !== "string" || url.length === 0) return null

    let pathname: string
    try {
        pathname = new URL(url, "http://storage.invalid").pathname
    } catch {
        return null
    }

    const match = CURRENT_FORMAT.exec(pathname) ?? LEGACY_FORMAT.exec(pathname)
    if (!match) return null

    try {
        const bucket = decodeURIComponent(match[1])
        const key = decodeURIComponent(match[2])
        return bucket && key ? { bucket, key } : null
    } catch {
        return null
    }
}

/** The keys, in one bucket, of the addresses given. */
export function storageKeysInBucket(urls: Iterable<unknown>, bucket: string): Set<string> {
    const keys = new Set<string>()
    for (const url of urls) {
        const ref = parseStorageObjectUrl(url)
        if (ref && ref.bucket === bucket) keys.add(ref.key)
    }
    return keys
}
