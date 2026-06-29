#!/bin/bash
# Publish the install host (get.drumee.com):
#   1. build a signed flat APT repo and upload it as the apt-stable Release assets
#   2. deploy the Pages content (installers, renderer, keyring, CLIs)
# Both targets live in PAGES_REPO, so this is cross-repo and needs a token with
# contents:write there.
#
#   GH_TOKEN=<token> scripts/publish-site.sh --debs=out-debs [--key=KEYID]
#
# Env:
#   PAGES_REPO   (default drumee/get-drumee-pages)
#   APT_TAG      (default apt-stable)
#   GH_TOKEN     (required) token with write access to PAGES_REPO
#   REF_NAME     (optional) release label for the commit message
set -euo pipefail

DEBS="out-debs"; KEY=""
for a in "$@"; do case $a in --debs=*) DEBS="${a#*=}";; --key=*) KEY="${a#*=}";; *) echo "unknown arg $a" >&2; exit 2;; esac; done
PAGES_REPO="${PAGES_REPO:-drumee/get-drumee-pages}"
APT_TAG="${APT_TAG:-apt-stable}"
REF_NAME="${REF_NAME:-${GITHUB_REF_NAME:-manual}}"
: "${GH_TOKEN:?set GH_TOKEN to a token with write access to $PAGES_REPO}"
command -v gh >/dev/null || { echo "error: gh CLI required" >&2; exit 1; }
[ -d "$DEBS" ] || { echo "error: --debs dir not found: $DEBS" >&2; exit 1; }
root="$(cd "$(dirname "$0")/.." && pwd)"
export GH_TOKEN

# 1) flat repo -> apt-stable assets ------------------------------------------
flat="$(mktemp -d)/apt"
bash "$root/scripts/publish-apt.sh" --debs="$DEBS" --out="$flat" ${KEY:+--key="$KEY"}
gh release view "$APT_TAG" -R "$PAGES_REPO" >/dev/null 2>&1 \
  || gh release create "$APT_TAG" -R "$PAGES_REPO" --title "APT repository (stable)" \
       --notes "Flat APT repository for the Drumee native channel. Managed by scripts/publish-site.sh."
echo "==> uploading apt-stable assets (clobber)"
gh release upload "$APT_TAG" "$flat"/* -R "$PAGES_REPO" --clobber

# 2) deploy the Pages content -------------------------------------------------
work="$(mktemp -d)/site"
git clone --depth 1 "https://x-access-token:${GH_TOKEN}@github.com/${PAGES_REPO}.git" "$work"
mkdir -p "$work/config" "$work/bin"
cp "$root/scripts/get-drumee.sh"      "$work/install"
cp "$root/scripts/install-native.sh"  "$work/native"
cp "$root/config/render.mjs"          "$work/config/render.mjs"
cp "$root/config/drumee.schema.json"  "$work/config/drumee.schema.json"
cp "$root/config/drumee.example.yaml" "$work/config/drumee.example.yaml"
cp "$root/bin/drumee-ctl"             "$work/bin/drumee-ctl"
cp "$root/bin/drumee-plugin"          "$work/bin/drumee-plugin"
cp "$flat/drumee-archive-keyring.asc" "$work/drumee-archive-keyring.asc"
chmod +x "$work/install" "$work/native" "$work/bin/"*
( cd "$work"
  git add -A
  if git diff --cached --quiet; then echo "==> Pages content already up to date"; else
    git -c user.name=drumee-ci -c user.email=ci@drumee.org commit -q -m "publish: installers + apt-stable for $REF_NAME"
    git push -q
    echo "==> deployed Pages content"
  fi )
echo "Done — apt-stable assets + Pages content published to $PAGES_REPO."
