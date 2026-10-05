// Normalize user text for near-duplicate comparison (greeting / typo spam).

function normalizeForSimilarity(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const next = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost)
      row[j - 1] = prev
      prev = next
    }
    row[b.length] = prev
  }
  return row[b.length]
}

/** True when two messages are the same or clearly minor variants (hola / holas / holak). */
export function isSimilarMessage(a: string, b: string): boolean {
  const na = normalizeForSimilarity(a)
  const nb = normalizeForSimilarity(b)
  if (!na || !nb) return na === nb
  if (na === nb) return true

  const maxLen = Math.max(na.length, nb.length)
  const dist = levenshtein(na, nb)
  const ratio = 1 - dist / maxLen

  // Short messages: typos and suffix spam
  if (maxLen <= 24) {
    if (ratio >= 0.72) return true
    if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) return true
    return false
  }

  return ratio >= 0.88
}
