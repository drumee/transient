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
ui-build/ui-runtime dependencies are supplied by their own locked workspaces.
