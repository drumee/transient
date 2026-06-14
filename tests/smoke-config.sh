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

echo
echo "config smoke: $pass passed, $fail failed"
[ "$fail" = 0 ]
