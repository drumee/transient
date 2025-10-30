#!/usr/bin/bash
source /etc/drumee/drumee.sh
if [[ "$DRUMEE_TMP_DIR" =~ /(.+)/(.+) ]];
then 
    find $DRUMEE_TMP_DIR -type f -mtime +7 -exec rm -f {} \;
fi