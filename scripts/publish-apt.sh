#!/bin/bash
# Build a signed flat APT repository from the built .deb files.
# Produces a repo tree you can serve at e.g. https://apt.drumee.io.
#
#   scripts/publish-apt.sh --debs=DIR --out=REPO_DIR [--suite=stable] [--key=EMAIL]
#
# Requires: apt-utils (apt-ftparchive), gpg with the signing secret key.
set -euo pipefail

DEBS="" OUT="" SUITE="stable" KEY=""
for arg in "$@"; do
  case $arg in
    --debs=*)  DEBS="${arg#*=}" ;;
    --out=*)   OUT="${arg#*=}" ;;
    --suite=*) SUITE="${arg#*=}" ;;
    --key=*)   KEY="${arg#*=}" ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done
[ -n "$DEBS" ] && [ -d "$DEBS" ] || { echo "error: --debs=DIR (with .deb files) required" >&2; exit 2; }
[ -n "$OUT" ] || { echo "error: --out=REPO_DIR required" >&2; exit 2; }
command -v apt-ftparchive >/dev/null || { echo "error: install apt-utils" >&2; exit 1; }
command -v gpg >/dev/null || { echo "error: gpg required for signing" >&2; exit 1; }

ARCH_DIR="$OUT/dists/$SUITE/main/binary-all"
POOL="$OUT/pool/main"
mkdir -p "$ARCH_DIR" "$POOL"

echo "==> Collecting packages"
cp -v "$DEBS"/*.deb "$POOL"/

echo "==> Generating Packages index"
( cd "$OUT" && apt-ftparchive packages pool/main > "dists/$SUITE/main/binary-all/Packages" )
gzip -kf "$ARCH_DIR/Packages"

echo "==> Generating Release"
cat > /tmp/apt-release.conf <<EOF
APT::FTPArchive::Release::Origin "Drumee";
APT::FTPArchive::Release::Label "Drumee";
APT::FTPArchive::Release::Suite "$SUITE";
APT::FTPArchive::Release::Codename "$SUITE";
APT::FTPArchive::Release::Architectures "all";
APT::FTPArchive::Release::Components "main";
EOF
( cd "$OUT" && apt-ftparchive -c /tmp/apt-release.conf release "dists/$SUITE" > "dists/$SUITE/Release" )

echo "==> Signing Release"
KEYARG=(); [ -n "$KEY" ] && KEYARG=(--local-user "$KEY")
( cd "$OUT/dists/$SUITE"
  gpg "${KEYARG[@]}" --batch --yes --clearsign -o InRelease Release
  gpg "${KEYARG[@]}" --batch --yes -abs -o Release.gpg Release
)

echo "==> Exporting public key to $OUT/drumee-archive-keyring.asc"
gpg "${KEYARG[@]}" --armor --export ${KEY:-} > "$OUT/drumee-archive-keyring.asc"

cat <<MSG

Done. Serve $OUT at your repo URL (e.g. https://apt.drumee.io), then clients add:

  curl -fsSL https://apt.drumee.io/drumee-archive-keyring.asc \\
    | sudo tee /etc/apt/keyrings/drumee.asc >/dev/null
  echo "deb [signed-by=/etc/apt/keyrings/drumee.asc] https://apt.drumee.io $SUITE main" \\
    | sudo tee /etc/apt/sources.list.d/drumee.list
  sudo apt update && sudo apt install drumee
MSG
