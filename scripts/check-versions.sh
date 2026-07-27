#!/bin/bash
# Verify each package's debian/changelog version matches release-manifest.yaml.
# Drift guard for CI. Use --sync to rewrite changelog top lines to the manifest.
#
#   scripts/check-versions.sh         # check only (non-zero exit on drift)
#   scripts/check-versions.sh --sync  # prepend a manifest-matching changelog entry
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="$root/release-manifest.yaml"
[ -f "$manifest" ] || { echo "missing $manifest" >&2; exit 1; }
SYNC=0; [ "${1:-}" = "--sync" ] && SYNC=1

drift=0
while read -r dir version; do
  [ -n "$dir" ] || continue
  case "$dir" in \#*|product) continue ;; esac   # 'product' is the release-train version, no changelog
  cl="$root/$dir/debian/changelog"
  [ -f "$cl" ] || { echo "WARN no changelog for $dir"; continue; }
  pkg="$(head -1 "$cl" | awk '{print $1}')"
  cur="$(head -1 "$cl" | sed -E 's/^[^(]*\(([^)]+)\).*/\1/')"
  if [ "$cur" = "$version" ]; then
    printf '  ok   %-14s %s %s\n' "$dir" "$pkg" "$version"
  elif [ "$SYNC" = 1 ]; then
    printf '  sync %-14s %s %s -> %s\n' "$dir" "$pkg" "$cur" "$version"
    tmp="$(mktemp)"
    {
      printf '%s (%s) stable; urgency=medium\n\n  * Release %s (synced from release-manifest.yaml)\n\n -- %s  %s\n\n' \
        "$pkg" "$version" "$version" \
        "$(grep -m1 -E '^ -- ' "$cl" | sed -E 's/^ -- //; s/  .*$//')" \
        "$(date -R)"
      cat "$cl"
    } > "$tmp"
    mv "$tmp" "$cl"
  else
    printf '  DRIFT %-13s %s changelog=%s manifest=%s\n' "$dir" "$pkg" "$cur" "$version"
    drift=1
  fi
done < <(sed -E 's/#.*$//' "$manifest" | tr -d '\r' | awk -F': *' 'NF==2{print $1, $2}')

[ "$drift" = 0 ] || { echo "version drift detected — bump release-manifest.yaml or run --sync" >&2; exit 1; }
echo "all package versions match the release manifest."
