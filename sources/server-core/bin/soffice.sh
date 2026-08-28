#!/bin/bash
shopt -s extglob dotglob

export HOME=$1 
if [ -f /usr/local/bin/libreoffice ]; then
  /usr/local/bin/libreoffice --headless --invisible --convert-to pdf --outdir $1 $2
else 
  if [ -f /usr/bin/soffice ]; then 
    /usr/bin/soffice soffice --headless --invisible --convert-to pdf:writer_pdf_Export --outdir $1 $2
  fi
fi 

