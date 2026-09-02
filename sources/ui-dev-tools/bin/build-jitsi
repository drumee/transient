#!/bin/bash
script_dir=$(dirname $(readlink -f $0))

if [ "$UI_SRC_PATH" = "" ]; then
  export UI_SRC_PATH=$(dirname $script_dir)
fi

jitsi_dir=$UI_SRC_PATH/src/vendor/lib-jitsi-meet
cd $jitsi_dir
npm run build

# rsync -arv --delete $jitsi_dir/dist/umd/ $UI_SRC_PATH/src/vendor/lib/jitsi/
