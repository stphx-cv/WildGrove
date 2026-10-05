# syntax=docker/dockerfile:1

# ══════════════════════════════════════════════════════════════════
# Admin panel image.
#
# The build shares its dependency install with the storefront; runtime keeps what is
# needed to run. The build never reaches the production database — see the
# DATABASE_URL note below.
# ══════════════════════════════════════════════════════════════════

# ── Dependencies shared by both applications ────────────────────
FROM node:24-alpine AS deps

# The repository pins npm in `packageManager`, and .npmrc uses settings that
# only npm 11 understands (`min-release-age`, `allow-remote`). An older npm
# ignores unknown keys silently, so building with the npm that ships in this
# base image would install the tree with the supply-chain policy switched off
# and say nothing. Pin it, and fail loudly if the pin did not take.
ARG NPM_VERSION=11.19.0
RUN npm install -g "npm@${NPM_VERSION}" \
 && test "$(npm -v)" = "${NPM_VERSION}" \
 || { echo "npm is $(npm -v), expected ${NPM_VERSION}" >&2; exit 1; }

WORKDIR /repo

# Manifests before sources: an edit that touches no dependency reuses this layer.
# `npm ci` runs at the root because there is one lockfile for the whole workspace.
COPY .npmrc package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
COPY wildgrove-web/package.json wildgrove-web/
COPY wildgrove-cms/package.json wildgrove-cms/
RUN for setting in ignore-scripts:true min-release-age:7 allow-git:none allow-remote:root; do \
      key=${setting%%:*}; expected=${setting#*:}; actual=$(npm config get "$key"); \
      [ "$actual" = "$expected" ] || { echo "npm config $key is '$actual', expected '$expected'" >&2; exit 1; }; \
    done \
 && npm ci

FROM deps AS build

COPY . .

# The panel's own pages are rendered on demand behind the role guard, so this
# build needs the database only for what the shared packages touch while
# compiling. It is given the same throwaway PostgreSQL as the storefront, never
# the production one.
#
# This image never runs migrations. Only the storefront migrates, so that two
# deploys cannot compete for the same migration lock. See
# wildgrove-vault/rules/03-never-do.md, item 10.
ARG DATABASE_URL
ARG DIRECT_URL

# Next inlines every NEXT_PUBLIC_* value into the JavaScript it sends to the
# browser, so these are decided here and not at startup: the same image cannot
# later be pointed at a different backend without rebuilding it. They are not
# secrets — anyone can read them in the client bundle — but they do have to be
# the real values, or the browser talks to the wrong place.
ARG NEXT_PUBLIC_INSFORGE_URL
ARG NEXT_PUBLIC_INSFORGE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CMS_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

ENV DATABASE_URL=${DATABASE_URL} \
    DIRECT_URL=${DIRECT_URL} \
    NEXT_PUBLIC_INSFORGE_URL=${NEXT_PUBLIC_INSFORGE_URL} \
    NEXT_PUBLIC_INSFORGE_ANON_KEY=${NEXT_PUBLIC_INSFORGE_ANON_KEY} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_CMS_URL=${NEXT_PUBLIC_CMS_URL} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run db:generate && npm run build -w wildgrove-cms

# ── Stage 2: runtime ─────────────────────────────────────────────
FROM node:24-alpine AS runtime

# UTC is fixed here instead of inherited, and for the same reason as the
# storefront: the panel reads and writes the same reservations, and the two
# processes have to agree on what an instant means.
ENV NODE_ENV=production \
    TZ=UTC \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache tzdata \
 && addgroup -S wildgrove && adduser -S -G wildgrove wildgrove

WORKDIR /app

# Neither `.next/static` nor `public/` can be left to the standalone output.
# Tracing copies only the public files it can prove are referenced, which drops
# every image, icon and font that some component builds a path to at runtime —
# the brand logo among them. Both directories are copied whole, on purpose.
COPY --from=build --chown=wildgrove:wildgrove /repo/wildgrove-cms/.next/standalone ./
COPY --from=build --chown=wildgrove:wildgrove /repo/wildgrove-cms/.next/static ./wildgrove-cms/.next/static
COPY --from=build --chown=wildgrove:wildgrove /repo/wildgrove-cms/public ./wildgrove-cms/public

# Created with its ownership before the volume is mounted, so a fresh named
# volume inherits it and the unprivileged user can write the optimized images.
RUN mkdir -p /app/wildgrove-cms/.next/cache/images \
 && chown -R wildgrove:wildgrove /app/wildgrove-cms/.next/cache

USER wildgrove
EXPOSE 3000

# Any HTTP answer means the server is listening. The root path redirects to the
# login screen for an unauthenticated caller, and that redirect is an answer.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --start-interval=1s --retries=4 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT,path:'/',timeout:4000},r=>process.exit(0)).on('error',()=>process.exit(1)).on('timeout',()=>process.exit(1))"

# server.js chdirs to its own directory, which leaves the email templates one
# level up at ../packages/core/emails/templates — candidate 2 of the loader.
CMD ["node", "wildgrove-cms/server.js"]
