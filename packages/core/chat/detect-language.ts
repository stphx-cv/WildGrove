// ══════════════════════════════════════════════════════════════════
// Language of a message
// A loose greeting is recognized here, because the decision model reads
// spellings literally. Anything longer is asked of that model: English,
// Spanish, some other language, or no language at all. No language, and a
// model that did not answer, fall back to the page.
// ══════════════════════════════════════════════════════════════════

const SPANISH_CHARS = /[ñáéíóúüÁÉÍÓÚÜÑ¿¡]/

const SPANISH_WORDS = [
  // Question words
  "que", "qué", "como", "cómo", "donde", "dónde", "cuando", "cuándo",
  "cuanto", "cuánto", "cuantos", "cuántos", "quien", "quién", "cual", "cuál",
  "porque", "por qué", "para qué",
  // Common verbs
  "tengo", "tiene", "tienen", "tienes", "tener",
  "quiero", "quiere", "quieren", "quieres", "querer",
  "puedo", "puede", "pueden", "puedes", "poder",
  "hay", "habrá", "había",
  "es", "son", "está", "están", "estoy", "estás",
  "hacer", "hago", "hace", "hacen",
  "ir", "voy", "va", "van",
  "sé", "saber", "sabés",
  // Greetings & common phrases
  "hola", "buenas", "buenos", "gracias", "adios", "adiós", "chao",
  "por favor", "de nada", "disculpa", "perdón",
  // Articles & prepositions
  "los", "las", "del", "una", "unos", "unas", "esto", "esta", "estos", "estas",
  "con", "sin", "desde", "hasta", "para", "sobre",
  // Common adjectives
  "muchos", "muchas", "poco", "poca", "gran", "grande",
  // Restaurant-specific Spanish
  "reserva", "reservar", "reservas", "horario", "horarios",
  "precio", "precios", "menú", "menu", "comida", "mesa",
  "abierto", "cerrado", "abre", "cierra",
  "ubicacion", "ubicación", "dirección", "direccion",
  "también", "tambien", "además", "ademas",
  "necesito", "quisiera", "me gustaría", "me gustaria",
]

/** A yes at or above this is the language of the message. The same bar as a request. */
export const MESSAGE_LANGUAGE_THRESHOLD = 0.5

/** Letters only, without accents, so "holá" and "hola" are the same word. */
function lettersOnly(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "")
}

/** Repeated letters count once: "olaaa" is "ola", "hellooo" is "helo". */
function collapseRepeats(token: string): string {
  return token.replace(/(.)\1+/g, "$1")
}

/**
 * Informal English hellos. "holla" keeps its double l: collapsing it would
 * make it the Spanish "hola".
 */
function isEnglishGreeting(raw: string): boolean {
  const token = lettersOnly(raw)
  if (!token) return false
  if (/^ho+l{2,}a+$/.test(token)) return true
  const collapsed = collapseRepeats(token)
  return /^(helo|hi|hey|hiya|heya|heyo|elo|hulo|halo|henlo|hewo|yo|ayo|sup|wasup|howdy|ahoy|oi)$/.test(collapsed)
}

/** Informal Spanish hellos, including "ola", "olak" and "holsss". */
function isSpanishGreeting(raw: string): boolean {
  if (isEnglishGreeting(raw)) return false
  const collapsed = collapseRepeats(lettersOnly(raw))
  if (!collapsed) return false
  if (/^h?ol[as]+k?$/.test(collapsed)) return true
  return ["buenas", "bueno", "buenos", "gracias", "chao", "chau", "adios", "oye"].includes(collapsed)
}

/**
 * The language of a message that is only a greeting, written loosely.
 * A longer message, or a mix of both languages, is left for the decision model.
 */
export function detectGreetingLanguage(message: string): "en" | "es" | null {
  const words = message
    .toLowerCase()
    .split(/[^a-z\u00c0-\u024f]+/i)
    .filter(Boolean)
  if (words.length === 0 || words.length > 3) return null
  if (words.every(isEnglishGreeting)) return "en"
  if (words.every(isSpanishGreeting)) return "es"
  return null
}

export type ReplyLanguage = "en" | "es" | "other"

export type ReplyLanguageSource = "greeting" | "message" | "conversation" | "page"

function replyLanguageOf(metadata: unknown): ReplyLanguage | null {
  if (!metadata || typeof metadata !== "object") return null
  const decision = (metadata as { decision?: { replyLanguage?: unknown } }).decision
  const value = decision?.replyLanguage
  if (value === "en" || value === "es" || value === "other") return value
  return null
}

/**
 * The language of the newest Sage reply that recorded one. Staff messages,
 * system messages and Sage replies without that record are skipped.
 */
export function previousReplyLanguage(
  rows: readonly { role: string; metadata: unknown }[],
): ReplyLanguage | null {
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index]
    if (row.role !== "ASSISTANT") continue
    const language = replyLanguageOf(row.metadata)
    if (language) return language
  }
  return null
}

/**
 * Which language Sage writes in, and where that choice came from.
 * A loose greeting wins on its own. Otherwise the decision model's highest
 * language wins when it clears the threshold. A message with no language
 * keeps the language of the previous Sage reply. The page is only used when
 * there is no previous reply.
 */
export function resolveReplyLanguage(
  message: string,
  pageLocale: "en" | "es",
  answer: { choice: string; probabilities: Record<string, number> } | null,
  previous: ReplyLanguage | null,
): { language: ReplyLanguage; from: ReplyLanguageSource } {
  const greeting = detectGreetingLanguage(message)
  if (greeting) return { language: greeting, from: "greeting" }
  const score = answer ? (answer.probabilities[answer.choice] ?? 0) : 0
  if (
    answer &&
    score >= MESSAGE_LANGUAGE_THRESHOLD &&
    (answer.choice === "en" || answer.choice === "es" || answer.choice === "other")
  ) {
    return { language: answer.choice, from: "message" }
  }
  if (previous) return { language: previous, from: "conversation" }
  return { language: pageLocale, from: "page" }
}

/**
 * Fallback language for a fixed sentence. The previous Sage reply wins when
 * it was English or Spanish. Another language, or no reply, uses the page.
 */
export function fixedTextLocale(metadata: unknown, pageLocale: "en" | "es"): "en" | "es" {
  const language = replyLanguageOf(metadata)
  if (language === "en" || language === "es") return language
  return pageLocale
}

/**
 * Detects whether a message is in Spanish or English.
 * Falls back to the page locale if detection is uncertain.
 * Used where the decision model is not called: a chat answered by the
 * team, and the fixed text when Sage is over its reply limit.
 */
export function detectMessageLanguage(
  message: string,
  fallbackLocale: "en" | "es" = "en"
): "en" | "es" {
  const greeting = detectGreetingLanguage(message)
  if (greeting) return greeting

  // Strong indicator: Spanish-specific characters (ñ, accented vowels, ¿, ¡)
  if (SPANISH_CHARS.test(message)) return "es"

  const lower = message.toLowerCase()
  const words = lower
    .replace(/[^\w\sáéíóúüñ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)

  let spanishScore = 0

  for (const word of words) {
    if (SPANISH_WORDS.includes(word)) {
      spanishScore++
    }
  }

  // Also check for multi-word Spanish phrases
  for (const phrase of SPANISH_WORDS) {
    if (phrase.includes(" ") && lower.includes(phrase)) {
      spanishScore += 2
    }
  }

  // If 1+ Spanish word found in a short message → likely Spanish
  // Require 2+ for longer messages to reduce false positives
  const threshold = words.length <= 4 ? 1 : 2

  if (spanishScore >= threshold) return "es"

  return fallbackLocale
}
