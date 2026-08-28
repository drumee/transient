#!/bin/bash
shopt -s extglob dotglob
src=$1
dest=$2
ln -s $src $dest
cp -rf $src $dest.tpm
rm -f $dest 
mv $dest.tpm $dest
