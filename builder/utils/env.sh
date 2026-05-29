if [ "$UID" == "0" ]; then 
  echo "You should not run this builder with root privilege"
  exit 1
fi

export DRUMEE_STATIC_DIR=/srv/drumee/static
export DRUMEE_DATA_DIR=/data
export DRUMEE_MFS_DIR=/data/mfs
export DRUMEE_RUNTIME_DIR=/srv/drumee/runtime
export DRUMEE_TMP_DIR=/srv/drumee/runtime/tmp
export DRUMEE_CACHE_DIR=/srv/drumee/cache
export DRUMEE_SYSTEM_USER=www-data
export DRUMEE_SERVER_HOME=/srv/drumee/runtime/server

export DRUMEE_UI_HOME=/srv/drumee/runtime/ui
export ACME_DIR=/etc/acme
export PUBLIC_UI_LOCALE=/srv/drumee/static/locale
