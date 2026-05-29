#
# Regular cron jobs for the drumee package
#
0 4	* * *	root	[ -x /opt/drumee/utils/cron/delete.sh ] && /opt/drumee/utils/cron/delete.sh
