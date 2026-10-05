#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// Inventory of hand-written <svg> elements, and proof that moving them
// into packages/ui/icons did not change what they draw.
//
//   node scripts/icons-inventory.mjs                    list what is still written by hand
//   node scripts/icons-inventory.mjs --groups           same, grouped by drawing (for naming components)
//   node scripts/icons-inventory.mjs --baseline         save the starting inventory (refuses to overwrite)
//   node scripts/icons-inventory.mjs --compare          check the tree against the saved inventory
//   node scripts/icons-inventory.mjs --similar          drawings with the same geometry that differ in fill, stroke or other attributes
//
// Options:  --dir <path>        folder to scan (repeatable). Default: wildgrove-web/app and wildgrove-web/components
//           --file <path>       baseline file. Default: wildgrove-vault/private/13-shared-icons-baseline.json
//           --force             let --baseline overwrite an existing file
//           --verbose           print every difference instead of the first few
//
// How it works. Every <svg> in the scanned folders is parsed and reduced to a
// "resolved signature": the viewBox, the className, the stroke width, the accessibility
// attributes, and for each shape its geometry plus the presentation attributes it ends up
// with after inheriting from its ancestors. Class names and colors are kept in the
// signature, so the comparison is stricter than the grouping into drawings.
//
// Geometry is normalized by the grammar of SVG, so spelling does not count: path data gets
// one command per segment, absolute coordinates (H and V become L), arc flags read as single
// digits and numbers rounded to 2 decimals, and the other numeric attributes are rounded the
// same way. A name that stands for a string constant of the same file (`const iconClass =
// "w-6 h-6"`) reads as that string. Two drawings are the same when they read the same here.
//
// In --compare mode each icon component imported from @wildgrove/ui/icons is resolved the
// same way: the script reads the component file in packages/ui/icons, applies the base
// (LineIcon, SolidIcon or the component's own <svg>) and the props of that one use, and
// compares the result with the signature of the <svg> it replaced. The baseline keeps the
// original text of every <svg>, and icon uses that already existed at the baseline commit are
// told apart by reading the files at that commit with git. Sites are paired by order inside
// each file. When that does not fit, the script says which file it compared differently:
//   - same number of uses in another order: as a multiset (same signatures, same counts)
//   - a local helper that wrapped one <svg> was removed: as a set (every drawing the file had
//     is still drawn, and none appears that it did not have)
//   - a file that no longer exists: each of its drawings must be drawn by a new use, or by a
//     package component that nothing uses
//
// Base contract the resolver relies on (keep LineIcon and SolidIcon consistent with it):
//   - static attributes on the base <svg> are taken as they are
//   - `strokeWidth={strokeWidth}` reads the prop of the use, and a default in the
//     destructuring applies when the use omits it
//   - `{...rest}` receives every other prop of the use
//   - `aria-hidden` written as an expression means: hidden unless the use passes
//     aria-label, aria-labelledby or role
// The only tolerated difference is that last rule: a use that had no aria-hidden and now
// gets one. It is counted and printed, not treated as a failure.
//
// Exit code is 1 when --compare finds differences.
// ══════════════════════════════════════════════════════════════════

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"
import { execFileSync, execSync } from "node:child_process"

const ROOT = path.resolve(import.meta.dirname, "..")
const ICONS_DIR = path.join(ROOT, "packages", "ui", "icons")
const DEFAULT_DIRS = ["wildgrove-web/app", "wildgrove-web/components"]
const DEFAULT_BASELINE = "wildgrove-vault/private/13-shared-icons-baseline.json"
const SKIP_DIRS = new Set(["node_modules", ".next", ".turbo", "dist"])
const SOURCE_FILE = /\.(tsx|jsx|ts|js|mjs)$/

// ── Arguments ─────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const values = (name) => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]] : []))
const dirs = (values("--dir").length ? values("--dir") : DEFAULT_DIRS).map((d) => path.resolve(ROOT, d))
const baselinePath = path.resolve(ROOT, values("--file")[0] ?? DEFAULT_BASELINE)
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/")

// ── A small JSX reader ────────────────────────────────────────────
// Enough JSX to read an <svg> subtree or an icon use: elements, attributes with string,
// number, expression and spread values, and children. It never evaluates anything.

const collapse = (s) => s.replace(/\s+/g, " ").trim()

/** Index just after the `}` that closes the `{` at src[i]. Skips strings, templates and comments. */
function readBalanced(src, i) {
    let depth = 0
    for (let j = i; j < src.length; j++) {
        const c = src[j]
        if (c === "{") depth++
        else if (c === "}") {
            depth--
            if (depth === 0) return j + 1
        } else if (c === '"' || c === "'") {
            j++
            while (j < src.length && src[j] !== c) {
                if (src[j] === "\\") j++
                j++
            }
        } else if (c === "`") {
            j++
            while (j < src.length && src[j] !== "`") {
                if (src[j] === "\\") j++
                else if (src[j] === "$" && src[j + 1] === "{") j = readBalanced(src, j + 1) - 1
                j++
            }
        } else if (c === "/" && src[j + 1] === "/") {
            while (j < src.length && src[j] !== "\n") j++
        } else if (c === "/" && src[j + 1] === "*") {
            j = src.indexOf("*/", j + 2) + 1
        }
    }
    throw new Error("Unbalanced braces")
}

