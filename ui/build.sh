#!/bin/bash
set -e 

# if [ "$UID" == "0" ]; then 
#   echo "You should not run this builder with root privilege"
#   exit 1
# fi

base="$(dirname "$(readlink -f "$0")")"
source ${base}/../utils/env.sh
source ${base}/../utils/functions.sh

compile=yes
type="pod"
enableApi=no
for arg in "$@"; do
  case $arg in
  --type=*)
    type="${arg#*=}"
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
  esac
done

case "$type" in
platform)
  branch="public"
  export DRUMEE_INSTANCE_NAME=main
  export UI_BUILD_MODE=production
  ;;
pod)
  branch="public"
  export DRUMEE_INSTANCE_NAME=main
  export UI_BUILD_MODE=production
  ;;
dev)
  branch="web/pod"
  export DRUMEE_INSTANCE_NAME=main
  export UI_BUILD_MODE=development
  ;;
evaluation)
  branch="dist/evaluation"
  export DRUMEE_INSTANCE_NAME=main
  export UI_BUILD_MODE=production
  ;;
*)
  echo "Unexpected type $type"
  exit 1
  ;;
esac

version=$(get_version $base $type)
email=$(get_email $base $type)
build_dir=$(get_build_dir ${base}/$type/build/$version)

export DRUMEE_UI_HOME=$build_dir/files/$DRUMEE_UI_HOME
export UI_BUILD_PATH=$DRUMEE_UI_HOME/main
mkdir -p $UI_BUILD_PATH
echo -n "Checking global npm packages... "
missing=""
packages=""

export UI_SRC_PATH=${base}/src/ui-team
export REPO_BASE=git@github.com:drumee
bundle $base "ui-team" "optimization"
${base}/update-changelog.sh 

echo $UI_SRC_PATH
export PATH=$UI_SRC_PATH/node_modules/.bin:$PATH

cd $UI_SRC_PATH
npx update-browserslist-db@latest
npm i
npm audit fix

config=webpack.js
echo "BUILDING FROM CONFIG $config" 
export BUILD_TARGET=app
export ENDPOINT=main
export UI_BUILD_MODE=production
webpack --config $config
if [ "$enableApi" == "yes" ]; then
  export BUILD_TARGET=api
  webpack --config $config
fi

rm -f $UI_BUILD_PATH/app/stats.json
rm -rf $build_dir/debian/

cd $build_dir
packagename=drumee-ui-${type}
package=${packagename}_${version}
echo "BUILDING PACKAGE $package IN $build_dir"
dh_make --native --yes --indep --packagename $package --email $email
rsync -ar "${base}/$type/debian" $build_dir/
for f in $(ls ${base}/$type/debian); do
  #echo "COPYING"  ${base}$type/debian/$f INTO $build_dir/debian/
  cp -r ${base}/$type/debian/$f $build_dir/debian/
done
dpkg-buildpackage -k$email

copyToTarget $base/$type/build/${package}
