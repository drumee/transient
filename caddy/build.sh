#!/bin/bash
# Build drumee-caddy: a Caddy binary compiled with the caddy-dns provider
# modules, packaged with the units and helper scripts that wire it to
# drumee-infra's tls_method=caddy.
#
#   caddy/build.sh
#
# Why a custom build: answering ACME's DNS-01 challenge — and therefore issuing
# the WILDCARD certificate Drumee needs — requires the provider module to be
# compiled in. Stock Caddy (including Debian's) has none, so it can only do
# HTTP-01 and cannot produce a wildcard.
#
# Unlike the other builders this one needs a Go toolchain. It uses whatever is
# available, in this order: a local xcaddy, a local go, or a Docker golang image
# (same fallback shape as scripts/build-seed.sh). Set CADDY_BUILD to force one.
#
# Env:
#   CADDY_VERSION      Caddy tag to build (default: unset = latest, see below)
#   CADDY_DNS_MODULES  space/comma separated caddy-dns providers to compile in
#   CADDY_BUILD        auto (default) | xcaddy | go | docker
#   GO_IMAGE           golang image for the docker path (default golang:1.24-bookworm)
#   DEB_BUILD_TARGET   copy the resulting .deb there
set -e
if [ "$UID" = "0" ]; then
  echo "You should not run this builder with root privilege"
  exit 1
fi

base="$(dirname "$(readlink -f "$0")")"
source "${base}/../utils/env.sh"
source "${base}/../utils/functions.sh"

packagename=drumee-caddy
# Deliberately NOT pinned by default. Every caddy-dns module declares a minimum
# caddy/v2 and they move independently, so any pin we ship is wrong as soon as one
# module moves past it — `go get` then fails outright rather than degrading (seen
# with ovh needing v2.10.0, then desec needing v2.10.2). Letting xcaddy take the
# latest Caddy is the only version that satisfies every module at once.
# Pin explicitly when you need a reproducible build: CADDY_VERSION=v2.10.2.
# Either way the version actually built is recorded in the package.
CADDY_VERSION="${CADDY_VERSION:-}"
CADDY_BUILD="${CADDY_BUILD:-auto}"
GO_IMAGE="${GO_IMAGE:-golang:1.24-bookworm}"
# Providers people actually self-host with. Each one adds build time and a little
# size, so this is a deliberate shortlist rather than "everything upstream has";
# the debconf answer is validated against the list shipped in the package.
CADDY_DNS_MODULES="${CADDY_DNS_MODULES:-cloudflare ovh gandi desec duckdns digitalocean hetzner route53}"

version=$(get_version "$base")
email=$(get_email "$base")
build_dir=$(get_build_dir "${base}/build/$version")

# The binary is architecture specific (unlike every other Drumee package), so the
# Go build must target the same architecture dpkg is about to package for.
deb_arch="$(dpkg-architecture -qDEB_HOST_ARCH)"
case "$deb_arch" in
  amd64) GOARCH=amd64 ;;
  arm64) GOARCH=arm64 ;;
  armhf) GOARCH=arm; export GOARM=7 ;;
  i386)  GOARCH=386 ;;
  *) echo "unsupported architecture for the Caddy build: $deb_arch" >&2; exit 1 ;;
esac

modules="$(echo "$CADDY_DNS_MODULES" | tr ',' ' ' | xargs)"
with_args=""
for m in $modules; do
  with_args="$with_args --with github.com/caddy-dns/$m"
done

out_bin="$build_dir/files/usr/sbin/drumee-caddy"
mkdir -p "$(dirname "$out_bin")"

echo "BUILDING CADDY ${CADDY_VERSION:-latest} for $deb_arch (GOARCH=$GOARCH)"
echo "  modules: $modules"

# xcaddy needs Go >= 1.21 (its go.mod carries a `toolchain` directive, which
# older toolchains reject outright). Debian bookworm ships 1.19, so checking that
# the local Go is new enough — not merely present — is what decides between the
# local and Docker paths.
GO_MIN_MINOR=21
go_new_enough() {
  command -v go >/dev/null 2>&1 || return 1
  local v major minor
  v="$(go env GOVERSION 2>/dev/null || go version | awk '{print $3}')"
  v="${v#go}"; major="${v%%.*}"; minor="${v#*.}"; minor="${minor%%.*}"
  [ "${major:-0}" -gt 1 ] && return 0
  [ "${major:-0}" -eq 1 ] && [ "${minor:-0}" -ge "$GO_MIN_MINOR" ]
}

resolve_builder() {
  case "$CADDY_BUILD" in
    xcaddy|go|docker) echo "$CADDY_BUILD"; return ;;
  esac
  if command -v xcaddy >/dev/null 2>&1 && go_new_enough; then echo xcaddy
  elif go_new_enough; then echo go
  elif docker info >/dev/null 2>&1; then
    command -v go >/dev/null 2>&1 \
      && echo "  local go $(go version | awk '{print $3}') is older than 1.${GO_MIN_MINOR} — using Docker instead" >&2
    echo docker
  else echo none; fi
}

