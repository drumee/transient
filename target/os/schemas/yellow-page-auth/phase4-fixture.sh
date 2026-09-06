#!/usr/bin/env bash
set -euo pipefail

: "${MARIADB_DATABASE:?}"
: "${MARIADB_ROOT_PASSWORD:?}"
: "${PHASE4_TEST_PASSWORD:?}"

mariadb --protocol=socket --user=root --password="$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE" <<SQL
SET @phase4_test_password = '${PHASE4_TEST_PASSWORD}';

INSERT INTO domain (id, name) VALUES (41, 'phase4.kernel.test');

INSERT INTO entity (id, ident, db_name, home_dir, dom_id, status, ctime, mtime, settings) VALUES
  ('phase4authuser01', 'phase4-auth', 'phase4_auth_identity', '/phase4/auth', 41, 'active', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), '{}'),
  ('phase4denyuser02', 'phase4-denied', 'phase4_denied_identity', '/phase4/denied', 41, 'active', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), '{}');

INSERT INTO drumate (id, username, domain_id, fingerprint, profile) VALUES
  ('phase4authuser01', 'phase4-auth', 41, SHA2(@phase4_test_password, 512), '{"email":"phase4-auth@kernel.test","firstname":"Phase","lastname":"Authorized"}'),
  ('phase4denyuser02', 'phase4-denied', 41, SHA2(@phase4_test_password, 512), '{"email":"phase4-denied@kernel.test","firstname":"Phase","lastname":"Denied"}');

INSERT INTO privilege (uid, domain_id, privilege, is_authoritative)
  VALUES ('phase4authuser01', 41, 3, 1);
SQL
