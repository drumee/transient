#!/bin/bash
set -e
for i in infra schemas ui server; do
    echo Building package $i
    $i/build.sh --force=yes
    echo Package $i successfully built
done