const skipWs = (src, i) => {
    while (i < src.length && /\s/.test(src[i])) i++
    return i
}

/** Parses the element that starts at src[i] === "<". Returns { el, end }. */
function parseElement(src, i) {
    let j = i + 1
    const tagMatch = /^[A-Za-z_][\w.:-]*/.exec(src.slice(j, j + 120))
    if (!tagMatch) throw new Error(`Not an element at ${i}`)
    const tag = tagMatch[0]
    j += tag.length
    const attrs = []
    for (;;) {
        j = skipWs(src, j)
        if (src[j] === "/" && src[j + 1] === ">") {
            return { el: { type: "el", tag, attrs, children: [], start: i, end: j + 2 }, end: j + 2 }
        }
        if (src[j] === ">") {
            j++
            break
        }
        if (src[j] === "{") {
            const end = readBalanced(src, j)
            attrs.push({ name: "...", kind: "spread", value: collapse(src.slice(j + 1, end - 1).replace(/^\s*\.\.\./, "")), raw: src.slice(j, end) })
            j = end
            continue
        }
        const attrStart = j
        const nameMatch = /^[A-Za-z_][\w:.-]*/.exec(src.slice(j, j + 120))
        if (!nameMatch) throw new Error(`Bad attribute near: ${src.slice(j, j + 40)}`)
        const name = nameMatch[0]
        j = skipWs(src, j + name.length)
        if (src[j] !== "=") {
            attrs.push({ name, kind: "bare", value: "true", raw: name })
            continue
        }
        j = skipWs(src, j + 1)
        if (src[j] === '"' || src[j] === "'") {
            const close = src.indexOf(src[j], j + 1)
            attrs.push({ name, kind: "str", value: src.slice(j + 1, close), raw: src.slice(attrStart, close + 1) })
            j = close + 1
        } else if (src[j] === "{") {
            const end = readBalanced(src, j)
            attrs.push({ name, kind: "expr", value: collapse(src.slice(j + 1, end - 1)), raw: src.slice(attrStart, end) })
            j = end
        } else {
            throw new Error(`Unsupported attribute value near: ${src.slice(j, j + 40)}`)
        }
    }
    const children = []
    for (;;) {
        let k = j
        while (k < src.length && src[k] !== "<" && src[k] !== "{") k++
        const text = collapse(src.slice(j, k))
        if (text) children.push({ type: "text", value: text })
        j = k
        if (src[j] === "{") {
            const end = readBalanced(src, j)
            const inner = collapse(src.slice(j + 1, end - 1))
            if (inner && !/^\/\*.*\*\/$/.test(inner)) children.push({ type: "expr", value: inner })
            j = end
        } else if (src[j] === "<") {
            if (src[j + 1] === "/") {
                j = src.indexOf(">", j) + 1
                break
            }
            const child = parseElement(src, j)
            children.push(child.el)
            j = child.end
        } else {
            throw new Error(`Unclosed <${tag}>`)
        }
    }
    return { el: { type: "el", tag, attrs, children, start: i, end: j }, end: j }
}

// ── Normalizing values ────────────────────────────────────────────

const GEOMETRY_ATTRS = new Set(["d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points"])
const INHERITED_ATTRS = new Set([
    "fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin", "strokeDasharray",
    "strokeDashoffset", "strokeMiterlimit", "strokeOpacity", "fillOpacity", "fillRule", "clipRule", "color",
])
const USAGE_ATTRS = new Set(["className", "width", "height", "style", "focusable", "id", "tabIndex", "role"])

const normName = (n) => {
    if (n === "class") return "className"
    if (/^(aria|data)-/.test(n)) return n
    return n.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

const roundNum = (n) => String(Number(Number(n).toFixed(2)))

const PATH_ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }
const NUMBER_AT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/

/**
 * Path data in one canonical spelling. Every segment gets its own command letter and absolute
 * coordinates (relative commands are resolved from the current point, H and V become L, an
 * implicit repeat becomes explicit, arc flags are read as single digits), numbers are rounded to
 * 2 decimals, and the separators are one space. Two paths that read the same here draw the same
 * shape, to within 0.005 of a grid unit. Returns null when the data is not plain path syntax.
 */