builder="$(resolve_builder)"
case "$builder" in
  xcaddy)
    echo "  using local xcaddy"
    GOOS=linux GOARCH="$GOARCH" xcaddy build ${CADDY_VERSION:+"$CADDY_VERSION"} --output "$out_bin" $with_args
    ;;
  go)
    echo "  using local go (installing xcaddy into a temporary GOBIN)"
    gobin="$(mktemp -d)"
    GOBIN="$gobin" go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
    GOOS=linux GOARCH="$GOARCH" "$gobin/xcaddy" build ${CADDY_VERSION:+"$CADDY_VERSION"} --output "$out_bin" $with_args
    rm -rf "$gobin"
    ;;
  docker)
    echo "  using $GO_IMAGE (no local Go toolchain needed)"
    # GOTOOLCHAIN=auto is not optional here: the official golang images pin it to
    # `local`, and provider modules move their minimum Go version independently of
    # this image tag (caddy-dns/ovh already needs 1.24). With `auto`, Go fetches
    # the toolchain a module asks for instead of failing the build.
    # --user: the golang image runs as root, which would leave a root-owned binary
    # on the bind mount that this (deliberately non-root) builder cannot chmod or
    # package. Running as the caller means GOPATH/GOCACHE/HOME must move somewhere
    # writable too, hence /tmp — /go and /root belong to root in the image.
    docker run --rm \
      --user "$(id -u):$(id -g)" \
      -v "$(dirname "$out_bin")":/out \
      -e "HOME=/tmp" -e "GOPATH=/tmp/go" -e "GOCACHE=/tmp/go-build" \
      -e "GOOS=linux" -e "GOARCH=$GOARCH" -e "GOARM=${GOARM:-}" \
      -e "CGO_ENABLED=0" -e "GOTOOLCHAIN=auto" \
      "$GO_IMAGE" bash -c "
        set -e
        go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
        /tmp/go/bin/xcaddy build $CADDY_VERSION --output /out/drumee-caddy $with_args
      "
    ;;
  *)
    echo "FATAL: no way to build the Caddy binary." >&2
    echo "  Need one of: Docker, or a local Go >= 1.${GO_MIN_MINOR} (optionally with xcaddy)." >&2
    echo "  Debian bookworm's golang-go is 1.19 — too old for xcaddy; Docker is the" >&2
    echo "  easiest path (CADDY_BUILD=docker), or install Go from https://go.dev/dl/." >&2
    exit 1
    ;;
esac

[ -s "$out_bin" ] || { echo "FATAL: the Caddy build produced no binary" >&2; exit 1; }
chmod 0755 "$out_bin"
echo "  built $(du -h "$out_bin" | cut -f1) binary"

# Record what was compiled in: drumee-caddy's postinst validates the configured
# provider against this list instead of letting Caddy fail obscurely at startup.
mkdir -p "$build_dir/files/usr/share/$packagename"
printf '%s\n' $modules > "$build_dir/files/usr/share/$packagename/dns-modules"
# Record the version that was actually built, not the one requested — with no pin
# that is the only place it is written down. The binary can only be asked when it
# was built for this machine's architecture.
resolved=""
if [ "$deb_arch" = "$(dpkg --print-architecture)" ]; then
  resolved="$("$out_bin" version 2>/dev/null | head -1 | awk '{print $1}')"
fi
printf '%s\n' "${resolved:-${CADDY_VERSION:-latest}}" \
  > "$build_dir/files/usr/share/$packagename/caddy-version"
echo "  caddy version: ${resolved:-${CADDY_VERSION:-latest}}"

# Units + helper scripts.
rsync -ar --exclude ".git" "${base}/etc" "$build_dir/files/"
rsync -ar --exclude ".git" "${base}/usr" "$build_dir/files/"
chmod 0755 "$build_dir/files/usr/sbin/drumee-caddy-config" \
           "$build_dir/files/usr/sbin/drumee-caddy-export-certs"

cd "$build_dir"
package=${packagename}_${version}
echo "BUILDING PACKAGE $package IN $build_dir"
# --single, not --indep: this package ships a compiled binary, so it is
# Architecture: any and produces <name>_<version>_<arch>.deb.
dh_make --native --yes --single --packagename "$package" --email "$email"
for f in "${base}"/debian/*; do
  cp -r "$f" "$build_dir/debian/"
done
dpkg-buildpackage -k"$email"

# copyToTarget() in utils/functions.sh only knows about _all.deb; this package is
# architecture specific, so copy it here.
if [ -d "$DEB_BUILD_TARGET" ]; then
  for deb in "${base}/build/${package}_"*.deb; do
    [ -f "$deb" ] || continue
    echo "Copying $deb to $DEB_BUILD_TARGET"
    cp "$deb" "$DEB_BUILD_TARGET"
  done
fi

echo "Done: $(ls "${base}/build/${package}"_*.deb 2>/dev/null | paste -sd' ' -)"
