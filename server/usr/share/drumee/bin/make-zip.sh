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
# The staging dir holds symlinks to the real files. p7zip stores symlinks AS
# links unless -l is given (the zip then carries broken alias stubs instead of
# file contents); modern 7-Zip (the "7zip" package) follows symlinks by default
# and rejects -l as an unknown switch. Pass -l only when p7zip is detected.
SL=""
if 7z 2>&1 | grep -qi 'p7zip'; then SL="-l"; fi
nice 7z a -bsp1 -tzip $SL $dest.zip *