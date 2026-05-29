#!/bin/bash
set -e 

base="$(dirname "$(readlink -f "$0")")"
packagename=drumee-static
source ${base}/../utils/env.sh
source ${base}/../utils/functions.sh

force=no
compile=yes
enableApi=no

for arg in "$@"; do
  case $arg in
  --version=*)
    version="${arg#*=}"
    shift
    ;;
  --force=*)
    force="${arg#*=}"
    shift
    ;;
  --compile=*)
    compile="${arg#*=}"
    shift
    ;;
  --enable-api=*)
    enableApi="${arg#*=}"
    shift
    ;;
  --email=*)
    email="${arg#*=}"
    shift
    ;;
  esac
done


# vars are returned as exported
control="${base}/debian/control"
# check_version "$version" "$control"
# check_email "$email" "$control"
# check_build_dir "${base}/build/$version"

version=$(get_version $base)
email=$(get_email $base)
build_dir=$(get_build_dir ${base}/build/$version)
bundle $base "static" "main" "" "srv/drumee/static"
${base}/update-changelog.sh 

cd $build_dir
echo "BUILDING PACKAGE ${packagename}_${version} IN $build_dir"
dh_make --native --yes --indep --packagename ${packagename}_${version} --email $email
rsync -ar "${base}/debian" $build_dir/
for f in $(ls ${base}/debian); do
  #echo "COPYING"  ${base}/debian/$f INTO $build_dir/debian/
  cp -r ${base}/debian/$f $build_dir/debian/
done
dpkg-buildpackage -k$email
