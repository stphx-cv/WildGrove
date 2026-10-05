// ══════════════════════════════════════════════════════════════════
// Safe JSON-LD serialization
//
// `JSON.stringify` does NOT escape HTML-significant characters, so a
// value containing "</script>" (e.g. a product name or address) could
// break out of the <script type="application/ld+json"> block and inject
// markup. Escaping `<`, `>` and `&` as unicode escapes keeps the JSON
// valid while making it inert inside a <script> element.
// ══════════════════════════════════════════════════════════════════

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
}
