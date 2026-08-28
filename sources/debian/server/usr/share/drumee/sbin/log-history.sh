#!/bin/bash
source /etc/drumee/drumee.sh
base_dir=$DRUMEE_LOG_DIR
cd $base_dir

dest=$(date +"%Y-%m-%d")
mkdir -p $dest
for file in $(ls *.log)
do
  cp $file $dest/$file
  chown $DRUMEE_SYSTEM_USER:$DRUMEE_SYSTEM_USER $dest/$file
  echo '' > $file
done
exit 0