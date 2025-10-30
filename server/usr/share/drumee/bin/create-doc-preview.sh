#!/bin/bash
shopt -s extglob dotglob
if [ -z $1 ] || [ -z $2 ] || [ -z $3 ] || [ -z $4 ]; then
  echo "Usage: $0 fastdir mfsdir tmpfile extension" >&2
  exit 1
fi

fastdir=$1
mfsdir=$2
tmpfile=$3
ext=$4
export HOME=$DRUMEE_TMP_DIR
#echo HOME=$DRUMEE_TMP_DIR

mkdir -p $fastdir/pdfout
pdf=$fastdir/pdfout/orig.pdf
mv $tmpfile $fastdir/orig.$ext

#echo soffice --headless --nolockcheck --convert-to pdf:writer_pdf_Export --outdir $fastdir/pdfout $fastdir/orig.$ext
echo "progress: 5"
soffice --headless --nolockcheck --convert-to pdf:writer_pdf_Export --outdir $fastdir/pdfout $fastdir/orig.$ext
echo "progress: 10"

gm convert -density 200 -auto-orient  ${pdf}'[0]' ${fastdir}/reader-0.png

if [ -f $mfsdir/dont-remove-this-dir ]
then
  echo "Wrong mfsdir $mfsdir"
  exit 1;
fi

# # Create a link for fastdir access until synced into glusterfs
rm -rf $mfsdir
ln -s $fastdir $mfsdir

# # Sync fastdir content into glusterfs
echo "progress: 60"
cp -r $fastdir/ $mfsdir.tmp
rm -f $mfsdir
mv $mfsdir.tmp $mfsdir

if [ -f $fastdir/dont-remove-this-dir ]
then
  echo "Wrong fastdir $fastdir"
  exit 1;
fi

rm -rf $fastdir&

echo "progress: 80"
exit 0
