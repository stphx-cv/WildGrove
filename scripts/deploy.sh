#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# Deploy one application to the project's own server.
#
#   ./scripts/deploy.sh web  ghcr.io/<owner>/wildgrove-web:p2.1.0.0
#   ./scripts/deploy.sh cms  ghcr.io/<owner>/wildgrove-cms:p2.1.0.0
#
# Run it on the server, from the directory that holds compose.yaml and the
# environment files. It is deliberately not run by continuous integration: doing
# that would mean storing a key to this machine somewhere else, and the owner
# approves every deploy by hand anyway.
#
# ── What it does, and why in this order ──────────────────────────
#
# Each app runs as two colours. One serves; the other is where the new version
# is started and checked. Nothing is pointed at the new one until it has proven,
# against the real database, that it answers with real content.
#
#   1. Migrations run. Only for the storefront: two deploys migrating at once
#      would compete for the same lock. The migrator is the one the build
#      published with the storefront image being deployed, under the same tag.
#   2. The idle colour starts on the new image. It is not routed.
#   3. Its cache is dropped, so the pages built against the throwaway database
#      are marked stale.
#   4. Its pages are requested in both languages, which regenerates them from
#      the real database.
#   5. They are checked: a 200 is not enough, the menu has to have dishes in it.
#   6. Only then does the traffic move. The old colour stays up for its grace
#      period and is stopped in the background, so the command returns now.
#
# If anything from 1 to 5 fails, nothing moves. The rollback for a failed deploy
# is not something to run: it is having never advanced.
# ══════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Where things are ─────────────────────────────────────────────
here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE:-$here/compose.yaml}
ENV_FILE=${ENV_FILE:-$(dirname "$COMPOSE_FILE")/.env}

die()  { echo "✗ $*" >&2; exit 1; }
log()  { echo "  $*"; }
step() { echo; echo "── $* ──"; }

[ -f "$COMPOSE_FILE" ] || die "No compose file at $COMPOSE_FILE"
[ -f "$ENV_FILE" ]     || die "No environment file at $ENV_FILE. Copy .env.deploy.example and fill it in."

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

APP=${1:-}
IMAGE=${2:-}
case "$APP" in
  web|cms) ;;
  *) die "Usage: $0 <web|cms> <image-ref>" ;;
esac
[ -n "$IMAGE" ] || die "Usage: $0 <web|cms> <image-ref>"

: "${ROUTING_DIR:?ROUTING_DIR must be set in $ENV_FILE}"
: "${PROXY_NETWORK:?PROXY_NETWORK must be set in $ENV_FILE}"
: "${BACKEND_NETWORK:?BACKEND_NETWORK must be set in $ENV_FILE}"
# Deliberately not required. Leaving it empty routes the app over plain HTTP,
# which is what a test hostname with no DNS record needs: asking for a
# certificate for a name that does not resolve fails, and repeated failures
# burn through the certificate authority's rate limit. Any real hostname sets
# it, and the script says so loudly when it is missing.
TRAEFIK_CERT_RESOLVER=${TRAEFIK_CERT_RESOLVER:-}

STACK=${STACK_NAME:-wildgrove}
ENTRYPOINT=${TRAEFIK_ENTRYPOINT:-websecure}
GRACE_SECONDS=${GRACE_SECONDS:-20}
KEEP_IMAGES=${KEEP_IMAGES:-2}
RETIRE_LOG="${TMPDIR:-/tmp}/wildgrove-retire-${APP}.log"
IMAGE_TAG=${IMAGE##*:}
MIGRATION_MARK="${TMPDIR:-/tmp}/wildgrove-migrated-${IMAGE_TAG}"

# The build publishes the migrator next to the storefront, as wildgrove-migrate
# with the same tags. Deriving it from the image being deployed keeps the two
# on one version; a value in the environment file is ignored on purpose.
migrate_image_for() {
  local ref=$1 repo tag
  case "$ref" in *@*) return 1 ;; esac      # a digest pins one image, not a version
  repo=${ref%:*}
  tag=${ref##*:}
  [ "$repo" != "$ref" ] || return 1         # no tag
  case "$tag" in */*) return 1 ;; esac      # that colon was a registry port
  [ "${repo##*/}" = "wildgrove-web" ] || return 1
  echo "${repo%wildgrove-web}wildgrove-migrate:${tag}"
}

