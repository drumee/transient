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

prompt drumee-test/description
echo export DRUMEE_DESCRIPTION=$RET >> $env_file

prompt drumee-test/domain "^([a-zA-Z0-9_\-]+)(\.[a-zA-Z0-9_\-]+)*$"
echo DRUMEE_DOMAIN_NAME=$RET >> $env_file

echo cat $env_file

# # DRUMEE_DOMAIN_NAME
# dom_pattern="^([a-zA-Z0-9_\-]+)(\.[a-zA-Z0-9_\-]+)*$"
# db_input high drumee/domain || true
# db_go
# db_get drumee/domain 
# is_valid=$(echo $RET | grep -E "$dom_pattern")
# while [ "$is_valid" = "" ]
# do
#   db_input high drumee/domain || true
#   db_go
#   db_get drumee/domain
#   is_valid=$(echo $RET | grep -E "$dom_pattern")
# done
# echo export DRUMEE_DOMAIN_NAME=$RET >> $env_file

# if [ "$DRUMEE_DOMAIN_NAME" = "local" ]; then
#   db_input high drumee/local_mode || true
#   db_go
#   db_get drumee/local_mode
#   LOCAL_MODE=$RET
# else
#   db_input high drumee/services || true
#   db_go
#   db_get drumee/services
#   SERVICES=$RET
# fi

# # PUBLIC_IP4
# ip4_pattern="^([0-9]{1,3})(\.[0-9]{1,3}){3}$"
# db_input high drumee/public_ip4 || true
# db_go
# db_get drumee/public_ip4
# is_valid=$(echo $RET | grep -E "$ip4_pattern")
# while [ "$is_valid" = "" ]
# do
#   db_input high drumee/public_ip4 || true
#   db_go
#   db_get drumee/public_ip4
#   is_valid=$(echo $RET | grep -E "$ip4_pattern")
# done
# echo export PUBLIC_IP4=$RET >> $env_file

# # PUBLIC_IP6
# ip6_pattern="^([[:xdigit:]]{1,4})(:[[:xdigit:]]{0,4})*$"
# db_input high drumee/public_ip6 || true
# db_go
# db_get drumee/public_ip6 
# is_valid=$(echo $RET | grep -E "$ip6_pattern")
# while [ "$is_valid" = "" ]
# do
#   db_input high drumee/public_ip6 || true
#   db_go
#   db_get drumee/public_ip6
#   is_valid=$(echo $RET | grep -E "$ip6_pattern")
# done
# echo export PUBLIC_IP6=$RET >> $env_file

# # ADMIN_EMAIL
# email_pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$"
# db_input high drumee/admin_email || true
# db_go
# db_get drumee/admin_email 
# is_valid=$(echo $RET | grep -E "$email_pattern")
# while [ "$is_valid" = "" ]
# do
#   db_input high drumee/admin_email || true
#   db_go
#   db_get drumee/admin_email
#   is_valid=$(echo $RET | grep -E "$email_pattern")
# done
# ADMIN_EMAIL=$RET
# echo export ADMIN_EMAIL=$RET >> $env_file

# # ACME_EMAIL_ACCOUNTenv_file
# db_input high drumee/acme_email_account || true
# db_go
# db_get drumee/acme_email_account
# if [ "$RET" = "" ]; then
#   echo export ACME_EMAIL_ACCOUNT=$ADMIN_EMAIL >> $env_file
# else 
#   is_valid=$(echo $RET | grep -E "$email_pattern")
#   while [ "$is_valid" = "" ]
#   do
#   db_input high drumee/acme_email_account || true
#   db_go
#   db_get drumee/acme_email_account
#     is_valid=$(echo $RET | grep -E "$email_pattern")
#   done
#   echo export ACME_EMAIL_ACCOUNT=$RET >> $env_file
# fi

# # DRUMEE_DB_DIR
# dir_pattern='^/+(usr|bin|sys|proc|tmp|etc|lib.*|boot|dev|sbin|opt|media|mnt|vmlinuz.*|lost.+|snap|root|run|initrd.*)'
# db_input high drumee/db_dir || true
# db_go
# db_get drumee/db_dir
# is_valid=$(echo $RET | grep -E "$dir_pattern")
# while [ "$is_valid" != "" ]
# do
#   db_input high drumee/db_dir || true
#   db_go
#   db_get drumee/db_dir
#   is_valid=$(echo $RET | grep -E "$dir_pattern")
# done
# echo export DRUMEE_DB_DIR=$RET >> $env_file

# # DRUMEE_DATA_DIR
# db_input high drumee/data_dir || true
# db_go
# db_get drumee/data_dir
# is_valid=$(echo $RET | grep -E "$dir_pattern")
# while [ "$is_valid" != "" ]
# do
#   db_input high drumee/data_dir || true
#   db_go
#   db_get drumee/data_dir
#   is_valid=$(echo $RET | grep -E "$dir_pattern")
# done
# echo export DRUMEE_DATA_DIR=$RET >> $env_file

# # BACKUP_LOCATION
# db_input high drumee/backup_location || true
# db_go
# db_get drumee/backup_location
# echo export BACKUP_LOCATION=$RET >> $env_file

# # EXCHANGE_LOCATION
# db_input high drumee/exchange_location || true
# db_go
# db_get drumee/exchange_location
# echo export EXCHANGE_LOCATION=$RET >> $env_file

db_stop