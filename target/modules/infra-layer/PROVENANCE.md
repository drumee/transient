# Infra Layer IL-1 provenance

Architecture approval: transient `a31b544f565ca4438f1ed8df5eccb21bf0486104`,
`docs/refactoring/34-infra-layer-foundation.md`, refined by the IL-1 request.
Implementation baseline: transient branch `refactor/mapping`,
`9680a8cb09adfea5b40122a2df72cfdaa49fd8dd`.

This is an incremental CommonJS capability in transient. It is not an extracted
repository, a published package, a complete distribution or a new kernel loader.

| New path | Source repository / file / symbol / inspected revision | Reason and intentional difference |
|---|---|---|
| `lib/{spec,validation,plan,state,rendering}.js`, `index.d.ts` | New implementation of the approved IL-0 public-contract specification | Pure, explicit JSON inputs; no sysEnv, secret generation, host installation or activation. Render ownership, no-follow checks, per-file atomic writes and ordinary-error rollback replace the historical mutating renderer. |
| `capabilities/http/nginx/{index,routes}.js` | `https://github.com/drumee/setup-infra`, pinned main `643d74fa8bc89d418ff1169daa09554ae84e48ef`; imported at transient baseline. `templates/etc/drumee/infrastructure/routes/app.conf.tpl` service/WebSocket/static locations; `internals/accel.{private,public}.conf.tpl` internal alias mechanism; `templates/etc/nginx/nginx.conf` sendfile and scratch paths | Semantically adapted route/transfer primitives, not wholesale copied templates. Explicit endpoints; finite minimal routes; no Team rewrites, server-code root, global credentialed CORS or broad private cache. Current FileIo prefix replaces historical `/mfs` internal alias. Direct-edge header overwrite, port authority, symlink denial, bounded scratch, unbuffered upload and protected-log redaction are intentional changes. |
| `adapters/docker/nginx.js` | New implementation; reuse evidence from `https://github.com/drumee/debian`, branch `feat/container-distribution`, `8a236e5d147a55cfd5580dcda0712cd6436ca93c`, `config/render.mjs::renderComposeRoles`, `bootstrap/usr/lib/drumee/entrypoint/web` and role-web Dockerfile | One scoped gateway descriptor; read-only mounts, non-root foreground process, syntax/functional readiness separation. No Debian installer, Team role dependency, complete stack, secret writer or host process control. |
| `test/integration/kernel-fixture.js` | Current transient runtime/session/permission/dispatch/WebSocket, HostFilesystem/FileIo, media/MFS service and transfer files at baseline `9680a8cb...`; standalone runtime comparison reference `fc7d9de3f3e63baea8258885e55efe8e242904d0` | Composes real classes unchanged. Memory identity/Hub/node/filesystem stores and pub/sub are isolated test substitutes for persistence only. FileIo, binary reception, ACL evaluation and archive process are not mocked. Fixture probe Worker is instrumentation, not a new application. |
| Test permission converter | `https://github.com/drumee/server-essentials`, pinned main `b9460ba442c9962471a592c49ce36b01e0327ff5`, `lib/lex/{permission,functions}.js::permissionValue` | Read from immutable evidence and copied only into temporary image build context; never a production dependency of Infra Layer. |
| `test/integration/{browser-entry,build-browser}.js` | transient `target/foundation/ui-runtime`, `target/tooling/ui-build` and existing `target/modules/hello` at `9680a8cb...`; standalone UI reference `5366d904356b414e87848a0bc8870b612e6c748a` | Reuses existing real LETC/hello/CommonJS/Webpack path. No direct-DOM replacement, new synthetic app, kernel singleton reinitialization by plugins, or frontend packaging ownership transfer. |
| Finder regression | `https://github.com/drumee/finder`, main `b46e2c94b615a1993b6162716d9e8965d0029564`, `test/finder-core.test.js` and logical transfer clients | Read-only consumer regression; no Finder code copied into production Infra Layer. |

setup-infra LICENSE is retained verbatim as this module's AGPL v3 LICENSE.
The historical generated templates inspected above carry generated-file notices,
not an additional copyright line; no historical copyright notice was removed.
New source retains the same applicable licensing. Original implementations remain
unchanged under `sources/**` and `target/**` outside this module.

Test image inputs are immutable official Nginx and Node digests (recorded in
README/report); the test-only archive utility is Debian `zip=3.0-13+deb12u1`.
No mutable GitHub branch is downloaded at build or test time. npm test-only
WebSocket dependencies are fixed by this module's package-lock.json. Existing
ui-build/ui-runtime dependencies are installed in temporary pinned test workspaces.

## IL-1.1 corrective extraction

Source: `https://github.com/drumee/transient`, `target/modules/infra-layer/`.
IL-1 baseline: `faee9a57487d80f79a8ec79a68887e6da36ca489`.
Canonical development/release repository after extraction:
`https://github.com/drumee/infra-layer`; transient becomes a pinned integration
snapshot. Exact corrective and subtree extraction revisions are appended to
this record in the standalone release preparation, then synchronized back.

Adaptations: plan-bound local Docker ownership/port/revision observation,
separate desired/observed/loaded/functional/protected-delivery evidence,
exclusive render-directory lock with explicit stale-lock rejection and
precommit destination checks. Five public functions and all routing/kernel
semantics retained; no IL-2 or activation mechanism. AGPL-3.0-only preserved.

Validation: 66 foundation/corrective units, 17 actual Nginx/kernel/Chromium cases,
68 unchanged runtime/capability regressions and 27 unchanged Finder tests.
All pass without skips. The standalone harness fetches only the immutable test
revision and path allowlist in `test/integration/kernel-dependencies.json` into
temporary storage; no sibling checkout or historical source tree is distributed.
An initial test-stub promisification error and static-test marker mismatch were
fixed without changing kernel implementations or reducing tests.

## Exact extraction ledger

- Transient corrective commit: `c1de9e77d412bd05d76f9b089b269f9720c54d3e`.
- History-preserving subtree split: `062f270f4459e1d247567fde6c8531c43f36688f`.
- Standalone extraction merge: `da03fac1ac835a551bb2dc92981525ff6f8967c9`.
- Preserved standalone initial main: `30b6c7584e06d4d9a1e31cf0d88a1e0b5ba4347f`.
- Exact release source is identified by Git tag `v0.1.0-alpha.1`; tag resolution
  and npm tarball integrity are recorded in transient dossier 36 after public
  registry verification. A self-referential commit hash is not embedded here.

The standalone package removes private:true only after source regression and
allowlist auditing; release metadata and this ledger are its intentional changes
from the corrective snapshot. Transient is synchronized to the exact release
tree after verification. The retained .gitignore matches the pre-existing
standalone initial commit; no unrelated work/history is overwritten.
