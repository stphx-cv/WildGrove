#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// Sage decisions evaluation. Runs the cases in cases.mjs against the
// decision model for real, with the same state, questions and rules as
// the storefront, and shows per case and in total what the model answered,
// which steps the rules chose and whether they match.
//
//   node scripts/sage-decisions-eval/run.mjs
//   node scripts/sage-decisions-eval/run.mjs --windows 6,10,20
//   node scripts/sage-decisions-eval/run.mjs --only two-1,two-3 --json /tmp/eval.json
//
// It reads OPENROUTER_API_KEY and DATABASE_URL from wildgrove-web/.env.local
// unless they are already set, and the dishes from that database. Each run
// is one call per case (about 86, a cent or two of a dollar). Loads
// packages/core with jiti, which the workspace already has installed.
//
// Passes when the chosen steps are right in at least 95% of the cases and
// in every case of two requests, no dish that does not fit reaches the
// threshold, and at least 9 of every 10 dishes that fit do.
// ══════════════════════════════════════════════════════════════════

import { existsSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createJiti } from "jiti"
import { CASES } from "./cases.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const envFile = path.join(root, "wildgrove-web", ".env.local")
if (!process.env.OPENROUTER_API_KEY && existsSync(envFile)) process.loadEnvFile(envFile)
if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is not set.")
  process.exit(1)
}

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}
const windows = (flag("windows") ?? "").split(",").filter(Boolean).map(Number)
const only = new Set((flag("only") ?? "").split(",").filter(Boolean))
const jsonOut = flag("json")
const concurrency = Number(flag("concurrency") ?? 6)

const jiti = createJiti(import.meta.url)
const core = (file) => jiti.import(path.join(root, "packages", "core", file))
const { askJev } = await core("chat/decide/jev-client.ts")
const { buildJevState, DECISION_HISTORY_WINDOW } = await core("chat/decide/state.ts")
const { buildJevQuestions, loadDecisionDishes, wantsQuestionId, REQUEST_INTENTS, dishQuestionId } = await core("chat/decide/questions.ts")
const { planResponse, stepLabel, DISH_THRESHOLD } = await core("chat/decide/plan-response.ts")
const { detectMessageLanguage } = await core("chat/detect-language.ts")
const { DEFAULT_SAGE_DECISION_MODEL } = await core("chat/chat-settings.ts")
const model = flag("model") ?? DEFAULT_SAGE_DECISION_MODEL

const dishesByLanguage = { es: await loadDecisionDishes("es"), en: await loadDecisionDishes("en") }
const knownSlugs = new Set(dishesByLanguage.es.map((dish) => dish.slug))

function sameSteps(a, b) {
  return a.length === b.length && a.every((step, i) => step === b[i])
}

async function runCase(testCase, window) {
  const language = detectMessageLanguage(testCase.message, "es")
  const dishes = dishesByLanguage[language]
  const state = buildJevState({ currentMessage: testCase.message, turns: testCase.conversation ?? [], window })
  const jev = await askJev(state, buildJevQuestions(dishes), model, { timeoutMs: 8000 })
  const plan = planResponse({ answers: jev.ok ? jev.answers : null, dishes, mode: "mixed" })
  const got = plan.steps.map(stepLabel)
  const accepted = testCase.paths ?? [testCase.path]
  const countOk = !("count" in testCase) || (plan.menuLimit ?? null) === testCase.count
  const pathOk = accepted.some((expected) => sameSteps(expected, got)) && countOk

  // Dishes: every one scored against the case's yes and maybe lists.
  let dishReport = null
  if (testCase.dishes && jev.ok) {
    const yes = new Set(testCase.dishes.yes)
    const maybe = new Set(testCase.dishes.maybe ?? [])
    const scored = dishes.map((dish, index) => ({ slug: dish.slug, p: jev.answers[dishQuestionId(index)]?.noul ?? 0 }))
    dishReport = {
      falsePositives: scored.filter((d) => !yes.has(d.slug) && !maybe.has(d.slug) && d.p >= DISH_THRESHOLD),
      hits: scored.filter((d) => yes.has(d.slug) && d.p >= DISH_THRESHOLD),
      misses: scored.filter((d) => yes.has(d.slug) && d.p < DISH_THRESHOLD),
    }
  }

  const wants = Object.fromEntries(
    REQUEST_INTENTS.map((intent) => [intent, jev.ok ? jev.answers[wantsQuestionId(intent)]?.noul ?? 0 : null]),
  )
  return {
    id: testCase.id,
    group: testCase.group,
    message: testCase.message,
    expected: accepted.map((p) => p.join(" + ")).join("  |  "),
    got: got.join(" + "),
    pathOk,
    jevOk: jev.ok,
    via: jev.ok ? jev.via : null,
    ms: jev.ms,
    costUsd: jev.ok ? jev.costUsd ?? 0 : 0,
    intent: jev.ok ? jev.answers.intent : null,
    order: jev.ok ? jev.answers.order?.choice : null,
    menuScope: jev.ok ? jev.answers.menu_scope?.choice : null,
    menuLimit: plan.menuLimit,
    countOk,
    wants,
    dishReport,
  }
}

