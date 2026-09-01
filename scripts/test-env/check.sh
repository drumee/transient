#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

fail=0
ok() { printf '  PASS  %s\n' "$1"; }
bad() { printf '  FAIL  %s\n' "$1"; fail=1; }
have() { command -v "$1" >/dev/null 2>&1; }

say "checking baseline test-environment prerequisites"
[ "$(uname -s)" = Linux ] && ok "Linux host" || bad "Linux is required"
have docker && ok "Docker CLI: $(docker --version)" || bad "install Docker"
docker compose version >/dev/null 2>&1 && ok "Docker Compose: $(docker compose version --short)" || bad "install the Docker Compose plugin"
docker buildx version >/dev/null 2>&1 && ok "Docker buildx available" || bad "install Docker buildx"
if docker info >/dev/null 2>&1; then
  ok "Docker daemon reachable"
else
  bad "Docker daemon is not reachable; start it and grant this user access to its socket"
fi
have node && ok "Node.js: $(node --version)" || bad "install Node.js 20 or newer"
have npm && ok "npm: $(npm --version)" || bad "npm is required to stage locked dependencies outside sources/**"
if have node; then
  node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  [ "$node_major" -ge 20 ] && ok "Node.js major version is supported" || bad "Node.js 20 or newer is required by Debian tests"
fi

for repo in server-team ui-team schemas setup-schemas static; do
  [ -d "$(source_path "$repo")" ] && ok "sources/$repo present" || bad "missing sources/$repo"
done
for tool in scripts/build-images-local.sh tests/e2e-local.sh tests/run-all.sh config/render.mjs; do
  [ -f "$DEBIAN_ROOT/$tool" ] && ok "sources/debian/$tool present" || bad "missing sources/debian/$tool"
done

# The immutable builder uses INSTALL_DEPS=0. Missing dependency trees are
# prepared later in disposable staging; sources themselves stay untouched.
for repo in server-team ui-team; do
  if [ -d "$(source_path "$repo")/node_modules" ]; then
    ok "sources/$repo/node_modules available to immutable local builder"
  elif [ -f "$(source_path "$repo")/package-lock.json" ]; then
    ok "sources/$repo has package-lock.json; build.sh will npm ci in disposable staging"
  elif [ "$repo" = ui-team ] && [ -f "$TRANSIENT_ROOT/tests/fixtures/build-locks/ui-team-package-lock.json" ]; then
    expected="$(node -p 'require(process.argv[1]).source_package_sha256' "$TRANSIENT_ROOT/tests/fixtures/build-locks/ui-team-lock-metadata.json")"
    actual="$(sha256sum "$(source_path ui-team)/package.json" | awk '{print $1}')"
    [ "$actual" = "$expected" ] && ok "ui-team harness lock matches imported package.json" \
      || bad "ui-team package.json changed; reviewed harness lock must be regenerated"
  else
    bad "sources/$repo has neither node_modules nor package-lock.json; cannot prepare a reproducible build context"
  fi
done

if [ -d "$(source_path setup-infra)" ]; then
  ok "optional sources/setup-infra present"
else
  printf '  INFO  sources/setup-infra absent; authoritative builder will skip infra-init\n'
fi

if assert_sources_clean; then ok "sources/** pristine"; else fail=1; fi
available_kb="$(df -Pk "$TRANSIENT_ROOT" | awk 'NR==2 {print $4}')"
if [ "${available_kb:-0}" -ge 20971520 ]; then
  ok "at least 20 GiB free ($(awk -v k="$available_kb" 'BEGIN {printf "%.1f GiB", k/1048576}'))"
else
  bad "at least 20 GiB free is recommended for local images and runtime state"
fi

[ "$fail" -eq 0 ] || die "prerequisite check failed; no build or stack changes were made"
say "baseline test environment prerequisites satisfied"
