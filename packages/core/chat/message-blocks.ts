// ══════════════════════════════════════════════════════════════════
// Sage AI | The structured blocks inside a chat message
// Dish cards, a reservation card and a list of reservations travel in the
// message text as fenced JSON blocks. Only the code writes them, from
// database rows; any block a model writes is removed.
// ══════════════════════════════════════════════════════════════════

export const STRUCTURED_BLOCK_TYPES = ["menu-items", "reservation-list", "reservation"] as const

export type StructuredBlockType = (typeof STRUCTURED_BLOCK_TYPES)[number]

// "reservation-list" goes before "reservation", and the newline right after the
// name keeps one from matching the other.
const ANY_BLOCK = /```(menu-items|reservation-list|reservation)\r?\n([\s\S]*?)\r?\n```/g

// The writer used to read this parenthetical in its own past replies, and then
// wrote it back as if it were speech. It is bookkeeping, never part of a message.
const SHOWN_DISH_ASIDE = /[ \t]*\([ \t]*showed dish cards:[^)\n]*\)[ \t]*/gi

const EM_DASH = "\u2014"

/**
 * Guest-facing speech never uses an em dash. A pause becomes a comma.
 * A dash that only opened the message is dropped.
 */
export function replaceEmDashes(text: string): string {
  if (!text.includes(EM_DASH)) return text
  return text
    .replace(/(?:[ \t]*—[ \t]*)+/g, ", ")
    .replace(/([.:;!?])[ \t]*,/g, "$1")
    .replace(/,[ \t]*,+/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]*,[ \t]*/, "")
}

/**
 * Rewrites em dashes as chunks arrive. A trailing space or dash stays
 * unsent until the next chunk, so "word — next" split in two still
 * becomes "word, next".
 */
export function createEmDashStream() {
  let raw = ""
  let sent = ""
  const delta = (flush: boolean): string => {
    const stable = flush ? raw : raw.replace(/[ \t\u2014]+$/, "")
    let cleaned = replaceEmDashes(stable)
    if (flush && /—[ \t]*$/.test(raw)) cleaned = cleaned.replace(/,[ \t]*$/, "")
    const next = cleaned.startsWith(sent) ? cleaned.slice(sent.length) : ""
    if (cleaned.startsWith(sent)) sent = cleaned
    return next
  }
  return {
    push(chunk: string): string {
      raw += chunk
      return delta(false)
    },
    flush(): string {
      const tail = delta(true)
      raw = ""
      sent = ""
      return tail
    },
  }
}

/** Drop the private "Showed dish cards" note. Leaves the rest of the text alone. */
export function stripShownDishAside(text: string): string {
  if (!/showed dish cards/i.test(text)) return text
  return text.replace(SHOWN_DISH_ASIDE, "").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "")
}

/**
 * Drop a tail the model left unfinished when it ran out of tokens.
 * Keeps the reply through the last sentence that already ends.
 * If nothing has ended yet, the text stays as it is.
 */
export function endsOnSentence(text: string): boolean {
  return /[.!?…]["»”']?$/.test(text.trimEnd())
}

export function dropUnfinishedTail(text: string): string {
  const trimmed = text.trimEnd()
  if (!trimmed || endsOnSentence(trimmed)) return trimmed
  const ends = [...trimmed.matchAll(/[.!?…]["»”']?(?=\s)/g)]
  const last = ends.at(-1)
  if (!last || last.index === undefined) return trimmed
  return trimmed.slice(0, last.index + last[0].length).trimEnd()
}

// A last sentence that only offers more help. The prompt forbids it and the
// model still writes it now and then. Matched on the sentence alone, with
// its opening ¿ or ¡ dropped, so a question that helps to choose stays.
const HELP_OFFER = [
  /^(?:te|le) (?:puedo )?ayud\w* (?:con|en) (?:algo|alguna otra cosa|otra cosa) ?m[aá]s/i,
  /^(?:hay )?algo m[aá]s (?:en (?:lo )?que|que|con lo que|para lo que) (?:te |le )?(?:pueda|puedo)/i,
  /^en qu[eé] m[aá]s (?:te |le )?(?:puedo )?ayud/i,
  /^(?:necesitas|necesita|quieres|deseas) algo m[aá]s/i,
  /^(?:quieres|te gustar[ií]a) (?:saber|conocer|ver) (?:algo )?m[aá]s/i,
  /^si (?:necesitas|tienes|quieres) (?:algo m[aá]s|alguna otra|otra (?:duda|pregunta|cosa)|m[aá]s (?:ayuda|informaci[oó]n|preguntas))/i,
  /^no dudes en/i,
  /^(?:aqu[ií] )?estoy (?:aqu[ií] )?para (?:lo que necesites|ayudarte)/i,
  /^(?:is there )?anything else\b/i,
  /^(?:can|may) i help (?:you )?with anything else/i,
  /^how else can i help/i,
  /^(?:do you )?need anything else/i,
  /^would you like to (?:know|hear|see) (?:anything )?more/i,
  /^let me know if (?:you need|there'?s|you have|i can)/i,
  /^feel free to/i,
  /^(?:if|should) you (?:have|need) (?:any )?(?:other|more|further)? ?(?:questions|help|anything)/i,
  /^i'?m (?:here|happy) to help/i,
]

/**
 * Drops a closing sentence that only offers more help, while the reply has
 * something else to say. Up to two, for a pair like "¡Que lo disfrutes!
 * ¿Algo más?" only the offer goes; the rest is left as written.
 */
export function dropClosingHelpOffer(text: string): string {
  let result = text.trimEnd()
  for (let round = 0; round < 2; round++) {
    const ends = [...result.matchAll(/[.!?…]["»”']?\s+/g)]
    const last = ends.at(-1)
    const start = last?.index === undefined ? 0 : last.index + last[0].length
    if (start === 0) break
    const sentence = result.slice(start).replace(/^[¿¡\s]+/, "")
    if (!HELP_OFFER.some((pattern) => pattern.test(sentence))) break
    result = result.slice(0, start).trimEnd()
  }
  return result
}

/** The text without any structured block, whoever wrote it. */
export function stripStructuredBlocks(text: string): string {
  return stripShownDishAside(text.replace(ANY_BLOCK, "")).replace(/\n{3,}/g, "\n\n").trim()
}

/** A fenced block with the given JSON payload. */
export function structuredBlock(type: StructuredBlockType, payload: unknown): string {
  return `\`\`\`${type}\n${JSON.stringify(payload)}\n\`\`\``
}

/** The dish names of the menu-items blocks in a message, in the given language. */
export function menuBlockNames(text: string, language: "en" | "es"): string[] {
  const names: string[] = []
  for (const match of text.matchAll(ANY_BLOCK)) {
    if (match[1] !== "menu-items") continue
    try {
      const entries: unknown = JSON.parse(match[2])
      if (!Array.isArray(entries)) continue
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue
        const { name, nameEs } = entry as { name?: unknown; nameEs?: unknown }
        const picked = language === "es" && typeof nameEs === "string" && nameEs ? nameEs : name
        if (typeof picked === "string" && picked) names.push(picked)
      }
    } catch {
      // A malformed block names no dish.
    }
  }
  return names
}
