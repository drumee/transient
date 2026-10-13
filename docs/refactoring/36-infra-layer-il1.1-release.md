# Infra Layer — IL-1.1 corrective closure and alpha extraction

Status: **IL-1.1 — RELEASE_BLOCKED**. Corrective code, standalone Git release
candidate and package validation complete. GitHub main/tag are confirmed;
npm publication is blocked by **EOTP**, requiring interactive npm authentication.
No published version, registry integrity or dist-tag is claimed. Date 2026-10-13.
Source baseline `faee9a57487d80f79a8ec79a68887e6da36ca489`, branch
`refactor/mapping`, `target/modules/infra-layer/`.

## Corrections

- Docker observation accepts only id/full container ID/desired revision/exact
  applicable plan. Caller URLs/Host fields are rejected before Docker/network.
  Local Unix Docker socket inspection confirms ID, owner, Compose project,
  gateway service, revision and published bindings before a fixed loopback
  HTTP/HTTPS request. No DNS, redirects, supplied URL encodings/credentials,
  certificate-verification bypass or remote daemon. Absolute three-second
  deadline and four-KiB response limit. Errors project stable codes only.
- Desired and observed label revisions are retained separately. Compatibility
  active_revision means observed label only. Loaded configuration and protected
  delivery remain unverified in the Docker observer; functional HTTP alone
  cannot make diagnoseInfrastructure ready. Separate explicit observer evidence
  is needed; activation/process attestation is deferred to IL-3.
- Atomic directory lock covers manifest read through rollback. Competing and
  stale locks yield RENDER_LOCKED, with no PID/time takeover. Destination bytes
  and symlink/hardlink status are rechecked after staging. Ordinary failures
  roll back; a process crash is not a crash-atomic multi-file transaction.
  Operator-owned inspection/recovery is required after interruption; removing
  the lock alone cannot authorize a mixed revision or corrupted manifest.

## Source validation

66 unit/corrective cases, 17 actual Nginx/kernel/Chromium cases, 68 existing
runtime/capability regressions and 27 existing Finder tests: **178 passed, zero
failed, zero skipped**. All original 139 cases remain covered. The fixture
composition still uses real kernel authorization/FileIo/transfer/LETC classes
with memory persistence stores; no full SQL/Redis/TLS acceptance is claimed.

Commands:

```sh
# target/modules/infra-layer
npm install --package-lock-only --ignore-scripts
npm test
npm run test:integration
npm run test:package
# transient root
node --test target/foundation/server-runtime/test/*.test.js \
  target/modules/host-filesystem/test/*.test.js \
  target/modules/mfs-transfer/test/*.test.js \
  target/modules/mfs-service/test/*.test.js \
  target/modules/media-service/test/*.test.js
node --test /home/somanos/github/finder/test/finder-core.test.js
```

Integration project `drumee-il1-test-f3cd66ff`, gateway `127.0.0.1:33475`,
dedicated network: Compose validation and actual nginx -t before/after startup,
rootless read-only gateway, all 17 functional cases including Chromium pass.
Harness resources/image/temp files cleaned; no volumes or testbox changes.

## Extraction/release preparation

Existing standalone main starts at `30b6c7584e06d4d9a1e31cf0d88a1e0b5ba4347f`
with only .gitignore; preserve it using a history-preserving subtree merge.
Initial registry query returns package E404; npm account somanos is Drumee org
owner. Intended version 0.1.0-alpha.1, tag next, public AGPL-3.0-only CommonJS.
The production allowlist has 15 files and no runtime dependencies; test-only
websocket 1.0.35 stays out of the tarball. Package remains private during source
validation, then private:true was removed in the validated standalone release
preparation. No publication is implied by packing.

Standalone harness test dependencies are declared in
test/integration/kernel-dependencies.json: immutable transient faee9a574... plus
an exact path list, archived into disposable storage. Locked UI/build installs
occur there. No sibling checkout, absolute developer path or workspace runtime
dependency is required. No kernel/historical trees are committed or packed.

Canonical source after extraction is drumee/infra-layer. Exact Git commits,
prepared integrity, tag consistency, clean-checkout/consumer results and
synchronized snapshot identity are recorded below. IL-2 is not authorized by
this release; loaded-config activation/recovery remains IL-3, TLS/DNS/service
lifecycle and production persistence remain later work.

