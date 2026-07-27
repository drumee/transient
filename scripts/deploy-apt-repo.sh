#!/bin/bash
# Deploy the flat APT repository to a VPS running nginx.
#
# Uploads the repo files (Packages, Release, InRelease, .deb files, keyring)
# and installs an nginx config to serve them over HTTPS.
#
# Prerequisites on the VPS:
#   - nginx installed and running
#   - certbot (or other ACME client) for TLS on apt.drumee.net
#   - SSH access as the deploy user
#
# Usage:
#   scripts/deploy-apt-repo.sh --host=USER@HOST [--repo-dir=DIR] [--domain=DOMAIN]
#
# Env:
#   APT_LOCAL_DIR   local repo dir to upload (default: apt-repo)
set -euo pipefail

DOMAIN="apt.drumee.net"
REPO_DIR="/var/www/apt.drumee.net"
HOST=""
APT_LOCAL_DIR="${APT_LOCAL_DIR:-apt-repo}"

for arg in "$@"; do
  case $arg in
    --host=*)      HOST="${arg#*=}" ;;
    --repo-dir=*)  REPO_DIR="${arg#*=}" ;;
    --domain=*)    DOMAIN="${arg#*=}" ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

[ -n "$HOST" ] || { echo "error: --host=USER@HOST required" >&2; exit 2; }
[ -d "$APT_LOCAL_DIR" ] || { echo "error: local repo dir not found: $APT_LOCAL_DIR" >&2; exit 2; }
[ -f "$APT_LOCAL_DIR/InRelease" ] || { echo "error: $APT_LOCAL_DIR does not look like an APT repo (no InRelease)" >&2; exit 2; }

echo "==> Creating remote directory $REPO_DIR"
ssh "$HOST" "sudo mkdir -p $REPO_DIR && sudo chown \$(whoami): $REPO_DIR"

echo "==> Uploading repo files"
rsync -avz --delete "$APT_LOCAL_DIR/" "$HOST:$REPO_DIR/"

echo "==> Installing nginx config"
NGINX_CONF=$(cat <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Redirect to HTTPS (uncomment after certbot has run)
    # return 301 https://\$host\$request_uri;

    root ${REPO_DIR};
    autoindex off;

    # APT clients fetch these paths
    location / {
        # Allow .deb downloads and repo metadata
        try_files \$uri =404;
    }

    # Cache-control: metadata changes on every publish, .debs are immutable
    location ~* \.(deb)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    location ~* (Packages|Packages\.gz|Release|InRelease|Release\.gpg)$ {
        expires 5m;
        add_header Cache-Control "public, must-revalidate";
    }
}
NGINX
)

ssh "$HOST" "echo '$NGINX_CONF' | sudo tee /etc/nginx/sites-available/${DOMAIN} > /dev/null"
ssh "$HOST" "sudo ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/"
ssh "$HOST" "sudo nginx -t && sudo systemctl reload nginx"

cat <<MSG

==> Deployed to $HOST:$REPO_DIR

Next steps on the VPS:
  1. Set up TLS:
       sudo apt install certbot python3-certbot-nginx
       sudo certbot --nginx -d ${DOMAIN}

  2. After certbot succeeds, edit /etc/nginx/sites-available/${DOMAIN}:
     - Uncomment the "return 301" line in the port-80 block
     - certbot will have added the port-443 block automatically

Clients can then install with:

  curl -fsSL https://${DOMAIN}/drumee-archive-keyring.asc \\
    | sudo tee /etc/apt/keyrings/drumee.asc >/dev/null
  echo "deb [signed-by=/etc/apt/keyrings/drumee.asc] https://${DOMAIN}/ ./" \\
    | sudo tee /etc/apt/sources.list.d/drumee.list
  sudo apt update && sudo apt install drumee-server-pod drumee-ui-pod drumee-static

MSG
