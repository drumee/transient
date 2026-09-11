#!/usr/bin/env bash
set -euo pipefail

: "${MARIADB_DATABASE:?}"
: "${MARIADB_ROOT_PASSWORD:?}"
: "${PHASE4_TEST_PASSWORD:?}"

phase4_test_fingerprint="$(printf '%s' "$PHASE4_TEST_PASSWORD" | sha512sum | awk '{print $1}')"
if [[ ! "$phase4_test_fingerprint" =~ ^[[:xdigit:]]{128}$ ]]; then
  echo "Could not derive the Phase 4 fixture SHA-512 fingerprint." >&2
  exit 1
fi

# This fixture deliberately uses the e8e7bac8e entity shape (no `type`) while
# provisioning the system principals through the newly added sys_conf table.
# It is used only to prove that the current upgrade can repair real old rows;
# production provisioning remains outside server-runtime.
mariadb --protocol=socket --user=root --password="$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE" <<SQL
INSERT INTO domain (id, name) VALUES (41, 'phase4.kernel.test');
INSERT INTO sys_conf (conf_key, conf_value) VALUES
  ('nobody_id', 'ffffffffffffffff'),
  ('guest_id', 'phase4guest00001'),
  ('public_id', 'phase4guest00001');

INSERT INTO entity (id, ident, db_name, home_dir, area, dom_id, status, ctime, mtime, settings) VALUES
  ('ffffffffffffffff', 'nobody', 'phase4_nobody_identity', '/phase4/nobody', 'system', 41, 'system', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), '{}'),
  ('phase4guest00001', 'guest', 'phase4_guest_identity', '/phase4/guest', 'system', 41, 'system', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), '{}'),
  ('phase4system0001', 'system', 'phase4_system_identity', '/phase4/system', 'system', 41, 'system', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), '{}'),
  ('phase4authuser01', 'phase4-auth', 'phase4_auth_identity', '/phase4/auth', 'personal', 41, 'active', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), '{}'),
  ('phase4denyuser02', 'phase4-denied', 'phase4_deny_identity', '/phase4/denied', 'personal', 41, 'active', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), '{}');

INSERT INTO drumate (id, username, domain_id, fingerprint, profile) VALUES
  ('ffffffffffffffff', 'nobody', 41, '', '{"email":"nobody@phase4.kernel.test","category":"system"}'),
  ('phase4guest00001', 'guest', 41, '', '{"email":"guest@phase4.kernel.test","category":"system"}'),
  ('phase4system0001', 'system', 41, '', '{"email":"system@phase4.kernel.test","category":"system"}'),
  ('phase4authuser01', 'phase4-auth', 41, '${phase4_test_fingerprint}', '{"email":"phase4-auth@kernel.test","firstname":"Phase","lastname":"Authorized"}'),
  ('phase4denyuser02', 'phase4-denied', 41, '${phase4_test_fingerprint}', '{"email":"phase4-denied@kernel.test","firstname":"Phase","lastname":"Denied"}');

INSERT INTO privilege (uid, domain_id, privilege, is_authoritative)
  VALUES
    ('ffffffffffffffff', 41, 1, 1),
    ('phase4guest00001', 41, 1, 1),
    ('phase4system0001', 41, 63, 1),
    ('phase4authuser01', 41, 3, 1);
SQL
