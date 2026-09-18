#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "$0")/.." && pwd)"
source_snapshot="ba532969ecac093faad8be05bdb22403464bd4bb"

cd "$root"

git rev-parse --verify "${source_snapshot}^{commit}" >/dev/null

# Dirty, staged and untracked source changes are all forbidden. Keep the
# explicit diff as well as status so this guard remains obvious in gate logs.
git diff --exit-code -- sources/
if [[ -n "$(git status --porcelain --untracked-files=all -- sources/)" ]]; then
  echo "sources/** has dirty, staged or untracked changes." >&2
  exit 1
fi

# A direct two-endpoint diff compares the complete source trees themselves.
# Triple-dot would compare HEAD with a merge base and does not express tree
# equality. This shared commit is the last controlled provenance import and
# records the complete post-import sources/** snapshot.
git diff --exit-code "$source_snapshot" HEAD -- sources/

echo "sources working tree: clean"
echo "sources immutable snapshot: $source_snapshot"
