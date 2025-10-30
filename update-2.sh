#!/usr/bin/bash
echo Updating Drumee packages
cd /var/tmp/drumee/packages
curl -O https://app.drumee.com/debian/update/drumee-ui-pod_2.9.2_all.deb
curl -O https://app.drumee.com/debian/update/drumee-server-pod_2.6.25_all.deb
curl -O https://app.drumee.com/debian/update/drumee-patch_1.0.4_all.deb
dpkg -i drumee-server-pod_2.6.25_all.deb
dpkg -i drumee-ui-pod_2.9.2_all.deb

drumee restart