function normPath(d) {
    const out = []
    let i = 0
    let cmd = null
    let cx = 0
    let cy = 0
    let sx = 0
    let sy = 0
    const skip = () => {
        while (i < d.length && /[\s,]/.test(d[i])) i++
    }
    const pt = (x, y) => `${roundNum(x)} ${roundNum(y)}`
    for (;;) {
        skip()
        if (i >= d.length) break
        if (/[a-zA-Z]/.test(d[i])) {
            cmd = d[i++]
            if (!(cmd.toUpperCase() in PATH_ARITY)) return null
            if (cmd.toUpperCase() === "Z") {
                out.push("Z")
                cx = sx
                cy = sy
                cmd = null
            }
            continue
        }
        if (cmd === null) return null
        const kind = cmd.toUpperCase()
        const rel = cmd !== kind
        const a = []
        const flags = []
        for (let k = 0; k < PATH_ARITY[kind]; k++) {
            skip()
            if (kind === "A" && (k === 3 || k === 4)) {
                if (d[i] !== "0" && d[i] !== "1") return null
                flags.push(d[i++])
                a.push(Number(flags.at(-1)))
                continue
            }
            const m = NUMBER_AT.exec(d.slice(i))
            if (!m) return null
            a.push(Number(m[0]))
            i += m[0].length
        }
        // Offsets are measured from the point where the segment starts.
        const ox = rel ? cx : 0
        const oy = rel ? cy : 0
        if (kind === "M" || kind === "L" || kind === "T") {
            const x = a[0] + ox
            const y = a[1] + oy
            out.push(`${kind}${pt(x, y)}`)
            if (kind === "M") {
                sx = x
                sy = y
            }
            cx = x
            cy = y
        } else if (kind === "H") {
            cx = a[0] + ox
            out.push(`L${pt(cx, cy)}`)
        } else if (kind === "V") {
            cy = a[0] + oy
            out.push(`L${pt(cx, cy)}`)
        } else if (kind === "C") {
            out.push(`C${pt(a[0] + ox, a[1] + oy)} ${pt(a[2] + ox, a[3] + oy)} ${pt(a[4] + ox, a[5] + oy)}`)
            cx = a[4] + ox
            cy = a[5] + oy
        } else if (kind === "S" || kind === "Q") {
            out.push(`${kind}${pt(a[0] + ox, a[1] + oy)} ${pt(a[2] + ox, a[3] + oy)}`)
            cx = a[2] + ox
            cy = a[3] + oy
        } else {
            // A: radii and rotation do not move with the offset; only the end point does.
            out.push(`A${roundNum(a[0])} ${roundNum(a[1])} ${roundNum(a[2])} ${flags[0]} ${flags[1]} ${pt(a[5] + ox, a[6] + oy)}`)
            cx = a[5] + ox
            cy = a[6] + oy
        }
        // After the first pair, M and m repeat as L and l.
        if (kind === "M") cmd = rel ? "l" : "L"
    }
    return out.join(" ")
}

/** Rounds the numbers of a geometry attribute and removes the formatting. */
const normGeometry = (v, name) => {
    if (name === "d") {
        const p = normPath(v)
        if (p !== null) return p
    }
    if (!/^[\s\d.,+-]*$/.test(v)) return v
    return (v.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/g) ?? []).map(roundNum).join(" ")
}

