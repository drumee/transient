#!/bin/bash
cp /etc/drumee/infrastructure/ecosystem.json  /etc/drumee/infrastructure/ecosystem.orig
sed -i "s/dist\/main/main/g" /etc/drumee/infrastructure/ecosystem.json

cp /etc/drumee/infrastructure/routes/main.conf /etc/drumee/infrastructure/routes/main.orig
sed -i "s/dist\/main/main/g" /etc/drumee/infrastructure/routes/main.conf

source /etc/drumee/drumee.sh
if [ "$DRUMEE_SERVER_MAIN" == "" ]; then
  echo "# Below line has been added by patch from version"
  echo "export DRUMEE_SERVER_MAIN=$DRUMEE_SERVER_HOME/main" >> /etc/drumee/drumee.sh
fi