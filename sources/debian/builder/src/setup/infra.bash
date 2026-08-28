#!/bin/bash

set -e
echo "Configuring Drumee Infrastructure"
base=$(dirname $(readlink -f $0))

$base/init/mail.bash

node $base/infra/index.js

if [ ! -f /etc/drumee/drumee.sh ]; then
  echo Could not run Drumee without proper settings
  exit 1
fi

source /etc/drumee/drumee.sh
if [ -d /etc/cron.d/drumee ]; then 
  crontab /etc/cron.d/drumee
fi 


source $base/utils/misc.sh
source $base/utils/jitsi.bash

install_jitsi

protect_dir $DRUMEE_RUNTIME_DIR "no" "mkdir"
protect_dir $DRUMEE_DATA_DIR "yes" "mkdir"
cd $DRUMEE_DATA_DIR

for d in mfs tmp; do
  protect_dir "$DRUMEE_DATA_DIR/$d" "yes"
done


LOG_DIR=$DRUMEE_SERVER_HOME/.pm2/logs

touch $DRUMEE_DATA_DIR/mfs/dont-remove-this-dir
chmod a-w $DRUMEE_DATA_DIR/mfs/dont-remove-this-dir

protect_dir $DRUMEE_STATIC_DIR 
protect_dir /etc/drumee
protect_dir $LOG_DIR "yes"
protect_dir $DRUMEE_CACHE_DIR
protect_dir $DRUMEE_TMP_DIR "yes"
protect_dir $DRUMEE_SERVER_HOME
protect_dir $DRUMEE_EXPORT_DIR
protect_dir $DRUMEE_IMPORT_DIR

$base/init/named.bash
$base/init/acme.bash

clean_vendor_files
setup_dirs
setup_prosody
write_version

crontab  < /etc/cron.d/drumee
echo "Drumee infrastructure done !"
