#!/bin/bash

set -e
if [ "$UID" == "0" ]; then
  echo "You should not run this builder with root privilege"
  exit 1
fi

base="$(dirname "$(readlink -f "$0")")"
top=$(dirname $base)

packagename=drumee-patch
source ${top}/utils/env.sh
source ${top}/utils/functions.sh


# vars are returned as exported
# control="${base}/debian/control"
# check_version "$version" "$control"
# check_email "$email" "$control"
# check_build_dir "${base}/build/$version"


version=$(get_version $base)
email=$(get_email $base)
echo EMAIL ${base} $email $version
build_dir=$(get_build_dir ${base}/build/$version)

REPO_BASE=git@github.com:drumee

bundle $base "schemas" "main" "" ""
schemas_src=${base}/src/schemas
cd $schemas_src
npm i @drumee/server-essentials
tmpfile=/tmp/drumee.build.$$
echo $tmpfile
DEPTH=$1
if [ "$DEPTH" = "" ]; then
  DEPTH=2
fi

git log -$DEPTH | egrep "^commit" | awk '{print $2}' > $tmpfile
hash1=$(head -1 $tmpfile)
hash2=$(tail -1 $tmpfile)
echo "DEPTH" "$hash1" "$hash2"
rm -f $tmpfile

if [ "$hash1" != "" -a "$hash2" != "" ]; then
  echo Building manifest
  bin/make-manifest $hash1 $hash2
fi

# bundle_schmas_patches $base $src $manifest "var/lib/drumee/patches/schemas"
rsync -arv --exclude ".git:.npmrc" ${base}/var $build_dir/files/
if [ -f $schemas_src/patches/manifest.txt ]; then
  schemas_dir=$build_dir/files/var/lib/drumee/patches/schemas
  mkdir -p $schemas_dir
  rsync -arv $schemas_src/patches $schemas_dir/
  rsync -arvp $schemas_src/bin $schemas_dir/
  cp $schemas_src/package.json $schemas_dir/
  cd $schemas_dir
  npm i
else
  echo No chage to build patch
  exit 1
fi


# chmod +x $build_dir/files/var/lib/drumee/schemas/patches/
cd $build_dir
echo "BUILDING PACKAGE IN  $build_dir"
dh_make --native --yes --indep --packagename ${packagename}_${version} --email $email
for f in $(ls ${base}/debian); do
  src_file=${base}/debian/$f
  if [ -f $src_file ]; then
    cp -r $src_file $build_dir/debian/
  fi
done
dpkg-buildpackage -k$email
#copyToTarget $base/build/${package}
