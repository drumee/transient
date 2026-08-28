#!/bin/bash
#
# sync-mirror.sh — propagate docs/ into the Docusaurus mirror in drumee.github.io.
#
# The canonical build-pipeline docs live here in debian/docs/. The public site
# (drumee.github.io/docs/package-building/) is a hand-numbered mirror with
# Docusaurus frontmatter. This script regenerates each mirror file from its
# source counterpart: it preserves the mirror's existing frontmatter and rewrites
# internal links from `](name.md)` to the numbered `](./NN-name.md)` form.
#
# Usage:
#   docs/sync-mirror.sh [MIRROR_DIR]
#
# MIRROR_DIR defaults to ../../drumee.github.io/docs/package-building relative to
# the debian repo root (the two repos are siblings), or set DST_DIR in the env.
#
set -e

SRC="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
REPO_ROOT="$(dirname "$SRC")"
DST="${1:-${DST_DIR:-$REPO_ROOT/../drumee.github.io/docs/package-building}}"

if [ ! -d "$DST" ]; then
  echo "Mirror directory not found: $DST" >&2
  echo "Pass it as an argument or set DST_DIR." >&2
  exit 1
fi

# source basename (no .md) -> mirror basename (no .md)
declare -A NUM=(
  [overview]=01-overview
  [build-pipeline]=02-build-pipeline
  [package-infra]=03-package-infra
  [package-schemas]=04-package-schemas
  [package-server]=05-package-server
  [package-ui]=06-package-ui
  [package-static]=07-package-static
  [package-schemas-patch]=08-package-schemas-patch
  [package-builder]=09-package-builder
  [utilities]=10-utilities
  [version-management]=11-version-management
  [deployment]=12-deployment
)

# Build the link-rewrite sed program. Longer names first so
# package-schemas-patch is rewritten before package-schemas.
SED=""
for name in package-schemas-patch package-builder package-infra package-schemas \
            package-server package-ui package-static build-pipeline \
            version-management deployment utilities overview; do
  SED+="s#](${name}\.md)#](./${NUM[$name]}.md)#g;"
done

for name in "${!NUM[@]}"; do
  src="$SRC/${name}.md"
  dst="$DST/${NUM[$name]}.md"
  if [ ! -f "$src" ]; then echo "skip (no source): ${name}.md" >&2; continue; fi
  if [ ! -f "$dst" ]; then echo "skip (no mirror): ${NUM[$name]}.md" >&2; continue; fi
  # Preserve the mirror's existing frontmatter (first --- ... --- block).
  fm=$(awk '/^---$/{c++; print; if(c==2) exit; next} c==1{print}' "$dst")
  body=$(sed -e "$SED" "$src")
  { printf '%s\n\n' "$fm"; printf '%s\n' "$body"; } > "$dst"
  echo "synced ${NUM[$name]}.md"
done
