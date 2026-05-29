#!/bin/bash
set -e

base="$(dirname "$(readlink -f "$0")")"
pkg_json="${base}/src/server-team/package.json"
changelog="${base}/debian/changelog"
git_dir="${base}/src/server-team"

for arg in "$@"; do
  case $arg in
  --message=*)
    message="${arg#*=}"
    shift
    ;;
  --email=*)
    email="${arg#*=}"
    shift
    ;;
  esac
done

if [ ! -f "$pkg_json" ]; then
  echo "package.json not found: $pkg_json"
  exit 1
fi

pkg_version=$(grep '"version"' "$pkg_json" | head -1 | awk -F'"' '{print $4}')
if [ -z "$pkg_version" ]; then
  echo "Could not read version from $pkg_json"
  exit 1
fi

# Use the higher of the two versions as the target
changelog_version=$(head -1 "$changelog" | awk -F'[()]' '{print $2}')
version=$pkg_version
if [ "$(printf '%s\n' "$changelog_version" "$pkg_version" | sort -V | tail -1)" = "$changelog_version" ]; then
  version=$changelog_version
fi

if [ -z "$email" ]; then
  email=$(grep -E '^ -- .+ <.+>' "$changelog" | head -1 | awk -F'[<>]' '{print $2}')
fi
maintainer=$(grep -E '^ -- .+ <.+>' "$changelog" | head -1 | sed 's/^ -- //' | sed 's/ <.*//')

# Build bullet lines from --message or last 5 commits
if [ -n "$message" ]; then
  bullets="  * ${message}"
else
  bullets=$(git -C "$git_dir" log --no-merges --format="%s" -5 | \
    grep -vE "^[0-9]+\.[0-9]+\.[0-9]+$" | \
    sed 's/^/  * /')
  [ -z "$bullets" ] && bullets="  * Update"
fi

date_str=$(date -R)

entry="drumee-server-pod (${version}) stable; urgency=medium
${bullets}
 -- ${maintainer} <${email}>  ${date_str}"

tmpfile=$(mktemp)

if grep -q "^drumee-server-pod (${version})" "$changelog"; then
  # Find line number of the existing entry and the next entry
  start=$(grep -n "^drumee-server-pod (${version})" "$changelog" | head -1 | cut -d: -f1)
  next_line=$(awk "NR > $start && /^drumee-server-pod \(/ {print NR; exit}" "$changelog")

  [ "$start" -gt 1 ] && head -n $((start - 1)) "$changelog" > "$tmpfile" || true > "$tmpfile"
  printf '%s\n\n' "$entry" >> "$tmpfile"
  if [ -n "$next_line" ]; then
    tail -n +"$next_line" "$changelog" >> "$tmpfile"
  fi
  mv "$tmpfile" "$changelog"
  echo "Updated changelog entry for version ${version}."
else
  # Prepend new entry
  printf '%s\n\n' "$entry" > "$tmpfile"
  cat "$changelog" >> "$tmpfile"
  mv "$tmpfile" "$changelog"
  echo "Added changelog entry for version ${version}."
fi