if [ "$APP" = "web" ]; then
  HOSTNAME_FOR_APP=${WEB_HOST:?WEB_HOST must be set}
  APP_ENV_FILE=${WEB_ENV_FILE:-$here/.env.web}
  MIGRATE_IMAGE=$(migrate_image_for "$IMAGE") \
    || die "Cannot derive the migrator from $IMAGE. Pass the storefront image as <registry>/<owner>/wildgrove-web:<tag>."
else
  HOSTNAME_FOR_APP=${CMS_HOST:?CMS_HOST must be set}
  APP_ENV_FILE=${CMS_ENV_FILE:-$here/.env.cms}
fi
[ -f "$APP_ENV_FILE" ] || die "No environment file for $APP at $APP_ENV_FILE"

# Read one value out of the application's own environment file. Application
# secrets live there and are deliberately not duplicated into the deploy
# config, so this reads them where they actually are.
app_env() { sed -n "s/^$1=//p" "$APP_ENV_FILE" | tail -1; }

# ── One deploy per application at a time ─────────────────────────
# The retiring process inherits this descriptor and holds the lock until the
# old colour has stopped. The other application has a separate lock.
exec 9>"${TMPDIR:-/tmp}/wildgrove-deploy-${APP}.lock"
log "waiting for the previous ${APP} deploy to finish"
flock -w "$((GRACE_SECONDS + 300))" 9 || die "The previous ${APP} deploy did not finish in time."

# ── Which colour is serving right now? ───────────────────────────
# Each app owns one file in the routing directory. Traefik merges every file in
# there, so deploying one app cannot disturb the other's record — which is the
# whole reason they are separate rather than two blocks in one file.
ROUTING_FILE="$ROUTING_DIR/wildgrove-${APP}.yml"

current_colour() {
  local c
  c=$(sudo sed -n "s|.*http://${STACK}-${APP}-\([a-z]*\):.*|\1|p" "$ROUTING_FILE" 2>/dev/null | head -1 || true)
  case "$c" in blue|green) echo "$c" ;; *) echo "" ;; esac
}

ACTIVE=$(current_colour)
case "$ACTIVE" in
  blue)  IDLE=green ;;
  green) IDLE=blue  ;;
  "")    ACTIVE=""; IDLE=blue ;;   # first deploy of this app
esac

ACTIVE_CT="${STACK}-${APP}-${ACTIVE}"
IDLE_CT="${STACK}-${APP}-${IDLE}"

echo "══ Deploying wildgrove-${APP}"
log "image:   $IMAGE"
if [ "$APP" = "web" ]; then log "migrate: $MIGRATE_IMAGE"; fi
log "serving: ${ACTIVE:-nothing yet}"
log "filling: $IDLE"

# ── Helpers that talk to a container from the inside ─────────────
# No extra image and no published port: the container's own Node asks itself.
in_container() { docker exec "$1" node -e "$2"; }

http_status() {
  in_container "$1" "
    fetch('http://127.0.0.1:3000$2', { redirect: 'manual' })
      .then(r => { console.log(r.status); process.exit(0) })
      .catch(e => { console.log('000 ' + e.message); process.exit(0) })
  "
}

# ── 1. Migrations, storefront only ───────────────────────────────
if [ "$APP" = "web" ]; then
  step "Migrations"
  rm -f "$MIGRATION_MARK"
  docker pull -q "$IMAGE" >/dev/null &
  image_pull_pid=$!
  docker pull -q "$MIGRATE_IMAGE" >/dev/null
  docker run --rm --network "$BACKEND_NETWORK" --env-file "${WEB_ENV_FILE:-$here/.env.web}" \
    "$MIGRATE_IMAGE" migrate deploy
  touch "$MIGRATION_MARK"
else
  step "Migrations"
  log "skipped: only the storefront migrates"
fi

# ── 2. Start the idle colour, unrouted ───────────────────────────
step "Starting $IDLE_CT"
if [ "$APP" = "web" ]; then
  wait "$image_pull_pid" || die "Could not pull $IMAGE. Nothing was started."
