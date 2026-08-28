#!/bin/bash
shopt -s extglob dotglob

export HOME=$1 
if [ "$3" == "" ]; then
  filter=pdf:writer_pdf_Export
else
  filter=$3
fi

/usr/bin/soffice soffice --headless --invisible --convert-to "${filter}" --outdir $1 $2
