#!/bin/bash
# Pending server-side patch runner, invoked by the drumee-server-pod postinst on
# every (re)configure. Ships as a no-op placeholder; patch deployments overwrite
# it with the steps to apply. Keep it idempotent and safe to run repeatedly.
exit 0