/** One comparable string for an attribute value, whether it was written as "2", {2} or {"2"}. */
function normValue(attr, consts) {
    const v = attr.value
    if (attr.kind === "bare") return "true"
    if (attr.kind === "str") return v
    const quoted = /^(["'])(.*)\1$/.exec(v)
    if (quoted) return quoted[2]
    if (/^-?\d+(\.\d+)?$/.test(v)) return roundNum(v)
    if (v === "true") return "true"
    // A name that stands for a string constant of the same file reads as that string.
    if (consts?.has(v)) return consts.get(v)
    return `{${v}}`
}

/** The string constants a file declares: `const iconClass = "w-6 h-6"`. */
function constMap(src) {
    const out = new Map()
    for (const m of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*(["'])((?:(?!\2)[^\n\\])*)\2\s*(?:as const)?\s*(?:\n|;|$)/g)) out.set(m[1], m[3])
    return out
}

// ── From an <svg> element to a resolved signature ─────────────────

const isIgnoredAttr = (name) => name.startsWith("xmlns")

function nodeTree(nodes, inherited, rootStrokeWidth, consts) {
    const out = []
    for (const n of nodes) {
        if (n.type === "text") {
            out.push({ text: n.value })
            continue
        }
        if (n.type === "expr") {
            out.push({ expr: n.value })
            continue
        }
        if (n.tag === "title" || n.tag === "desc") continue
        const own = {}
        const eff = { ...inherited }
        for (const a of n.attrs) {
            if (a.kind === "spread") {
                own["..."] = a.value
                continue
            }
            const name = normName(a.name)
            if (isIgnoredAttr(name)) continue
            const value = normValue(a, consts)
            if (INHERITED_ATTRS.has(name)) eff[name] = value
            else own[name] = GEOMETRY_ATTRS.has(name) ? normGeometry(value, name) : value
        }
        const node = { tag: n.tag, own }
        const container = n.children.length > 0
        if (container) node.children = nodeTree(n.children, eff, rootStrokeWidth, consts)
        else {
            if (rootStrokeWidth === "$root" && eff.strokeWidth === inherited.strokeWidth) delete eff.strokeWidth
            else if (eff.strokeWidth === undefined && eff.stroke && eff.stroke !== "none") eff.strokeWidth = "1"
            node.eff = Object.fromEntries(Object.entries(eff).sort())
        }
        out.push(node)
    }
    return out
}

/**
 * attrs: Map of the final attributes of the root <svg> (names already normalized).
 * children: the drawing nodes. title: text of a <title> child, if any.
 */
function buildSignature(attrs, children, title, consts) {
    const inherited = {}
    const usage = {}
    const a11y = {}
    let viewBox
    for (const [name, value] of attrs) {
        if (isIgnoredAttr(name)) continue
        if (name === "viewBox") viewBox = value
        else if (INHERITED_ATTRS.has(name)) inherited[name] = value
        else if (name.startsWith("aria-")) a11y[name] = value
        else if (name === "role") a11y.role = value
        else if (USAGE_ATTRS.has(name)) usage[name] = value
        else usage[name] = value
    }
    if (title !== undefined) a11y.title = title
    if (usage.className === "") delete usage.className
    const strokeWidth = inherited.strokeWidth
    return {
        viewBox,
        className: usage.className,
        strokeWidth,
        a11y: Object.fromEntries(Object.entries(a11y).sort()),
        extra: Object.fromEntries(Object.entries(usage).filter(([k]) => k !== "className").sort()),
        tree: nodeTree(children, inherited, "actual", consts),
        // Same drawing, whatever stroke width the use asked for.
        drawing: { viewBox, base: Object.fromEntries(Object.entries(inherited).filter(([k]) => k !== "strokeWidth").sort()), tree: nodeTree(children, inherited, "$root", consts) },
    }
}

const stripGeometryOnly = (nodes) =>
    nodes.map((n) => (n.tag ? { tag: n.tag, own: Object.fromEntries(Object.entries(n.own).filter(([k]) => GEOMETRY_ATTRS.has(k))), children: n.children && stripGeometryOnly(n.children) } : n))

const stable = (obj) => JSON.stringify(obj)
const short = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8)

/** Signature of a raw <svg> element. */
function signatureOfSvg(el, consts) {
    const attrs = new Map()
    for (const a of el.attrs) {
        if (a.kind === "spread") attrs.set("...", a.value)
        else attrs.set(normName(a.name), normValue(a, consts))
    }
    const titleNode = el.children.find((c) => c.type === "el" && c.tag === "title")
    const title = titleNode ? titleNode.children.map((c) => c.value ?? "").join(" ") : undefined
    return buildSignature(attrs, el.children, title, consts)
}

// ── Reading files ─────────────────────────────────────────────────

function listSourceFiles(dir) {
    const out = []
    if (!fs.existsSync(dir)) return out
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) out.push(...listSourceFiles(path.join(dir, entry.name)))
        } else if (SOURCE_FILE.test(entry.name)) out.push(path.join(dir, entry.name))
    }
    return out
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length

/** True when the match at `index` sits on a comment line. */
function inComment(src, index) {
    const lineStart = src.lastIndexOf("\n", index) + 1
    const before = src.slice(lineStart, index)
    return /^\s*(\/\/|\*|\/\*)/.test(before) || /\/\/|\{\/\*/.test(before)
}

/** Every `<svg` in a file, parsed. */
function rawSvgSites(src, file, skipped) {
    const sites = []
    const re = /<svg(?=[\s/>])/g
    let m
    let last = 0
    while ((m = re.exec(src))) {
        if (m.index < last) continue
        if (inComment(src, m.index)) {
            skipped.push(`${rel(file)}:${lineOf(src, m.index)}`)
            continue
        }
        const { el, end } = parseElement(src, m.index)
        last = end
        sites.push({ kind: "svg", start: m.index, line: lineOf(src, m.index), el })
    }
    return sites
}

// ── Resolving icon components ─────────────────────────────────────

function loadIconIndex() {
    const index = new Map()
    const file = path.join(ICONS_DIR, "index.ts")
    if (!fs.existsSync(file)) return index
    const src = fs.readFileSync(file, "utf8")
    for (const m of src.matchAll(/export\s*\{([^}]+)\}\s*from\s*["']\.\/(\w+)["']/g)) {
        for (const spec of m[1].split(",").map((s) => s.trim()).filter(Boolean)) index.set(spec, path.join(ICONS_DIR, `${m[2]}.tsx`))
    }
    return index
}

/** Parameter names and defaults of an exported function: `({ a, b = 2, ...rest }: Props)`. */
function readProps(fnSrc) {
    const open = fnSrc.indexOf("(")
    const names = new Map()
    let restName
    const brace = skipWs(fnSrc, open + 1)
    if (fnSrc[brace] !== "{") {
        // `(props: IconProps)`: nothing is picked apart, everything is the rest.
        restName = /^[\w$]+/.exec(fnSrc.slice(brace))?.[0]
        return { names, restName }
    }
    const end = readBalanced(fnSrc, brace)
    const pattern = fnSrc.slice(brace + 1, end - 1)
    const parts = []
    let depth = 0
    let cur = ""
    for (const ch of pattern) {
        if ("{([".includes(ch)) depth++
        if ("})]".includes(ch)) depth--
        if (ch === "," && depth === 0) {
            parts.push(cur)
            cur = ""
        } else cur += ch
    }
    if (cur.trim()) parts.push(cur)
    for (const part of parts) {
        const p = part.trim()
        if (p.startsWith("...")) restName = p.slice(3).trim()
        else {
            const m = /^([\w$]+)\s*(?:=\s*([\s\S]+))?$/.exec(p)
            if (m) names.set(m[1], m[2] === undefined ? undefined : normValue({ kind: "expr", value: collapse(m[2]) }))
        }
    }
    return { names, restName }
}

function exportedFunction(src, name) {
    const re = new RegExp(`export\\s+(?:default\\s+)?function\\s+${name}\\b`)
    const m = re.exec(src)
    if (!m) throw new Error(`Component ${name} not found`)
    const rest = src.slice(m.index)
    const next = rest.slice(10).search(/\nexport\s/)
    return next === -1 ? rest : rest.slice(0, next + 10)
}

function returnedElement(fnSrc, name) {
    const returns = [...fnSrc.matchAll(/return\s*\(?\s*</g)]
    if (returns.length !== 1) throw new Error(`${name}: expected exactly one returned element, found ${returns.length}`)
    return parseElement(fnSrc, returns[0].index + returns[0][0].length - 1).el
}

const hasAny = (map, names) => names.some((n) => map.has(n))

/**
 * Applies a node's attributes to a props context.
 * ctx: { named: Map(name → value), rest: Map }. Returns Map of final attributes.
 */
function applyAttrs(attrs, ctx, { isBaseSvg = false } = {}) {
    const out = new Map()
    for (const a of attrs) {
        if (a.kind === "spread") {
            if (a.value === ctx.restName) for (const [k, v] of ctx.rest) out.set(k, v)
            else out.set("...", a.value)
            continue
        }
        const name = normName(a.name)
        if (name === "aria-hidden" && isBaseSvg && a.kind === "expr") {
            const decorative = !hasAny(ctx.passed, ["aria-label", "aria-labelledby", "role"])
            if (decorative) out.set("aria-hidden", "true")
            continue
        }
        if (a.kind === "expr" && /^[\w$]+$/.test(a.value) && ctx.slots.has(a.value)) {
            const v = ctx.slots.get(a.value)
            if (v !== undefined) out.set(name, v)
            continue
        }
        out.set(name, normValue(a))
    }
    return out
}

function makeCtx(fnSrc, passed) {
    const { names, restName } = readProps(fnSrc)
    const slots = new Map()
    for (const [n, def] of names) slots.set(n, passed.has(n) ? passed.get(n) : def)
    const rest = new Map([...passed].filter(([k]) => !names.has(k)))
    return { slots, rest, restName, passed }
}

/** Resolved signature of `<Name ...>` as the package component would render it. */
function resolveComponent(exportName, file, passed) {
    const src = fs.readFileSync(file, "utf8")
    const fn = exportedFunction(src, exportName)
    const root = returnedElement(fn, exportName)
    const ctx = makeCtx(fn, passed)

    if (root.tag === "svg") {
        const attrs = applyAttrs(root.attrs, ctx, { isBaseSvg: true })
        const titleNode = root.children.find((c) => c.type === "el" && c.tag === "title")
        return buildSignature(attrs, root.children, titleNode ? titleNode.children.map((c) => c.value ?? "").join(" ") : undefined)
    }

    const baseName = root.tag
    const basePath = path.join(ICONS_DIR, `${baseName}.tsx`)
    if (!fs.existsSync(basePath)) throw new Error(`${exportName}: base ${baseName} not found`)
    const baseSrc = fs.readFileSync(basePath, "utf8")
    const baseFn = exportedFunction(baseSrc, baseName)
    const baseProps = applyAttrs(root.attrs, ctx)
    const baseCtx = makeCtx(baseFn, baseProps)
    const baseSvg = [...baseFn.matchAll(/<svg(?=[\s/>])/g)].map((m) => parseElement(baseFn, m.index).el)[0]
    if (!baseSvg) throw new Error(`${baseName}: no <svg> found`)
    const attrs = applyAttrs(baseSvg.attrs, baseCtx, { isBaseSvg: true })
    return buildSignature(attrs, root.children)
}

/** Icon uses in a file: `<Name ...>` for every name imported from @wildgrove/ui/icons. */
function iconUseSites(src, file, index) {
    const names = new Map()
    for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']@wildgrove\/ui\/icons(?:\/(\w+))?["']/g)) {
        for (const spec of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
            if (spec.startsWith("type ")) continue
            const [exported, local] = spec.split(/\s+as\s+/)
            if (index.has(exported)) names.set(local ?? exported, exported)
        }
    }
    const sites = []
    if (!names.size) return sites
    const re = new RegExp(`<(${[...names.keys()].join("|")})(?=[\\s/>])`, "g")
    let m
    let last = 0
    while ((m = re.exec(src))) {
        if (m.index < last || inComment(src, m.index)) continue
        const { el, end } = parseElement(src, m.index)
        last = end
        const exported = names.get(m[1])
        sites.push({ kind: "icon", start: m.index, line: lineOf(src, m.index), el, exported })
    }
    return sites
}

// ── Collecting sites from the tree ────────────────────────────────

function collect({ resolve }) {
    const index = resolve ? loadIconIndex() : new Map()
    const files = new Map()
    const skipped = []
    const problems = []
    for (const dir of dirs) {
        for (const file of listSourceFiles(dir)) {
            const src = fs.readFileSync(file, "utf8")
            let sites
            try {
                sites = rawSvgSites(src, file, skipped)
                if (resolve) sites = [...sites, ...iconUseSites(src, file, index)].sort((a, b) => a.start - b.start)
            } catch (err) {
                problems.push(`${rel(file)}: ${err.message}`)
                continue
            }
            if (!sites.length) continue
            const records = []
            for (const s of sites) {
                try {
                    if (s.kind === "svg") {
                        const sig = signatureOfSvg(s.el, constMap(src))
                        records.push({ line: s.line, kind: "svg", sig, source: src.slice(s.el.start, s.el.end) })
                    } else {
                        const passed = new Map()
                        for (const a of s.el.attrs) {
                            if (a.kind === "spread") throw new Error(`<${s.el.tag}> spreads props, which cannot be resolved`)
                            passed.set(normName(a.name), normValue(a, constMap(src)))
                        }
                        const sig = resolveComponent(s.exported, index.get(s.exported), passed)
                        records.push({ line: s.line, kind: "icon", component: s.exported, sig })
                    }
                } catch (err) {
                    // Kept on the record: it only matters if the site is one that gets compared.
                    records.push({ line: s.line, kind: s.kind, component: s.exported, error: err.message })
                }
            }
            files.set(rel(file), records)
        }
    }
    return { files, skipped, problems }
}

// ── Reports ───────────────────────────────────────────────────────

function summarize(files) {
    const all = [...files.values()].flat()
    const raw = all.filter((r) => r.kind === "svg")
    const drawings = new Set(raw.map((r) => stable(r.sig.drawing)))
    return {
        uses: raw.length,
        files: new Set([...files].filter(([, rs]) => rs.some((r) => r.kind === "svg")).map(([f]) => f)).size,
        drawings: drawings.size,
    }
}

function printList() {
    const { files, skipped, problems } = collect({ resolve: false })
    const s = summarize(files)
    for (const [file, records] of [...files].sort()) console.log(`${String(records.length).padStart(4)}  ${file}`)
    console.log(`\n<svg> written by hand: ${s.uses} uses, ${s.files} files, ${s.drawings} distinct drawings`)
    if (skipped.length) console.log(`Skipped (in comments): ${skipped.join(", ")}`)
    if (problems.length) console.log(`\nCould not read:\n  ${problems.join("\n  ")}`)
    return problems.length ? 1 : 0
}

function printGroups() {
    const { files, problems } = collect({ resolve: false })
    const groups = new Map()
    for (const [file, records] of files) {
        for (const r of records) {
            const key = stable(r.sig.drawing)
            if (!groups.has(key)) groups.set(key, { id: short(key), viewBox: r.sig.viewBox, uses: [], sig: r.sig })
            groups.get(key).uses.push({ file, line: r.line, className: r.sig.className, strokeWidth: r.sig.strokeWidth })
        }
    }
    const sorted = [...groups.values()].sort((a, b) => b.uses.length - a.uses.length)
    console.log(stable(sorted.map((g) => ({ id: g.id, count: g.uses.length, viewBox: g.viewBox, base: g.sig.drawing.base, tree: g.sig.drawing.tree, uses: g.uses }))))
    if (problems.length) console.error(`Could not read:\n  ${problems.join("\n  ")}`)
}

function printSimilar() {
    const { files } = collect({ resolve: false })
    const byGeometry = new Map()
    for (const [file, records] of files) {
        for (const r of records) {
            const geo = stable({ viewBox: r.sig.viewBox, tree: stripGeometryOnly(r.sig.drawing.tree) })
            const draw = stable(r.sig.drawing)
            if (!byGeometry.has(geo)) byGeometry.set(geo, new Map())
            const inner = byGeometry.get(geo)
            if (!inner.has(draw)) inner.set(draw, { id: short(draw), uses: 0, example: `${file}:${r.line}` })
            inner.get(draw).uses++
        }
    }
    let pairs = 0
    for (const inner of byGeometry.values()) {
        if (inner.size < 2) continue
        pairs++
        console.log(`Same geometry, ${inner.size} variants:`)
        for (const v of inner.values()) console.log(`  ${v.id}  ${v.uses} uses  e.g. ${v.example}`)
    }
    console.log(`\n${pairs} groups of drawings share geometry and differ in something else.`)
}

function saveBaseline() {
    if (fs.existsSync(baselinePath) && !flag("--force")) {
        console.error(`${rel(baselinePath)} already exists. The baseline is the picture from before any change; it is not regenerated. Use --force only if you know why.`)
        return 1
    }
    const { files, skipped, problems } = collect({ resolve: false })
    if (problems.length) {
        console.error(`Could not read:\n  ${problems.join("\n  ")}`)
        return 1
    }
    const s = summarize(files)
    let commit = "unknown"
    try {
        commit = execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim()
    } catch {
        /* not a git checkout */
    }
    const out = {
        meta: { createdAt: new Date().toISOString(), commit, dirs: dirs.map(rel), uses: s.uses, files: s.files, drawings: s.drawings, skippedInComments: skipped },
        files: Object.fromEntries([...files].sort().map(([f, rs]) => [f, rs.map((r) => ({ line: r.line, source: r.source }))])),
    }
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
    fs.writeFileSync(baselinePath, JSON.stringify(out, null, 1))
    console.log(`Baseline saved to ${rel(baselinePath)} (commit ${commit}): ${s.uses} uses, ${s.files} files, ${s.drawings} distinct drawings.`)
    if (skipped.length) console.log(`Skipped (in comments): ${skipped.join(", ")}`)
    return 0
}

/** Lists the paths where two JSON values differ. */
function diff(a, b, at = "") {
    if (stable(a) === stable(b)) return []
    const isObj = (x) => x && typeof x === "object"
    if (!isObj(a) || !isObj(b) || Array.isArray(a) !== Array.isArray(b)) return [`${at || "(root)"}: ${stable(a)} → ${stable(b)}`]
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].flatMap((k) => diff(a[k], b[k], at ? `${at}.${k}` : k))
}

/** Same signature once the tolerated aria-hidden addition is set aside. Returns { diffs, addedHidden }. */
function compareSig(before, after) {
    const b = JSON.parse(stable(before))
    const a = JSON.parse(stable(after))
    delete b.drawing
    delete a.drawing
    let addedHidden = false
    if (a.a11y["aria-hidden"] === "true" && b.a11y["aria-hidden"] === undefined) {
        delete a.a11y["aria-hidden"]
        addedHidden = true
    }
    return { diffs: diff(b, a), addedHidden }
}

const SEP = "\n      "
const NL = "\n"
const oldCache = new Map()
const oldSourceCache = new Map()

/** A file's text at the baseline commit, or "" when it did not exist then. */
function sourceAtBaseline(file, commit) {
    if (!oldSourceCache.has(file)) {
        let src = ""
        try {
            src = execFileSync("git", ["show", `${commit}:${file}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 })
        } catch {
            /* the file did not exist at that commit */
        }
        oldSourceCache.set(file, src)
    }
    return oldSourceCache.get(file)
}

/**
 * What a file looked like at the baseline commit: its <svg> and icon uses in source order.
 * Icon uses that already existed then are not in the baseline, so they have to be told apart.
 */
function sitesAtBaseline(file, commit, index) {
    if (oldCache.has(file)) return oldCache.get(file)
    let seq = []
    const src = sourceAtBaseline(file, commit)
    if (src) {
        const abs = path.join(ROOT, file)
        const sites = [...rawSvgSites(src, abs, []), ...iconUseSites(src, abs, index)].sort((x, y) => x.start - y.start)
        seq = sites.map((s) => (s.kind === "svg" ? { kind: "svg" } : { kind: "icon", component: s.exported }))
    }
    oldCache.set(file, seq)
    return seq
}

/** Comparable key of a signature, without the aria-hidden the bases add. */
function sigKey(sig) {
    const s = JSON.parse(stable(sig))
    delete s.drawing
    if (s.a11y["aria-hidden"] === "true") delete s.a11y["aria-hidden"]
    return stable(s)
}

/** True when both sides have the same signatures, each the same number of times. */
function sameMultiset(sites, records) {
    const count = new Map()
    for (const s of sites) count.set(sigKey(s.sig), (count.get(sigKey(s.sig)) ?? 0) + 1)
    for (const r of records) {
        const k = sigKey(r.sig)
        if (!count.get(k)) return false
        count.set(k, count.get(k) - 1)
    }
    return [...count.values()].every((n) => n === 0)
}

/** Returns "" when both sides draw the same set of icons, or a sentence saying what is missing or extra. */
function compareAsSets(sites, seq, records) {
    if (seq.some((e) => e.kind === "icon")) return "It also holds icons that existed before, so it cannot be compared as a set."
    const bad = records.find((r) => r.error)
    if (bad) return `${bad.line}: ${bad.error}`
    const before = new Set(sites.map((s) => sigKey(s.sig)))
    const after = new Set(records.map((r) => sigKey(r.sig)))
    const missing = sites.filter((s) => !after.has(sigKey(s.sig)))
    const extra = records.filter((r) => !before.has(sigKey(r.sig)))
    if (!missing.length && !extra.length) return ""
    return [...missing.map((s) => `Not drawn any more: line ${s.line} of the baseline.`), ...extra.map((r) => `Not in the baseline: line ${r.line}${r.component ? ` (${r.component})` : ""}.`)].join(" ")
}

function compareBaseline() {
    if (!fs.existsSync(baselinePath)) {
        console.error(`No baseline at ${rel(baselinePath)}. Run --baseline before changing anything.`)
        return 1
    }
    const base = JSON.parse(fs.readFileSync(baselinePath, "utf8"))
    // The baseline keeps the original text of every <svg>, so a fix to the script never needs a new baseline.
    for (const [file, sites] of Object.entries(base.files)) {
        const consts = constMap(sourceAtBaseline(file, base.meta.commit))
        for (const s of sites) s.sig = signatureOfSvg(parseElement(s.source, 0).el, consts)
    }
    const index = loadIconIndex()
    const { files: now, problems } = collect({ resolve: true })
    const limit = flag("--verbose") ? Infinity : 4
    const failures = []
    let paired = 0
    let addedHidden = 0
    const retired = []
    const extras = []
    const inlined = []
    const reordered = []
    const unused = []
    const label = (file, r) => `${file}:${r.line}${r.component ? ` (${r.component})` : ""}`

    for (const [file, sites] of Object.entries(base.files)) {
        const current = now.get(file)
        if (!current && !fs.existsSync(path.join(ROOT, file))) {
            retired.push(...sites.map((s) => ({ file, line: s.line, sig: s.sig })))
            continue
        }
        const seq = sitesAtBaseline(file, base.meta.commit, index)
        if (seq.filter((e) => e.kind === "svg").length !== sites.length) {
            failures.push(`${file}: the baseline commit and the baseline file disagree on how many <svg> it had`)
            continue
        }
        const records = current ?? []
        if (records.length !== seq.length) {
            // A local helper that wrapped one <svg> and was removed leaves several uses where there was one.
            // The two sides are then compared as sets: every drawing the file had is still drawn, and
            // nothing is drawn that it did not have.
            const problem = compareAsSets(sites, seq, records)
            if (problem) failures.push(`${file}: ${seq.length} icons at the baseline, ${records.length} now. ${problem}`)
            else {
                paired += sites.length
                inlined.push(file)
            }
            continue
        }
        let j = 0
        const here = []
        let hidden = 0
        seq.forEach((entry, i) => {
            const rec = records[i]
            if (entry.kind === "icon") {
                if (rec.kind !== "icon" || rec.component !== entry.component) here.push(`${label(file, rec)}: an icon that already existed at the baseline (${entry.component}) changed`)
                return
            }
            const before = sites[j++]
            paired++
            if (rec.error) {
                here.push(`${label(file, rec)}: ${rec.error}`)
                return
            }
            const { diffs, addedHidden: h } = compareSig(before.sig, rec.sig)
            if (h) hidden++
            if (diffs.length) {
                const more = diffs.length > limit ? `${SEP}… ${diffs.length - limit} more` : ""
                here.push(`${label(file, rec)} was line ${before.line}${SEP}${diffs.slice(0, limit).join(SEP)}${more}`)
            }
        })
        // Uses that moved around in the file (a helper replaced by uses somewhere else) are checked as a multiset:
        // the same signatures the same number of times.
        if (here.length && !seq.some((e) => e.kind === "icon") && !records.some((r) => r.error) && sameMultiset(sites, records)) {
            reordered.push(file)
            addedHidden += hidden
            continue
        }
        failures.push(...here)
        addedHidden += hidden
    }

    // Files that were not in the baseline hold only uses that did not exist before, plus the ones that did.
    for (const [file, records] of now) {
        if (file in base.files) continue
        const left = [...records]
        for (const o of sitesAtBaseline(file, base.meta.commit, index)) {
            const k = left.findIndex((r) => r.kind === "icon" && r.component === o.component)
            if (k >= 0) left.splice(k, 1)
        }
        extras.push(...left.map((r) => ({ file, ...r })))
    }

    // A file retired from the tree: each of its drawings must still be drawn by some new use.
    let movedOk = 0
    for (const r of retired) {
        const hit = extras.find((e) => e.sig && !compareSig(r.sig, e.sig).diffs.length)
        if (hit) {
            movedOk++
            continue
        }
        // A drawing nobody uses any more still has to exist in the package, as the same component with the same props.
        const component = [...index].find(([name, file]) => {
            try {
                const passed = new Map()
                if (r.sig.className !== undefined) passed.set("className", r.sig.className)
                if (r.sig.strokeWidth !== undefined) passed.set("strokeWidth", r.sig.strokeWidth)
                return !compareSig(r.sig, resolveComponent(name, file, passed)).diffs.length
            } catch {
                return false
            }
        })
        if (component) {
            movedOk++
            unused.push(`${r.file}:${r.line} → ${component[0]}`)
        } else failures.push(`${r.file}:${r.line} was removed and no new use draws the same thing`)
    }
    for (const e of extras) {
        if (e.error) failures.push(`${label(e.file, e)}: ${e.error}`)
        else if (!retired.some((r) => !compareSig(r.sig, e.sig).diffs.length)) failures.push(`${label(e.file, e)} is a new icon use that matches nothing in the baseline`)
    }

    const remaining = [...now.values()].flat().filter((r) => r.kind === "svg").length
    const migrated = base.meta.uses - remaining
    console.log(`Baseline: ${base.meta.uses} uses in ${base.meta.files} files (commit ${base.meta.commit}).`)
    console.log(`Now: ${remaining} still written by hand, ${migrated} moved to a component.`)
    console.log(`Compared ${paired} uses` + (retired.length ? `, and ${movedOk} of ${retired.length} from files that no longer exist` : "") + ".")
    if (unused.length) console.log(`Drawn by a package component that nothing uses: ${unused.join(", ")}.`)
    if (reordered.length) console.log(`Compared as multisets, because the uses moved inside the file: ${reordered.join(", ")}.`)
    if (inlined.length) console.log(`Compared as sets, because a local helper was inlined: ${inlined.join(", ")}.`)
    if (addedHidden) console.log(`aria-hidden added by the base to ${addedHidden} uses that had none (expected, decorative).`)
    if (problems.length) failures.push(...problems.map((p) => `Could not read ${p}`))
    if (failures.length) {
        console.log(`${NL}${failures.length} DIFFERENCES:`)
        for (const f of failures) console.log(`  ${f}`)
        return 1
    }
    console.log("No differences.")
    return 0
}

// ── Main ──────────────────────────────────────────────────────────

export { parseElement, signatureOfSvg, rawSvgSites, normName, normValue, constMap, stable, short, ROOT, ICONS_DIR }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    let code
    if (flag("--baseline")) code = saveBaseline()
    else if (flag("--compare")) code = compareBaseline()
    else if (flag("--groups")) code = printGroups() ?? 0
    else if (flag("--similar")) code = printSimilar() ?? 0
    else code = printList()
    process.exit(code)
}
