import path from "node:path"
import type { NextConfig } from "next"

// The backend's origin comes from the variable the browser client already
// uses, so a clone pointed at another InsForge gets a policy that allows it.
// It is read when the config loads: at build time in CI, from .env.local in
// development.
const backendUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ? new URL(process.env.NEXT_PUBLIC_INSFORGE_URL) : null
const backend = backendUrl?.origin ?? ""
const backendSocket = backendUrl ? `${backendUrl.protocol === "https:" ? "wss:" : "ws:"}//${backendUrl.host}` : ""
const sources = (...list: string[]) => list.filter(Boolean).join(" ")

// ── Content Security Policy ─────────────────────────────────────
// Same baseline as wildgrove-web, and enforced like it. The Google Maps
// entries stay: admin settings and the delivery-zone editor both mount
// `MapPicker`.
const csp = [
  "default-src 'self'",
  // Google Maps (the map, its markers and Places autocomplete) needs the
  // sources in Google's own CSP guide for the Maps JavaScript API, including
  // blob: workers for vector maps.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src ${sources("'self' data: blob:", backend)} https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com https://*.ggpht.com`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src ${sources("'self'", backend, backendSocket)} https://*.googleapis.com https://*.google.com https://*.gstatic.com data: blob:`,
  "worker-src 'self' blob:",
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
  // The whole host is private. On wildgrove-web this was only page metadata in
  // app/admin/layout.tsx; here it is a header, so it also covers API routes,
  // PDFs and anything else served from this origin.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
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
  // Same explicit cap as the storefront. Builds run in CI against a throwaway
  // Postgres and one at a time, so this bounds the build machine's memory.
  experimental: {
    staticGenerationMaxConcurrency: 2,
    staticGenerationMinPagesPerWorker: 50,
    staticGenerationRetryCount: 2,
  },
  // The CMS renders order PDFs and sends ticket-reply emails.
  serverExternalPackages: ["@react-pdf/renderer", "nodemailer"],
  // `next dev` writes wildgrove-cms/AGENTS.md and CLAUDE.md and re-adds them on
  // every run. This repository keeps every agent rule in wildgrove-vault/rules/
  // and treats the two root pointer files as the only entry points
  // (wildgrove-vault/rules/03-never-do.md, item 9), so a second pair one
  // directory down is exactly the drift that rule exists to prevent. Flip to
  // re-enable.
  agentRules: false,
  // Bookmarks, emails and notification rows can still point at /admin/… on this
  // host, and the panel lives at the root. Client-side
  // router.push does not hit these; those paths are stripped in cmsPanelPath.
  async redirects() {
    return [
      { source: "/admin", destination: "/", permanent: true },
      { source: "/admin/:path*", destination: "/:path*", permanent: true },
      { source: "/api/admin/:path*", destination: "/api/:path*", permanent: true },
      // Dish-review notifications were stored with this path, and the panel
      // has no such page: dish reviews are a tab of /reviews.
      { source: "/product-reviews", destination: "/reviews", permanent: true },
    ]
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
    ],
  },
}

export default nextConfig
