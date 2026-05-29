#!/bin/bash

set -e
if [ "$UID" == "0" ]; then
  echo "You should not run this builder with root privilege"
  exit 1
fi


base="$(dirname "$(readlink -f "$0")")"
source ${base}/../utils/env.sh
source ${base}/../utils/functions.sh

packagename=drumee-server-pod
server_target="$DRUMEE_SERVER_HOME/main"
export REPO_BASE=git@github.com:drumee

version=$(get_version $base)
email=$(get_email $base)
build_dir=$(get_build_dir ${base}/build/$version)
echo Building with email=$email version=$version build_dir=$build_dir

bundle $base "server-team" "preview" "*" $server_target
${base}/update-changelog.sh

init_file=${base}/system/usr/sbin/drumee
chmod a+x $init_file
rsync $init_file ${base}/debian/$packagename.init
rsync $init_file ${base}/etc/init.d/drumee
rsync $init_file ${base}/usr/sbin/drumee
rsync $init_file ${base}/etc/rc3.d/S02drumee
rsync $init_file ${base}/etc/rc6.d/K01drumee
server_base=${base}/src/server-team
cd ${server_base}
# npm i @drumee/server-essentials
# npm i @drumee/server-core
# npm i
# npm audit fix

export REPO_BASE=git@github.com:drumee
# patch_des=/var/lib/drumee/patch/schemas
# bundle $base "schemas-utils" "main" "*" $patch_des

rsync -arp ${server_base}/node_modules $build_dir/files/$server_target
rsync -arp ${server_base}/offline $build_dir/files/$server_target
rsync -arp ${server_base}/package* $build_dir/files/$server_target
rsync -arp ${base}/etc $build_dir/files/
rsync -arp ${base}/usr $build_dir/files/
# rsync -arp ${base}/patches $build_dir/files/$patch_des/
rsync -arp ${base}/var $build_dir/files/

cd $build_dir/files/$DRUMEE_SERVER_HOME
for dir in .pm2 .cache .config .pm2/logs; do
  echo "MAKING $dir"
  mkdir -p $dir
done

cd $build_dir
package=${packagename}_${version}
echo "BUILDING PACKAGE $package IN $build_dir"
dh_make --native --yes --indep --packagename ${packagename}_${version} --email $email
for f in $(ls ${base}/debian); do
  cp -r ${base}/debian/$f $build_dir/debian/
done
dpkg-buildpackage -k$email
if [ -d "${DEB_BUILD_TARGET}" ]; then
  cp $base/build/${package}_all.deb "${DEB_BUILD_TARGET}"
fi
