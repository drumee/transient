#!/bin/bash
# Deploy a throwaway container to INSPECT a built seed interactively.
#
# Builds the drumee/seed-check image and runs it with the seed archive
# (schemas' var/tmp/drumee/seeds.tgz by default) bind-mounted read-only. The
# container restores the seed the same way the native .deb install does
# (mariabackup --copy-back), starts mariadbd, and drops you into an interactive
# shell with the `mariadb` client pre-wired — so you can run any MariaDB command
# against the restored databases. See scripts/seed-check-entrypoint.sh.
#
#   scripts/check-seed.sh [--seed=PATH] [-- CMD ...]
#
# With no CMD you get an interactive shell. Pass a command after `--` to run it
# non-interactively and exit, e.g.:
#   scripts/check-seed.sh -- mariadb -N -B -e 'SELECT COUNT(*) FROM yp.entity'
#
# Env: TAG (image tag, default local), DB_PORT (in-container port, default 3306).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }

SEED="$root/schemas/var/tmp/drumee/seeds.tgz"
cmd=()
while [ $# -gt 0 ]; do
  case $1 in
    --seed=*) SEED="${1#*=}" ;;
    --) shift; cmd=("$@"); break ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

TAG="${TAG:-local}"

docker buildx version >/dev/null 2>&1 || { echo "docker buildx required" >&2; exit 1; }
[ -f "$SEED" ] || {
  echo "seed archive not found: $SEED" >&2
  echo "build one first with scripts/build-seed.sh, or pass --seed=PATH" >&2
  exit 1; }
SEED="$(cd "$(dirname "$SEED")" && pwd)/$(basename "$SEED")"

say "Building drumee/seed-check:$TAG"
docker buildx build \
  -f "$root/scripts/Dockerfile.seed-check" \
  -t "drumee/seed-check:$TAG" --load "$root/scripts"

say "Launching seed-check container (seed: $SEED)"
# -it so the shell is interactive; --rm so it's fully throwaway. Only interactive
# when no explicit command is given AND we have a TTY.
run_flags=(--rm)
if [ ${#cmd[@]} -eq 0 ] && [ -t 0 ] && [ -t 1 ]; then
  run_flags+=(-it)
fi
exec docker run "${run_flags[@]}" \
  --ulimit "nofile=1048576:1048576" \
  -e "DB_PORT=${DB_PORT:-3306}" \
  -v "$SEED:/seed/seeds.tgz:ro" \
  "drumee/seed-check:$TAG" "${cmd[@]}"
