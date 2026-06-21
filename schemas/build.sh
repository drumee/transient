#!/bin/bash

set -e
if [ "$UID" == "0" ]; then
  echo "You should not run this builder with root privilege"
  exit 1
fi

base="$(dirname "$(readlink -f "$0")")"
packagename=drumee-schemas
source ${base}/../utils/env.sh
source ${base}/../utils/functions.sh

version=$(get_version $base)
email=$(get_email $base)
echo EMAIL ${base} $email $version
build_dir=$(get_build_dir ${base}/build/$version)

REPO_BASE=git@github.com:drumee
bundle $base "setup-schemas" "main" "" "var/lib/drumee/setup-schemas"

if [ "$SEEDS_DIR" = "" ]; then
  SEEDS_DIR=$HOME/docker/data/seeds/
fi
SEEDS_FILE=${base}/var/tmp/drumee/seeds.tgz
if [[ $0 =~ rebuild ]]; then
  echo Removing existing seeds
  rm -f $SEEDS_FILE
fi

if [ -f $SEEDS_FILE ]; then
  echo Already have seeds file. Skipped
else
  if [ -d "$SEEDS_DIR" ]; then
    cd $SEEDS_DIR
    echo Creating seeds $SEEDS_FILE
    tar zcfp $SEEDS_FILE .
  else
    echo "Missing seeds: $SEEDS_FILE"
    echo "Provide a seed using one of:"
    echo "  1. Place a prebuilt seed at $SEEDS_FILE"
    echo "  2. Point SEEDS_DIR at a directory to archive (current: $SEEDS_DIR)"
    echo "  3. Generate a minimal bootstrap seed: schemas/make-seed.sh --out=$SEEDS_FILE"
    echo "See docs/reproducible-builds.md for details."
    exit 1
  fi
fi

bundle $base "schemas" "preview" "" ""
schemas_src=${base}/src/schemas
cd $schemas_src
rsync -arv --exclude ".git:.npmrc" ${base}/var $build_dir/files/

# Install schemas utils
schemas_dir=$build_dir/files/var/lib/drumee/schemas
mkdir -p $schemas_dir
rsync -arvp $schemas_src/bin $schemas_dir/
# Package the genesis entity templates so populate.js stockFactory can stock the
# factory pool at install time (gap #2). populate.js reads GENESIS_DIR, which
# defaults to /var/lib/drumee/schemas/templates/factory.
mkdir -p $schemas_dir/templates
rsync -arvp $schemas_src/templates/factory $schemas_dir/templates/
cp $schemas_src/package.json $schemas_dir/
cd $schemas_dir
npm i

cd $build_dir
package=${packagename}_${version}

echo "BUILDING PACKAGE IN  $build_dir"
dh_make --native --yes --indep --packagename $package --email $email
for f in $(ls ${base}/debian); do
  cp -r ${base}/debian/$f $build_dir/debian/
done
dpkg-buildpackage -k$email

copyToTarget $base/build/${package}
