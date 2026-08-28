#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

assert_runtime_dir
assert_sources_clean
work="$TEST_ENV_ROOT/debian-validation"
case "$work" in "$TRANSIENT_ROOT"/.tmp/test-env/debian-validation) ;; *) die "unsafe validation path: $work" ;; esac
rm -rf "$work"
mkdir -p "$work"
cp -a "$DEBIAN_ROOT/." "$work/"
(cd "$work" && git init -q && git add .)

say "running immutable Debian run-all.sh from disposable validation copy"
(cd "$work" && bash tests/run-all.sh)
rm -rf "$work"
assert_sources_clean