else
  docker pull -q "$IMAGE" >/dev/null
fi

upper_app=$(echo "$APP" | tr '[:lower:]' '[:upper:]')
upper_idle=$(echo "$IDLE" | tr '[:lower:]' '[:upper:]')
export "${upper_app}_IMAGE_${upper_idle}=$IMAGE"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate "${APP}-${IDLE}"

log "waiting for it to answer"
for i in $(seq 1 60); do
  health=$(docker inspect "$IDLE_CT" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || echo "gone")
  [ "$health" = "healthy" ] && { log "healthy after ${i}s"; break; }
  [ "$health" = "gone" ] && die "$IDLE_CT is not running. docker logs $IDLE_CT"
  [ "$i" = "60" ] && die "$IDLE_CT never became healthy. docker logs $IDLE_CT"
  sleep 1
done

# ── 3 & 4. Drop the stale cache, then rebuild it from real data ──
if [ "$APP" = "web" ]; then
  step "Warming"

  # The pages in this image were generated against a throwaway database with no
  # dishes. Dropping these tags is what makes the next request rebuild them from
  # the real one. The endpoint is the same one the panel calls after a save, so
  # every deploy exercises it.
  # Same fallback the application itself uses: REVALIDATE_SECRET, or the
  # InsForge key that both apps already hold.
  secret=$(app_env REVALIDATE_SECRET)
  [ -n "$secret" ] || secret=$(app_env INSFORGE_API_KEY)
  [ -n "$secret" ] || die "Neither REVALIDATE_SECRET nor INSFORGE_API_KEY is in $APP_ENV_FILE; the new pages cannot be refreshed."

  revalidated=$(docker exec -e __SECRET="$secret" "$IDLE_CT" node -e "
    fetch('http://127.0.0.1:3000/api/revalidate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.__SECRET },
      body: JSON.stringify({ tags: ['menu','discounts','app-settings','reviews','product-reviews'] }),
    }).then(async r => { console.log(r.status + ' ' + (await r.text()).slice(0,200)); process.exit(0) })
      .catch(e => { console.log('000 ' + e.message); process.exit(0) })
  " ) || true
  case "$revalidated" in
    200*) log "cache dropped: $revalidated" ;;
    *)    die "Revalidate refused: $revalidated" ;;
  esac

  log "requesting pages so they rebuild from the real database"
  for path in / /en /es /en/menu /es/menu; do
    status=$(http_status "$IDLE_CT" "$path")
    case "$status" in
      200|307|308) log "  $path → $status" ;;
      *) die "$path answered $status on the new version. Nothing was switched." ;;
    esac
  done

  # ── 5. A 200 is not enough ─────────────────────────────────────
  # This is the check the whole colour dance exists for. The image ships with an
  # empty menu on purpose; if the warm-up did not reach the real database, the
  # page is still a valid 200 and still useless.
  step "Checking the menu is not empty"

  # Counted from the storefront's own public menu API rather than scraped out
  # of the page. The menu renders its dishes from a data payload, so an HTML
  # pattern count measures something incidental: on a page carrying all eleven
  # dishes it finds two, which is above zero and would wave through a deploy
  # that had in fact lost the menu. This reads the number the application
  # itself reports, through the same cache tags the warm-up just dropped.
  for locale in en es; do
    count=$(in_container "$IDLE_CT" "
      fetch('http://127.0.0.1:3000/api/agent/v1/menu?locale=${locale}')
        .then(r => r.json())
        .then(j => {
          const cats = (j && j.data && j.data.categories) || []
          console.log(cats.reduce((n, c) => n + ((c.items || []).length), 0))
          process.exit(0)
        })
        .catch(() => { console.log(0); process.exit(0) })
    ")
    [ "${count:-0}" -gt 0 ] || die "The ${locale} menu came back with no dishes. Nothing was switched."
    log "  ${locale}: ${count} dishes"
  done

  # And the pages a visitor actually gets have to carry them too.
  for locale in en es; do
    carried=$(in_container "$IDLE_CT" "
      fetch('http://127.0.0.1:3000/${locale}/menu')
        .then(r => r.text())
        .then(h => { console.log((h.match(/slug/g) || []).length); process.exit(0) })
        .catch(() => { console.log(0); process.exit(0) })
    ")
    [ "${carried:-0}" -gt 0 ] || die "The ${locale} menu page carries no dish data. Nothing was switched."
    log "  ${locale}: page carries dish data"
  done
else
  step "Checking the panel answers"
  for path in /login /; do
    status=$(http_status "$IDLE_CT" "$path")
    case "$status" in
      200|307|308) log "  $path → $status" ;;
      *) die "$path answered $status on the new version. Nothing was switched." ;;
    esac
  done
