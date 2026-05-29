#!/bin/sh
set +e
echo "Installing Drumee from Debian Packages"
script_dir=$(dirname $(readlink -f $0))
base=$(dirname $script_dir)

mkdir -p /var/tmp/drumee
env_file=/var/tmp/drumee/env.sh
echo "# env file automatically generated " > $env_file

# Source debconf library
. /usr/share/debconf/confmodule
. $base/utils/prompt.sh

prompt drumee-infra/description
echo export DRUMEE_DESCRIPTION=$RET >> $env_file

prompt drumee-infra/domain "^([a-z0-9_\-]+)(\.[a-z0-9_\-]+)*$"
DRUMEE_DOMAIN_NAME=$RET
echo export DRUMEE_DOMAIN_NAME=$DRUMEE_DOMAIN_NAME >> $env_file


if [ "$DRUMEE_DOMAIN_NAME" = "local" ]; then
  prompt drumee-infra/local_mode
  LOCAL_MODE=$RET
  echo export LOCAL_MODE=$LOCAL_MODE >> $env_file
else
  prompt drumee-infra/service
  SERVICES=$RET
  echo export SERVICES=$SERVICES >> $env_file
fi

# Scan ip addresses and preset them into selectable menu
preset_ip_addr
prompt drumee-infra/ip4
PUBLIC_IP4=$RET
if [ "$RET" = "other" ]; then
  prompt drumee-infra/public_ip4 "^([0-9]{1,3})(\.[0-9]{1,3}){3}$"
  PUBLIC_IP4=$RET
fi
echo export PUBLIC_IP4=$PUBLIC_IP4 >> $env_file

prompt drumee-infra/ip6
PUBLIC_IP6=$RET
if [ "$RET" = "other" ]; then
  prompt drumee-infra/public_ip6 "([a-f0-9:]+:+)+[a-f0-9]+"
  PUBLIC_IP6=$RET
fi
echo export PUBLIC_IP6=$PUBLIC_IP6 >> $env_file

# Emails
email_pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$"
prompt drumee-infra/admin_email $email_pattern
ADMIN_EMAIL=$RET
echo export ADMIN_EMAIL=$ADMIN_EMAIL >> $env_file

db_set drumee-infra/acme_email $ADMIN_EMAIL
prompt drumee-infra/acme_email $email_pattern
ACME_EMAIL_ACCOUNT=$RET
echo export ACME_EMAIL_ACCOUNT=$ACME_EMAIL_ACCOUNT >> $env_file

# Storages
dir_pattern='^/+(usr|bin|sys|proc|tmp|etc|lib.*|boot|dev|sbin|opt|media|mnt|vmlinuz.*|lost.+|snap|root|run|initrd.*)'

prompt drumee-infra/db_dir $dir_pattern 1
echo export DRUMEE_DB_DIR=$RET >> $env_file

prompt drumee-infra/data_dir $dir_pattern 1
echo export DRUMEE_DATA_DIR=$RET >> $env_file

prompt drumee-infra/backup_location $dir_pattern 1
echo export BACKUP_LOCATION=$RET >> $env_file

prompt drumee-infra/exchange_location $dir_pattern 1
echo export EXCHANGE_LOCATION=$RET >> $env_file

# SSL
prompt drumee-infra/own_ssl $dir_pattern 1
if [ "$RET" = "true" ]; then
  prompt drumee-infra/own_ssl_path
  echo export OWN_SSL=$RET >> $env_file
fi

echo cat $env_file

db_stop