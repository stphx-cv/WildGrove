# syntax=docker/dockerfile:1

# ══════════════════════════════════════════════════════════════════
# Storefront image.
#
# The build stages share one dependency install; the runtime keeps only what is
# needed to run. The build never reaches the production database — see the
# DATABASE_URL note below.
# ══════════════════════════════════════════════════════════════════

# ── Dependencies shared by the app and migrator ──────────────────
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

# Generate Prisma before calculating the migrator's dependency closure. This
# downloads the schema engine for this platform without compiling the app.
FROM deps AS migrate-pack
COPY packages/db packages/db
RUN DATABASE_URL=postgresql://unused@127.0.0.1:5432/unused \
    DIRECT_URL=postgresql://unused@127.0.0.1:5432/unused \
    npm run build -w @wildgrove/db
RUN node packages/db/scripts/prisma-closure.mjs /repo prisma dotenv > /tmp/closure.txt \
 && mkdir -p /stage \
 && tar -cf - -T /tmp/closure.txt | tar -xf - -C /stage \
 && echo "migrator carries $(wc -l < /tmp/closure.txt) modules, $(du -sh /stage | cut -f1)"

# ── Build the storefront ────────────────────────────────────────
FROM deps AS build

COPY . .

# `next build` reads the database: the dish page enumerates dishes to generate
# its routes, and the home page and the menu are generated from cached data that
# comes from the same place.
#
# What it is given is a throwaway PostgreSQL carrying the schema and no dishes,
# never the production database. Passing a production URL here would put a path
# to real data inside an automated build and defeat the reason this image exists.
# The pages therefore ship with an empty menu on purpose; the deploy warms them
# against the real database before any traffic reaches them.
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
RUN npm run db:generate && npm run build -w wildgrove-web

# ── Migrator ─────────────────────────────────────────────────────
# A separate image, run once by the deploy and thrown away. Migrations are a
# build-time tool, and the container that serves the public has no business
# carrying the schema engine or the migration history.
#
# Only the storefront migrates. Two deploys migrating at once would compete for
# the same migration lock, which is why the panel has no image like this one.
# See wildgrove-vault/rules/03-never-do.md, item 10.
FROM node:24-alpine AS migrate

ENV NODE_ENV=production TZ=UTC
RUN apk add --no-cache tzdata \
 && addgroup -S wildgrove && adduser -S -G wildgrove wildgrove

WORKDIR /repo

# The schema's datasource block carries no url: prisma.config.ts supplies it
# from the environment, so the config file comes too, along with the dependency
# closure that migrate-pack prepared.
# One COPY of a prepared directory, not a tarball plus an extract step: two
# layers would each carry the same 130 modules and double the image.
# Ownership is set by the COPY itself. A `chown -R` afterwards would rewrite
# every one of those files into a second layer and double the image.
COPY --from=migrate-pack --chown=wildgrove:wildgrove /stage/ ./

COPY --from=migrate-pack --chown=wildgrove:wildgrove /repo/packages/db/package.json ./packages/db/package.json
COPY --from=migrate-pack --chown=wildgrove:wildgrove /repo/packages/db/prisma.config.ts ./packages/db/prisma.config.ts
COPY --from=migrate-pack --chown=wildgrove:wildgrove /repo/packages/db/prisma ./packages/db/prisma

USER wildgrove

ENTRYPOINT ["node", "node_modules/prisma/build/index.js", "--config", "packages/db/prisma.config.ts"]
CMD ["migrate", "deploy"]

# ── Runtime is the default target ────────────────────────────────
FROM node:24-alpine AS runtime

# UTC is fixed here instead of inherited. Reservation capacity converts Lima
# (UTC-5, no DST) from an explicit offset, so a container on another zone would
# quietly shift every stored reservation rather than fail.
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
COPY --from=build --chown=wildgrove:wildgrove /repo/wildgrove-web/.next/standalone ./
COPY --from=build --chown=wildgrove:wildgrove /repo/wildgrove-web/.next/static ./wildgrove-web/.next/static
COPY --from=build --chown=wildgrove:wildgrove /repo/wildgrove-web/public ./wildgrove-web/public

# Created with its ownership before the volume is mounted, so a fresh named
# volume inherits it and the unprivileged user can write the optimized images.
RUN mkdir -p /app/wildgrove-web/.next/cache/images \
 && chown -R wildgrove:wildgrove /app/wildgrove-web/.next/cache

USER wildgrove
EXPOSE 3000

# Any HTTP answer means the server is listening, which is all this reports.
# Whether the page is *correct* is checked by the deploy, against real data.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --start-interval=1s --retries=4 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT,path:'/',timeout:4000},r=>process.exit(0)).on('error',()=>process.exit(1)).on('timeout',()=>process.exit(1))"

# server.js chdirs to its own directory, which leaves the email templates one
# level up at ../packages/core/emails/templates — candidate 2 of the loader.
CMD ["node", "wildgrove-web/server.js"]
