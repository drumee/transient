#!/bin/bash

set -e
if [ "$UID" == "0" ]; then
  echo "You should not run this builder with root privilege"
  exit 1
fi

base=$0
if [[ $base =~ ^\/ ]]; then
  base=$(dirname $base)
else
  if [[ $base =~ ^\.\/ ]]; then
    base=$(echo $base | sed -e "s/^\.//")
    base="$(pwd)$(dirname $base)"
  else
    base=$(pwd)/$(dirname $base)
  fi
fi

if [[ $base =~ ^.+\/$ ]]; then
  base=$base
else
  base=$base/
fi
packagename=drumee-conference
source ${base}../utils/env.sh
source ${base}../utils/functions.sh
#echo ${base}../utils/functions.sh

force=no
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
  --email=*)
    email="${arg#*=}"
    shift
    ;;
  esac
done

# vars are returned as exported
control="${base}/debian/control"
check_version "$version" "$control"
check_email "$email" "$control"
check_build_dir "${base}/build/$version"


cd $build_dir
echo "BUILDING PACKAGE IN  $build_dir"
dh_make --native --yes --indep --packagename ${packagename}_${version} --email $email
for f in $(ls ${base}/debian); do
  cp -r ${base}/debian/$f $build_dir/debian/
done
dpkg-buildpackage -k$email