fi

# ── 6. Move the traffic ──────────────────────────────────────────
# One record, rewritten. The container is not recreated, which is the point:
# recreating it here would throw away the cache the warm-up just built and hand
# the first visitor the empty menu.
if [ "$APP" = "cms" ] && [ -n "${AWAIT_MIGRATION:-}" ]; then
  step "Waiting for the storefront migration"
  marker="${TMPDIR:-/tmp}/wildgrove-migrated-${AWAIT_MIGRATION}"
  for i in $(seq 1 300); do
    [ -f "$marker" ] && break
    [ "$i" = 300 ] && die "The storefront migration for ${AWAIT_MIGRATION} did not finish. Nothing was switched."
    sleep 1
  done
  log "storefront migration for ${AWAIT_MIGRATION} finished"
fi
step "Switching traffic to $IDLE"

if [ -z "$TRAEFIK_CERT_RESOLVER" ]; then
  echo "  ⚠  TRAEFIK_CERT_RESOLVER is empty: ${HOSTNAME_FOR_APP} will be served over plain HTTP."
  echo "     That is only ever right for a test hostname."
fi

tmp=$(mktemp)
{
  echo "# Written by scripts/deploy.sh — do not edit by hand."
  echo "# Which colour of wildgrove-${APP} receives traffic. Rewriting this file"
  echo "# moves traffic without restarting or recreating anything."
  echo "http:"
  echo "  routers:"
  echo "    wildgrove-${APP}:"
  echo "      rule: \"Host(\`${HOSTNAME_FOR_APP}\`)\""
  echo "      entryPoints: [${ENTRYPOINT}]"
  echo "      service: wildgrove-${APP}"
  if [ -n "$TRAEFIK_CERT_RESOLVER" ]; then
    echo "      tls:"
    echo "        certResolver: ${TRAEFIK_CERT_RESOLVER}"
  fi
  echo "  services:"
  echo "    wildgrove-${APP}:"
  echo "      loadBalancer:"
  echo "        servers:"
  echo "          - url: \"http://${IDLE_CT}:3000\""
} > "$tmp"

sudo install -m 0644 "$tmp" "$ROUTING_FILE"
rm -f "$tmp"
log "routing file rewritten → $IDLE_CT"

# ── Retire the old colour after traffic moves ─────────────────────
retire_log() { printf '%s %s\n' "$(date -Is)" "$*"; }
prune_images() {
  retire_log "pruning old images"
  docker image ls --format '{{.Repository}}:{{.Tag}}\t{{.CreatedAt}}' \
    | grep -E "wildgrove-(${APP}|migrate)" \
    | sort -k2 -r | tail -n "+$((KEEP_IMAGES + 1))" | cut -f1 \
    | while read -r old; do
        docker image rm "$old" >/dev/null 2>&1 && retire_log "removed $old" || true
      done
}

( trap '' HUP INT
  retire_log "retiring ${ACTIVE_CT} after ${GRACE_SECONDS}s"
  sleep "$GRACE_SECONDS"
  if [ -n "$ACTIVE" ] && docker ps -q -f "name=^${ACTIVE_CT}$" | grep -q .; then
    docker stop "$ACTIVE_CT" >/dev/null && retire_log "stopped $ACTIVE_CT"
  fi
  prune_images
) </dev/null >>"$RETIRE_LOG" 2>&1 &
disown

echo
echo "✓ wildgrove-${APP} is served by ${IDLE_CT}"
echo "  The old colour will stop in ${GRACE_SECONDS}s; retirement log: ${RETIRE_LOG}"
echo "  If something is wrong, run this script again with the previous image."
