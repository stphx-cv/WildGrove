#!/usr/bin/env bash
# Wait for the build of a published commit, then deploy exactly the apps it built.
# The SSH key stays on the owner's machine; the workflow never connects here.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"
die() { echo "✗ $*" >&2; exit 1; }

dry_run=false
if [ "${1:-}" = --dry-run ]; then dry_run=true; shift; fi
[ "$#" -le 1 ] || die "Usage: $0 [--dry-run] [<commit>]"
ref=${1:-HEAD}

read_ship_value() {
  [ -f "$root/.env.ship" ] || return 0
  sed -n "s/^$1=//p" "$root/.env.ship" | tail -1
}
DEPLOY_SSH_TARGET=${DEPLOY_SSH_TARGET:-$(read_ship_value DEPLOY_SSH_TARGET)}
DEPLOY_DIR=${DEPLOY_DIR:-$(read_ship_value DEPLOY_DIR)}
[ -n "$DEPLOY_SSH_TARGET" ] || die "DEPLOY_SSH_TARGET is missing. Set it or add it to .env.ship."
[ -n "$DEPLOY_DIR" ] || die "DEPLOY_DIR is missing. Set it or add it to .env.ship."
case "$DEPLOY_DIR" in
  /*) ;;
  *) die "DEPLOY_DIR must be an absolute path." ;;
esac
case "$DEPLOY_DIR" in
  *"'"*) die "DEPLOY_DIR cannot contain a single quote." ;;
esac

commit=$(git rev-parse --verify "${ref}^{commit}") || die "No commit found for $ref."
git fetch origin production
git merge-base --is-ancestor "$commit" origin/production || die "Commit $commit is not on origin/production."

index=wildgrove-vault/versions/preview/00-preview-index.md
version=$(git show "${commit}:${index}" | sed -n 's/^Versión actual: \*\*\(.*\)\*\*.*$/\1/p' | head -1)
[[ "$version" =~ ^[pv][0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "No valid version found in $index at $commit."

run_id=
for attempt in $(seq 1 12); do
  run_id=$(gh run list --workflow build.yml --commit "$commit" -L 1 --json databaseId --jq '.[0].databaseId // empty')
  [ -n "$run_id" ] && break
  [ "$attempt" -eq 12 ] && die "No build appeared for $commit within 2 minutes."
  sleep 10
done
gh run watch "$run_id" --exit-status || die "Build $run_id failed; nothing was deployed."

jobs=$(gh run view "$run_id" --json jobs)
was_built() {
  jq -r --arg job "image ($1)" \
    '[.jobs[] | select(.name == $job) | .steps[] | select(.name == "Build and publish the image") | .conclusion] | first // "missing"' \
    <<< "$jobs"
}
web_result=$(was_built web)
cms_result=$(was_built cms)
[ "$web_result" = success ] || [ "$cms_result" = success ] || die "Could not determine which app was built in run $run_id."

owner=$(gh repo view --json owner --jq '.owner.login' | tr '[:upper:]' '[:lower:]')
[ -n "$owner" ] || die "Could not read the repository owner."
web_image="ghcr.io/${owner}/wildgrove-web:${version}"
cms_image="ghcr.io/${owner}/wildgrove-cms:${version}"

echo "Commit:  $commit"
echo "Version: $version"
echo "Build:   $run_id"
if [ "$web_result" = success ]; then echo "[web] $web_image"; fi
if [ "$cms_result" = success ]; then echo "[cms] $cms_image"; fi
[ "$dry_run" = false ] || exit 0

started=$(date +%s)
times=$(mktemp -d)
trap 'rm -rf "$times"' EXIT

deploy_one() {
  local app=$1 image=$2 command started_one code
  started_one=$(date +%s)
  command="cd '$DEPLOY_DIR' && ./scripts/deploy.sh ${app} '${image}'"
  if [ "$app" = cms ] && [ "$web_result" = success ]; then
    command="cd '$DEPLOY_DIR' && AWAIT_MIGRATION='${version}' ./scripts/deploy.sh cms '${image}'"
  fi
  set +e
  ssh "$DEPLOY_SSH_TARGET" "$command" 2>&1 | sed -u "s/^/[${app}] /"
  code=${PIPESTATUS[0]}
  set -e
  echo "$(( $(date +%s) - started_one ))" > "$times/$app"
  return "$code"
}

web_ok=true
cms_ok=true
if [ "$web_result" = success ] && [ "$cms_result" = success ]; then
  deploy_one web "$web_image" & web_pid=$!
  deploy_one cms "$cms_image" & cms_pid=$!
  wait "$web_pid" || web_ok=false
  wait "$cms_pid" || cms_ok=false
elif [ "$web_result" = success ]; then
  deploy_one web "$web_image" || web_ok=false
else
  deploy_one cms "$cms_image" || cms_ok=false
fi

for app in web cms; do
  if [ -f "$times/$app" ]; then echo "${app}: $(cat "$times/$app") s"; fi
done
echo "Total: $(( $(date +%s) - started )) s"
[ "$web_ok" = true ] || die "The web deploy failed."
[ "$cms_ok" = true ] || die "The cms deploy failed."
