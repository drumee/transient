# KB-01 — operator bootstrap contract probe

Status: **KB-01 — CONTRACT_BLOCKED**. This directory contains executable
evidence and a pinned test environment, not an enrollment implementation.
There is no public `enrollInitialOperator()` export, no credential provider,
no enrollment migration and no administrator installed by this package.

The selected minimal runtime supports domain/Hub/MFS authorization but lacks
the canonical platform authority path. Historical `server-core` used
`scope: "plateform"` → `Acl.check_remit()` → `yp.get_remit(uid)` →
`drumate.remit`. The selected intrinsic schema has neither the column nor the
function, and `createAuthorizer()` rejects platform scopes.

Assigning 63 or 127 in the domain `privilege` table does not repair this:
the tests authenticate real human sessions for both values and prove that the
real dispatcher still denies platform operations. Requesting a cumulative root
word through DomainAuthorizer is also unsuitable: domain authorization tests
nonzero intersection, so a domain owner with 63 passes a requested mask of 127.
No alternate role table or infrastructure-side authorization was introduced.

## Run the evidence

From a checkout of transient containing this directory:

```sh
cd target/control-plane/operator-bootstrap
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run test:integration
```

Test dependencies are immutable `@drumee/server-runtime@0.1.0-alpha.3` and
`mariadb@3.5.4`, with SHA-512 integrity in package-lock.json. The probe also
reads the repository's existing transitional runtime, platform-bootstrap and
immutable Essentials constants as explicit test inputs. It is a private monorepo
probe, not a standalone production package. No developer-specific absolute
paths or sibling repositories are required by these tests.

Integration requires Docker. It starts a uniquely labelled digest-pinned
MariaDB with tmpfs database storage, dynamic loopback-only TCP publication and
a private temporary administrative credential file. Only its owned container
and temporary directory are removed. There are no deployment or host changes.

The test's two human SQL counterexamples are explicitly disposable. They are
not production provisioning logic and must not be called by Debian. They use
the unchanged SQL `session_signin`, session issuance/resumption and dispatcher.
Database/Docker errors are reduced to stable probe codes; plaintext credentials
are not logged. Random per-run credentials are never Git/package/image inputs.

Results: four unit tests and seven integration TAP tests including the parent,
zero failures/skips. A passing contract probe means the absence is reproduced;
it does not mean operator enrollment is implemented.

## Required canonical correction

The owning project is `drumee/server-runtime`. Restore a narrow, versioned
platform authorization contract and its intrinsic schema prerequisites before
implementing KB-01. Define the PLATFORM_ADMINISTRATOR grant separately from
domain owner privileges, use real authenticated human sessions, and preserve
Hub/MFS ACL isolation. The role cannot be manufactured by naming an enrollment
record or assigning a domain number.

See [the KB-01 report](../../../docs/refactoring/39-kernel-operator-bootstrap.md)
for exact affected files, source revisions, tests and the smallest proposed
correction. Interactive/test/automatic credential handling, enrollment locking,
idempotence and crash recovery remain required after that correction. No mode
is silently substituted and the approved IL-3 fixture remains unchanged.
