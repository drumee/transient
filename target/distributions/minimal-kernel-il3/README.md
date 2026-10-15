# Approved IL-3 minimal-kernel distribution fixture

Private CommonJS integration fixture, approved by the project owner under IL-3
section 10. This directory owns composition only. Canonical infrastructure
remains `drumee/infra-layer`; kernel/runtime/module implementations are unchanged.
No package/image publication, Oxymotion or IL-4 work is included.

From this directory:

```sh
npm ci --ignore-scripts
npm run sources
npm test
npm run build:browser
npm run test:integration
```

Node 22, local Docker/Compose, Git, OpenSSL, ss, dig and Chromium are required.
The integration runner requires explicit local Docker operator privileges.
It creates unique task-owned projects, loopback high ports and private temporary
roots. Do not run it against a shared deployment root. The runner never changes
host DNS, trust, firewall or unrelated containers/volumes. Existing Docker images
are pulled by immutable digest; only uniquely labelled fixture image tags are
removed. Failure reports use codes, not credentials or raw SQL.

`sources.lock.json` pins private transitional modules and selected unchanged
Essentials primitives. `npm ci` pins standalone packages and integrity, including
an explicit system-mfs Git archive ahead of its npm release. `vendor`, build
output, node_modules and cache are ignored. No sibling checkout is required.
Preserved source notices and a generated SHA-256 inventory accompany acquisition.
See [PROVENANCE.md](PROVENANCE.md).

`lib/initialize.js` is an explicitly authorized disposable installation job:
runtime manifest execution, platform bootstrap, real control-plane Hub creation,
module provisioning and acceptance accounts. It never imports historical Team
schemas. Accounts/passwords are created only into an owned private pending state
file, then preserved; conflicting SQL state fails closed. The read-only validator
does not create sessions or repair accounts. The host validates preconditions
and performs no startup provisioning.

`lib/distribution-driver.js` is an explicit privileged test driver. Before the
installation job it grants the existing infrastructure account DDL/DML/routine
access only to `yp` and `hub_` shards through the owned MariaDB local socket.
MariaDB root stays localhost-only; no plaintext credential enters argv. This
grant policy is deliberately a fixture policy, not a proposed production least
privilege account architecture. Infra Layer's ordinary driver does not supply
these grants. A distribution production integration must own that prerequisite.

Nginx sees only read-only public artifacts and the internal protected content
view. Acceptance secrets, MariaDB files, CA issuer keys and general configuration
are separate mounts. Public/artifact directory mode allows UID 101 to read
those narrowly mounted views; the deployment ancestor remains mode 0700.
Transfers use one backend and remain process-local; restart resumability is not
promised. The approved fixture exercises real SQL authorization, not a fake store.

`tests/integration/infra-il3` runs authentication/ACL/MFS/FileIo, original/ZIP/
Range/chunk transfers, OTAK/WebSocket/Redis, real LETC/Finder browser, restart,
cold backup and isolated restoration. Recovery compares canonical identity/Hub/
ACL/MFS inventory digests and actual file bytes. Infrastructure restore still
reports its own `kernel_recovery_verified:false`; application evidence is separate.
Browser acceptance pins the prepared leaf's SPKI for the isolated Chrome profile;
HTTPS API tests use ordinary CA/SAN verification. No CA is installed system-wide.

The approved minimal profile passes clean-checkout and testbox/LAN acceptance:
four unit tests, 25 grouped real-kernel checks per full lifecycle, and a separate
actual-process Redis rotation interruption/recovery case. Exact revisions,
commands, ownership, cleanup and supported limits are recorded in
[the IL-3 distribution report](../../../docs/refactoring/37-infra-layer-il3-distribution.md).
This is technical-review evidence, not a production release or permanent install.

Remote acceptance uses the same runner with explicit `IL3_BIND_ADDRESS`,
`IL3_HTTPS_PORT`, `IL3_DNS_PORT` and `IL3_EXTERNAL_BROWSER_DIRECTORY` values.
Reinspect the host and ports first. A private owned browser directory coordinates
three nonce-bound browser requests with `tests/integration/infra-il3/remote-browser.js`
running on the LAN client. Credentials travel only through SSH/private files,
are never logged, and request files are removed after acknowledgment. Browser
checks for the isolated loopback restoration use an owned SSH tunnel; initial
deployment checks go directly over the LAN. No browser executable or CA is
installed on testbox. An external-browser timeout is a failure, not a skip.
