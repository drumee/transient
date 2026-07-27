#!/bin/bash

set -e
if [ "$UID" == "0" ]; then
  echo "You should not run this builder with root privilege"
  exit 1
fi

base="$(dirname "$(readlink -f "$0")")"
source ${base}/../utils/env.sh
source ${base}/../utils/functions.sh
#echo ${base}../utils/functions.sh

type=pod

version=$(get_version $base)
email=$(get_email $base)
build_dir=$(get_build_dir ${base}/build/$version)

#bundle $base "static" "master" "" "srv/drumee/static"
REPO_BASE=git@github.com:drumee
lib_dir=var/lib/drumee

bundle $base "setup-infra" "main" "" "$lib_dir/setup-infra"
bundle_acme $base "usr/share/acme"
[ -d ${base}/usr ] && rsync -ar --exclude ".github:.git:.npmrc" ${base}/usr $build_dir/files/
rsync -ar --exclude ".git:.npmrc" ${base}/etc $build_dir/files/

mkdir -p $build_dir/files/$lib_dir
mkdir -p ${build_dir}/files${DRUMEE_SERVER_HOME}/main
rsync -ar --exclude ".git:.npmrc" ${base}/$lib_dir/utils $build_dir/files/$lib_dir/

cd $build_dir
packagename=drumee-infra
package=${packagename}_${version}
echo "BUILDING PACKAGE $package IN $build_dir"
dh_make --native --yes --indep --packagename $package --email $email
for f in $(ls ${base}/debian); do
  cp -r ${base}/debian/$f $build_dir/debian/
done
dpkg-buildpackage -k$email

copyToTarget $base/build/${package}
