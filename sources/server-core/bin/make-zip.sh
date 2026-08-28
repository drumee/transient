#!/bin/bash
shopt -s extglob dotglob

base=$1
dest=$2
if [ -z $base ]; then 
  echo "Requires basedir" >&2
  exit 1;
fi
if [ -z $dest ]; then 
  echo "Requires destination" >&2
  exit 1;
fi
cd $base;
nice 7z a -bsp1 -tzip -l $dest.zip *
