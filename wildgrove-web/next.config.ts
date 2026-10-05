import path from "node:path"
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

// The backend's origin comes from the variable the browser client already
// uses, so a clone pointed at another InsForge gets a policy that allows it.
// It is read when the config loads: at build time in CI, from .env.local in
// development.
const backendUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ? new URL(process.env.NEXT_PUBLIC_INSFORGE_URL) : null
const backend = backendUrl?.origin ?? ""
const backendSocket = backendUrl ? `${backendUrl.protocol === "https:" ? "wss:" : "ws:"}//${backendUrl.host}` : ""
const sources = (...list: string[]) => list.filter(Boolean).join(" ")

// ── Content Security Policy ─────────────────────────────────────
// Tuned for: Next.js inline runtime, InsForge (REST + Storage),
// Google Maps (@vis.gl/react-google-maps), Google avatars. Enforced: the
// browser blocks anything not listed here, so a new third-party source has to
// be added before the feature that loads it ships.
const csp = [
  "default-src 'self'",
  // Google Maps (the map, its markers and Places autocomplete) needs the
  // sources in Google's own CSP guide for the Maps JavaScript API, including
  // blob: workers for vector maps.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src ${sources("'self' data: blob:", backend)} https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com https://*.ggpht.com https://github.com https://avatars.githubusercontent.com`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src ${sources("'self'", backend, backendSocket)} https://*.googleapis.com https://*.google.com https://*.gstatic.com data: blob:`,
  "worker-src 'self' blob:",
  // The contact page embeds a Google Maps iframe, which also falls under
  // *.google.com.
  "frame-src 'self' https://*.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), geolocation=(self)",
  },
  { key: "Content-Security-Policy", value: csp },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle: `.next/standalone` carries the server
  // and only the traced dependencies, so the container image does not ship the
  // full node_modules tree. This is what makes the image small enough to pull
  // on every deploy.
  output: "standalone",
  // Workspace packages ship raw TypeScript — Next must compile them itself.
  transpilePackages: ["@wildgrove/db", "@wildgrove/core", "@wildgrove/ui"],
  // The app lives in a workspace; trace from the repo root so files pulled from
  // packages/* are found, and copy the HTML email templates and the PDF fonts
  // into the bundle — they are read at runtime by @wildgrove/core, which
  // tracing cannot infer.
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  outputFileTracingIncludes: {
    "/**/*": [
      "../packages/core/emails/templates/**/*",
      "../packages/core/pdf/fonts/**/*",
    ],
  },
  // Static generation runs in CI against a throwaway Postgres, not against the
  // production database, so this cap is about the build machine's memory rather
  // than about connection limits. It is set explicitly because the observed
  // worker count did not match the declared one.
  experimental: {
    // app/global-not-found.tsx: a branded 404 with a real 404 status for URLs
    // that match no route, rendered outside every layout. See that file.
    globalNotFound: true,
    staticGenerationMaxConcurrency: 2,
    staticGenerationMinPagesPerWorker: 50,
    staticGenerationRetryCount: 2,
  },
  // Keep heavy server-only libs out of the bundling step. They are required at
  // runtime from node_modules instead, which keeps the build faster and leaves
  // their native and dynamic requires intact.
  serverExternalPackages: ["@react-pdf/renderer", "openai", "nodemailer"],
  // `next dev` writes wildgrove-web/AGENTS.md and CLAUDE.md and re-adds them on
  // every run. This repository keeps every agent rule in wildgrove-vault/rules/
  // and treats the two root pointer files as the only entry points
  // (wildgrove-vault/rules/03-never-do.md, item 9), so a second pair one
  // directory down is exactly the drift that rule exists to prevent. Flip to
  // re-enable.
  agentRules: false,
  // Public pages lived at unprefixed paths before locale routing. Left to
  // next-intl, /terms answers 307 to whichever locale Accept-Language picks,
  // and a temporary redirect tells a search engine to keep the old URL. These
  // are permanent and fixed to the default locale; only "/" still negotiates.
  async redirects() {
    return ["/menu", "/menu/:slug", "/reservations", "/about", "/contact", "/privacy", "/terms"].map(
      (source) => ({ source, destination: `/en${source}`, permanent: true })
    )
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.wildgrove.cv",
        pathname: "/api/storage/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
        pathname: "/*.png",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
}

export default withNextIntl(nextConfig)
