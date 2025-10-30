#!/bin/bash
shopt -s extglob dotglob
basedir=$1
mfsdir=$2
localfile=$3
extension=$4
mv $localfile $basedir/orig.$extension
mv $mfsdir $mfsdir.tmp

# Create a link for local access until synced into glusterfs
ln -s $basedir $mfsdir

# Sync local content into glusterfs
rsync -ra $basedir/ $mfsdir.tmp/


if [ -f $mfsdir/dont-remove-this-dir ]
then
    echo "Wrong mfsdir $mfsdir"
    exit 1;
fi
if [ -f $basedir/dont-remove-this-dir ]
then
    echo "Wrong basedir $basedir"
    exit 1;
fi

rm -f $mfsdir
mv $mfsdir.tmp $mfsdir
rm -rf $basedir
