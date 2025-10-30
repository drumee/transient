#!/bin/bash

set -e
source /etc/drumee/drumee.sh
$ACME_DIR/acme.sh/acme.sh --cron --home $ACME_DIR/acme.sh  --config-home /root/acme --dns dns_ovh --cert-home $ACME_DIR/certs/
