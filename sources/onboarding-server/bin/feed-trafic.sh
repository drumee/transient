#!/bin/bash
base="$(dirname "$(readlink -f "$0")")"
cd $base
outdir=/data/tmp/analytics
node nginx-parser.js --age=320 --output=$outdir --verbose=0
chown -R www-data:www-data $outdir
