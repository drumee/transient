# Infra Layer — IL-1.1 corrective closure and alpha extraction

Status: corrective implementation validated; standalone release preparation.
Publication is not claimed until GitHub/tag/npm verification is recorded below.
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
validation. No publication is implied by packing.

Standalone harness test dependencies are declared in
test/integration/kernel-dependencies.json: immutable transient faee9a574... plus
an exact path list, archived into disposable storage. Locked UI/build installs
occur there. No sibling checkout, absolute developer path or workspace runtime
dependency is required. No kernel/historical trees are committed or packed.

Canonical source after extraction is drumee/infra-layer. Final release commits,
integrity, tag consistency, clean-checkout/consumer results and synchronized
snapshot identity are appended after verification. IL-2 is not authorized by
this release; loaded-config activation/recovery remains IL-3, TLS/DNS/service
lifecycle and production persistence remain later work.