async function runAll(window) {
  const cases = CASES.filter((c) => (only.size === 0 || only.has(c.id)))
  const skipped = cases.filter((c) => {
    const slugs = [...(c.dishes?.yes ?? []), ...(c.dishes?.maybe ?? [])]
    return slugs.some((slug) => !knownSlugs.has(slug))
  })
  const runnable = cases.filter((c) => !skipped.includes(c))
  const results = []
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, runnable.length) }, async () => {
      while (next < runnable.length) {
        const testCase = runnable[next++]
        results.push(await runCase(testCase, window))
      }
    }),
  )
  results.sort((a, b) => runnable.findIndex((c) => c.id === a.id) - runnable.findIndex((c) => c.id === b.id))
  return { window, results, skipped: skipped.map((c) => c.id) }
}

function fmt(p) {
  return p === null || p === undefined ? "—" : p.toFixed(2)
}

function summarize({ window, results, skipped }) {
  console.log(`\n══ Window: ${window} messages · model ${model} ══`)
  for (const r of results) {
    const mark = r.pathOk ? "✓" : "✗"
    const wantsTop = Object.entries(r.wants)
      .filter(([, p]) => p !== null && p >= 0.2)
      .sort((a, b) => b[1] - a[1])
      .map(([intent, p]) => `${intent} ${fmt(p)}`)
      .join(", ")
    const dishNote = r.dishReport
      ? ` · dishes ✓${r.dishReport.hits.length}` +
        (r.dishReport.misses.length ? ` missed ${r.dishReport.misses.map((d) => `${d.slug} ${fmt(d.p)}`).join(", ")}` : "") +
        (r.dishReport.falsePositives.length ? ` WRONG ${r.dishReport.falsePositives.map((d) => `${d.slug} ${fmt(d.p)}`).join(", ")}` : "")
      : ""
    console.log(
      `${mark} ${r.id.padEnd(32)} ${r.pathOk ? r.got : `got ${r.got || "(nothing)"} · expected ${r.expected}`}` +
        `${r.countOk ? "" : ` · count ${r.menuLimit ?? "none"}`}` +
        `  [${r.jevOk ? `${r.via} ${r.ms}ms` : "NO ANSWER"} · intent ${r.intent?.choice ?? "—"} · order ${r.order ?? "—"} · scope ${r.menuScope ?? "—"} · yes: ${wantsTop}]${dishNote}`,
    )
  }
  const total = results.length
  const right = results.filter((r) => r.pathOk).length
  const two = results.filter((r) => r.group === "two")
  const twoRight = two.filter((r) => r.pathOk).length
  const withDishes = results.filter((r) => r.dishReport)
  const falsePositives = withDishes.flatMap((r) => r.dishReport.falsePositives.map((d) => `${r.id}:${d.slug}`))
  const hits = withDishes.reduce((n, r) => n + r.dishReport.hits.length, 0)
  const expectedHits = withDishes.reduce((n, r) => n + r.dishReport.hits.length + r.dishReport.misses.length, 0)
  const recall = expectedHits ? hits / expectedHits : 1
  const accuracy = total ? right / total : 0
  const cost = results.reduce((n, r) => n + r.costUsd, 0)
  const times = results.filter((r) => r.jevOk).map((r) => r.ms).sort((a, b) => a - b)
  const median = times.length ? times[Math.floor(times.length / 2)] : 0
  const passed = accuracy >= 0.95 && twoRight === two.length && falsePositives.length === 0 && recall >= 0.9

  console.log(`\nSteps right: ${right}/${total} (${(accuracy * 100).toFixed(1)}%) · two requests: ${twoRight}/${two.length}`)
  console.log(`Dishes that fit and reached ${DISH_THRESHOLD}: ${hits}/${expectedHits} (${(recall * 100).toFixed(1)}%) · dishes that do not fit and reached it: ${falsePositives.length}${falsePositives.length ? ` (${falsePositives.join(", ")})` : ""}`)
  console.log(`No answer: ${results.filter((r) => !r.jevOk).length} · median ${median} ms · cost ${cost.toFixed(5)} USD`)
  if (skipped.length) console.log(`Skipped, dish not in the database: ${skipped.join(", ")}`)
  console.log(passed ? "PASSES the threshold" : "Does NOT pass the threshold")
  return { window, total, right, accuracy, twoRight, twoTotal: two.length, falsePositives, recall, cost, median, passed }
}

const runs = []
for (const window of windows.length ? windows : [DECISION_HISTORY_WINDOW]) {
  const run = await runAll(window)
  runs.push({ ...run, summary: summarize(run) })
}
if (runs.length > 1) {
  console.log("\n══ Windows ══")
  for (const run of runs) {
    const s = run.summary
    console.log(`${String(run.window).padStart(3)} messages: ${s.right}/${s.total} steps · two ${s.twoRight}/${s.twoTotal} · wrong dishes ${s.falsePositives.length} · recall ${(s.recall * 100).toFixed(1)}% · ${s.passed ? "passes" : "fails"}`)
  }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(runs, null, 2))
process.exit(runs.every((run) => run.summary.passed) ? 0 : 2)
