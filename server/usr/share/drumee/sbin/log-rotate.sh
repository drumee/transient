#!/bin/bash
source /etc/drumee/drumee.sh
base_dir=$DRUMEE_LOG_DIR
cd $base_dir
rotate_file()
{
  file=$1
  i=$2
  if [ -f $file.$i ] 
  then
    if [ -f $file.$(expr $i + 1) ]
    then 
      mv $file.$(expr $i + 1) $file.$(expr $i + 2)
    fi
    mv $file.$i $file.$(expr $i + 1)
  fi
}

for file in $(ls $base_dir/*.log)
do
  for i in 7 6 5 4 3 2 1
  do
    rotate_file $file $i
  done
  cp $file $file.1
  chown $DRUMEE_SYSTEM_USER:$DRUMEE_SYSTEM_USER $file.1
  echo '' > $file
done
exit 0