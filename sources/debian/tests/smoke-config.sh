#!/bin/bash
# Assertion tests for config/render.mjs — the config single-source-of-truth.
# Runs anywhere with node; no Docker required.
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
R="node $root/config/render.mjs"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
pass=0; fail=0
ok()   { printf '  \033[1;32mPASS\033[0m %s\n' "$1"; pass=$((pass+1)); }
no()   { printf '  \033[1;31mFAIL\033[0m %s\n' "$1"; fail=$((fail+1)); }

# helper: write a config
cfg() { cat > "$tmp/c.yaml"; }

minimal() {
  cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
tls:
  mode: acme
  acme_email: s@b.co
EOF
}

# 1. minimal valid config renders
minimal
if $R validate --config "$tmp/c.yaml" >/dev/null 2>&1; then ok "minimal config validates"; else no "minimal config validates"; fi

# 2. missing required admin_email fails
cfg <<EOF
instance:
  description: T
  domain: example.com
tls:
  mode: acme
  acme_email: s@b.co
EOF
$R validate --config "$tmp/c.yaml" >/dev/null 2>&1 && no "missing admin_email rejected" || ok "missing admin_email rejected"

# 3. bad email fails
cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: nope
tls:
  mode: acme
  acme_email: s@b.co
EOF
$R validate --config "$tmp/c.yaml" >/dev/null 2>&1 && no "bad email rejected" || ok "bad email rejected"

# 4. tls own without cert path fails
cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
tls:
  mode: own
EOF
$R validate --config "$tmp/c.yaml" >/dev/null 2>&1 && no "own-ssl without path rejected" || ok "own-ssl without path rejected"

# 5. unknown key rejected
cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
  bogus: 1
tls:
  mode: acme
  acme_email: s@b.co
EOF
$R validate --config "$tmp/c.yaml" >/dev/null 2>&1 && no "unknown key rejected" || ok "unknown key rejected"

# 6. env contains generated secret + ports + expected var names
minimal
env_out="$($R env --config "$tmp/c.yaml" 2>/dev/null)"
echo "$env_out" | grep -q '^DB_PASSWORD=..*'        && ok "DB_PASSWORD generated"   || no "DB_PASSWORD generated"
echo "$env_out" | grep -q '^API_PORT=24000'         && ok "API_PORT default (restPort)" || no "API_PORT default (restPort)"
echo "$env_out" | grep -q '^DRUMEE_DOMAIN_NAME=example.com' && ok "wizard-compatible var names" || no "wizard-compatible var names"

# 7. profiles toggle into compose + COMPOSE_PROFILES
cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
tls:
  mode: acme
  acme_email: s@b.co
optional_services:
  jitsi: true
EOF
$R env --config "$tmp/c.yaml" 2>/dev/null | grep -q '^COMPOSE_PROFILES=jitsi' && ok "COMPOSE_PROFILES set" || no "COMPOSE_PROFILES set"

# 8. debconf preseed has drumee-infra/* owner+keys
minimal
$R debconf --config "$tmp/c.yaml" 2>/dev/null | grep -q 'drumee-infra	drumee-infra/domain	string	example.com' \
  && ok "debconf preseed well-formed" || no "debconf preseed well-formed"

# 9. TLS: DNS-01 challenge selection reaches the tls_method preseed key
minimal
$R debconf --config "$tmp/c.yaml" 2>/dev/null | grep -q 'tls_method	select	acme-dns-server' \
  && ok "default TLS = acme via local DNS server" || no "default TLS = acme via local DNS server"
cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
tls:
  mode: acme
  acme_email: s@b.co
  dns_challenge: api
  acme_env_file: /etc/drumee/credential/dns-api.env
EOF
dc_out="$($R debconf --config "$tmp/c.yaml" 2>/dev/null)"
echo "$dc_out" | grep -q 'tls_method	select	acme-dns-api' \
  && ok "dns_challenge=api selects the provider-API method" || no "dns_challenge=api selects the provider-API method"
echo "$dc_out" | grep -q 'acme_env_file	string	/etc/drumee/credential/dns-api.env' \
  && ok "credentials file path preseeded" || no "credentials file path preseeded"
# api needs the file path — it is what makes setup-infra skip BIND9
cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
tls:
  mode: acme
  acme_email: s@b.co
  dns_challenge: api
EOF
$R validate --config "$tmp/c.yaml" >/dev/null 2>&1 \
  && no "api without acme_env_file rejected" || ok "api without acme_env_file rejected"
# 10. TLS terminated by Caddy: provider is preseeded, the API token never is
cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
tls:
  mode: acme
  acme_email: s@b.co
  terminator: caddy
  dns_provider: ovh
EOF
dc_out="$($R debconf --config "$tmp/c.yaml" 2>/dev/null)"
echo "$dc_out" | grep -q 'tls_method	select	caddy' \
  && ok "terminator=caddy selects the caddy method" || no "terminator=caddy selects the caddy method"
echo "$dc_out" | grep -q 'caddy_dns_provider	string	ovh' \
  && ok "caddy DNS provider preseeded" || no "caddy DNS provider preseeded"
echo "$dc_out" | grep -q 'caddy_domain	string	example.com' \
  && ok "caddy domain defaults to the instance domain" || no "caddy domain defaults to the instance domain"
# The token is a secret: debconf asks for it, the renderer must never emit it.
echo "$dc_out" | grep -qi 'api_key\|token\|password' \
  && no "no DNS token in the rendered preseed" || ok "no DNS token in the rendered preseed"
# caddy needs the provider module name
cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
tls:
  mode: acme
  acme_email: s@b.co
  terminator: caddy
EOF
$R validate --config "$tmp/c.yaml" >/dev/null 2>&1 \
  && no "caddy without dns_provider rejected" || ok "caddy without dns_provider rejected"
# caddy replaces acme.sh, so the acme.sh knobs must not be mixed in
cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
tls:
  mode: acme
  acme_email: s@b.co
  terminator: caddy
  dns_provider: ovh
  dns_challenge: api
  acme_env_file: /etc/drumee/credential/dns-api.env
EOF
$R validate --config "$tmp/c.yaml" >/dev/null 2>&1 \
  && no "caddy mixed with acme.sh knobs rejected" || ok "caddy mixed with acme.sh knobs rejected"

# own certs still map to the own path (and keep the legacy own_ssl flag true)
cfg <<EOF
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
tls:
  mode: own
  own_cert_path: /etc/drumee/ssl
EOF
dc_out="$($R debconf --config "$tmp/c.yaml" 2>/dev/null)"
echo "$dc_out" | grep -q 'tls_method	select	own' && echo "$dc_out" | grep -q 'own_ssl	boolean	true' \
  && ok "mode=own maps to own + legacy own_ssl" || no "mode=own maps to own + legacy own_ssl"

echo
echo "config smoke: $pass passed, $fail failed"
[ "$fail" = 0 ]
