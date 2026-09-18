#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "$0")/.." && pwd)"
baseline_ref="baseline/drumee-pre-minimal-os"
setup_infra_import="621abecb6742edd9a56758286675fcf1b222e242"
ui_dev_tools_import="ba532969ecac093faad8be05bdb22403464bd4bb"

cd "$root"

git rev-parse --verify "${baseline_ref}^{commit}" >/dev/null
git rev-parse --verify "${setup_infra_import}^{commit}" >/dev/null
git rev-parse --verify "${ui_dev_tools_import}^{commit}" >/dev/null

# Dirty, staged and untracked source changes are all forbidden. Keep the
# explicit diff as well as status so this guard remains obvious in gate logs.
git diff --exit-code -- sources/
if [[ -n "$(git status --porcelain --untracked-files=all -- sources/)" ]]; then
  echo "sources/** has dirty, staged or untracked changes." >&2
  exit 1
fi

# Direct two-endpoint diffs compare the source trees themselves. Triple-dot
# would compare HEAD with a merge base and does not express tree equality.
# setup-infra and ui-dev-tools were controlled provenance imports after the
# named baseline tag, so each is compared with its recorded import commit.
git diff --exit-code "$baseline_ref" HEAD -- sources/ \
  ':(exclude)sources/setup-infra/**' \
  ':(exclude)sources/ui-dev-tools/**'
git diff --exit-code "$setup_infra_import" HEAD -- sources/setup-infra/
git diff --exit-code "$ui_dev_tools_import" HEAD -- sources/ui-dev-tools/
# ui-dev-tools is the last controlled provenance import and therefore also
# records the complete post-import sources tree. This final comparison catches
# an unexpected new source directory as well as changes to known imports.
git diff --exit-code "$ui_dev_tools_import" HEAD -- sources/

echo "sources working tree: clean"
echo "sources immutable baseline: $baseline_ref"
echo "sources controlled late import: setup-infra@$setup_infra_import"
echo "sources controlled late import: ui-dev-tools@$ui_dev_tools_import"
echo "sources complete immutable snapshot: $ui_dev_tools_import"
