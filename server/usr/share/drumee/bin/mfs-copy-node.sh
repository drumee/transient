#!/bin/bash
shopt -s extglob dotglob
src=$1
dest=$2
# The source folder is being processed by other task
# Set a link on the work in progress folder
if [ -d $1.wip ];  
then
  ln -s $1.wip $dest
else
  ln -s $src $dest
fi
mkdir -p $dest.tpm
cp -rf $src/* $dest.tpm
rm -f $dest 
mv $dest.tpm $dest