## Git repositories and canonical ownership

| Revision | Exact SHA |
|---|---|
| transient baseline | `faee9a57487d80f79a8ec79a68887e6da36ca489` |
| transient corrective commit, refactor/mapping | `c1de9e77d412bd05d76f9b089b269f9720c54d3e` |
| subtree split, preserving Infra Layer path history | `062f270f4459e1d247567fde6c8531c43f36688f` |
| standalone extraction merge, preserving original main | `da03fac1ac835a551bb2dc92981525ff6f8967c9` |
| standalone validated alpha candidate, main | `b1b8e8666e92ec604d933b9c99145c90b966362b` |
| annotated v0.1.0-alpha.1 tag object | `1a1e9782df9e1f6671692252139735d2269fab58` |

Pushes of standalone main and tag succeeded. `git ls-remote` confirms main and
the peeled tag both resolve to b1b8e866.... A separate HTTPS clone of the public
tag returned the same commit. No force push or history deletion occurred.
Both standalone main and the validation checkouts have clean tracked trees.
The final transient closure commit is supplied in the task completion report
to avoid an impossible self-referential hash in this file.

All 30 tracked standalone files, including tests/lockfile/provenance/license,
match transient's integration snapshot byte-for-byte. Production code was not
changed after corrective validation. The intentional extraction changes were
removal of private:true and addition of exact corrective/split/merge provenance;
these are synchronized too. SOURCE_MANIFEST records the Git pin separately from
immutable historical sources. There are no independent undocumented copies.

`scripts/check-infra-layer-sync.js` requires an explicit standalone checkout,
verifies its HEAD and committed tree, and compares the complete snapshot inventory.
Subsequent Infra Layer work belongs to the standalone repository after separate
phase approval. The test dependency manifest's transient pin is immutable test
evidence only, not a production runtime or hidden sibling dependency.

## Clean-room and package evidence

An independent `git clone --no-local` of the standalone repository's exact
release commit ran `npm ci`, `npm test` and `npm run test:integration` successfully:
66 units and 17 actual gateway/kernel/browser cases, zero failures/skips.
No transient sibling paths were supplied. The harness fetched its declared
immutable dependencies and installed their own locks in temporary storage.
Clean integration project `drumee-il1-test-0f45ff46`, bridge network of the same
project, gateway `127.0.0.1:43721`, revision
`5378871b627d40441ae44e42ca0857ebff7187d881d73b8e285683deb82d57f1`.
Nginx syntax/Compose checks, health, transfer/authorization and Chromium all pass;
owned resources/image/temp files were cleaned with no volumes created.

After the push, a direct public GitHub tag clone also ran `npm ci` and all
66 unit tests successfully. Its 30-file committed tree matches the independent
checkout used for the complete integration suite. Repeated executions are not
counted as additional distinct regression cases: coverage total remains 178,
including the original 139 and 39 new observation/readiness/render-lock cases.

Package audit commands:

```sh
npm run test:package
npm pack --dry-run --json
npm pack --json
# isolated consumer, outside either repository
npm install --ignore-scripts --no-audit --no-fund <validated-archive.tgz>
node verify.cjs
```

Consumer requires `@drumee/infra-layer` by package name only. It asserts the exact
five public functions, six canonical DNS/spec/plan scenarios, deterministic
artifacts and rejection of an enabled gateway with no hostname. Installation
added one package, with no runtime dependency resolution. No source-relative or
sibling-repository imports were used.

Prepared archive `drumee-infra-layer-0.1.0-alpha.1.tgz`: 35,747 bytes compressed,
110,322 bytes unpacked, 15 regular files, no bundled dependencies.
Its SHA-1 is `972dbb903ac0d69280f72e48624887469d702450`; prepared SHA-512 integrity:

```text
sha512-CcNv3ZmrngSS+nUFLe2f3CrONKDjoAAc3zOLfB3rLRasOty0JPFgOwFTGMhbfAF0t7XDQIQGS0Fvxd5wbbc4Og==
```

Exact package inventory:

```text
LICENSE
PROVENANCE.md
README.md
adapters/docker/nginx.js
capabilities/http/nginx/index.js
capabilities/http/nginx/routes.js
index.d.ts
lib/diagnostics.js
lib/index.js
lib/plan.js
lib/rendering.js
lib/spec.js
lib/state.js
lib/validation.js
package.json
```

The audit rejects unexpected paths/binaries, private keys, fixture credentials,
absolute developer paths, file: dependencies and undeclared production imports.
All 15 archived file contents were compared against the independently cloned
GitHub tag: exact match. No claim is made about registry tarball equivalence,
since npm never accepted publication. A copy of the tested archive is preserved
at `.tmp/releases/infra-layer/drumee-infra-layer-0.1.0-alpha.1.tgz` (ignored by Git)
for authenticated resumption. The five API/schema/Nginx/Docker routes remain
documented in the synchronized module README/index.d.ts/PROVENANCE.

## npm attempt and exact remaining blocker

```sh
npm whoami
npm org ls drumee --json
npm access list packages somanos --json
npm view @drumee/infra-layer versions dist-tags --json --registry=https://registry.npmjs.org
npm publish ./drumee-infra-layer-0.1.0-alpha.1.tgz \
  --tag next --access public --ignore-scripts --registry=https://registry.npmjs.org
npm view @drumee/infra-layer@0.1.0-alpha.1 \
  version license repository engines dependencies devDependencies dist dist-tags \
  --json --registry=https://registry.npmjs.org
```

Account somanos is authenticated for reads and owns the Drumee organization.
The publish command exits 1 with **EOTP: This operation requires a one-time
password**, requesting interactive npm browser authentication. Authentication
URLs/tokens are not copied into state, Git, documentation or previews. Registry
queries before and after the attempt return E404 for the package/version.
No immutable version was overwritten and no alternate alpha was needed.

Target package is `@drumee/infra-layer@0.1.0-alpha.1`, intended public tag `next`;
repository/AGPL-3.0-only/CommonJS/Node>=22 metadata and production allowlist are
validated locally. Actual published version, next/latest tags, public registry
integrity and registry download/consumer tests remain **unavailable/unexecuted**
because of EOTP. No unrelated stable release or package tag was changed.
The registry endpoint checked was `https://registry.npmjs.org/@drumee%2Finfra-layer`.

To resume, perform the required interactive npm authentication, recheck version
and tags, publish the preserved validated archive under next, and confirm public
metadata/integrity/file equivalence. If a version appears in the interim, inspect
it before publishing; never overwrite an immutable version. Document any
first-version automatic latest alias instead of attempting unsupported deletion.
GitHub success alone does not satisfy RELEASED.

## Safety, remaining work and approval boundary

Kernel/runtime packages, MFS semantics/authorization and immutable sources remain
unchanged. No Oxymotion deployment, testbox SSH session or persistent remote
change occurred. Existing local containers/data/volumes, host DNS/firewall,
credentials and certificates were not altered. Cleanup removed only resources
created by the harness and test-owned subprocesses/temp storage. No production
destructive operation, secret disclosure or unrelated package publication.

The Docker alpha observer supports only the local Unix daemon and loopback or
wildcard host bindings, not remote/rootless daemon sockets or LAN-only probes.
TLS certificate verification is preserved in unit tests; actual LAN TLS trust,
issuance and renewal remain untested. Loaded Nginx configuration is unverified;
protected MFS compatibility is proven by integration tests, not inferred during
routine readiness probes. Explicit process/activation attestation, concurrent
activation and crash recovery remain IL-3 responsibilities. Render locks never
silently take over stale directories, and per-file renames are not crash-atomic.

One transfer backend remains required, with process-local transfer leases and no
restart-resumable transfers. Test identity/Hub/node metadata and Redis pub/sub
are memory stores; real MariaDB/Redis persistence, backup/upgrade, DNS/BIND9,
SMTP/DKIM, certificates and preserved secrets belong to approved later work.
IL-2 prerequisites are review of these alpha contracts and explicit approval of
service/TLS/DNS/secret lifecycle scope; registry authentication must be resolved
to close IL-1.1 release gates. No IL-2 implementation or permanent acceptance
stack was started.
