# Drumee OS Refactoring — Agent Instructions

## Mission

This repository, `transient`, is a controlled refactoring and integration monorepo used to transform the current Drumee implementation into a minimal, extensible, application-neutral operating environment.

`transient` is **not** the future final Drumee OS repository. It is a temporary workspace from which validated repositories may later be extracted with preserved provenance and history.

The refactoring must remain:

```text
incremental
auditable
reversible
evidence-driven
testable
```

The primary objective is not to create a smaller `server-team` or `ui-team`.

The objective is:

> **a minimal Drumee kernel capable of loading and executing independent applications dynamically.**

Drumee Team is an immutable migration source and later compatibility target, not the design target of the first kernel.

---

# 1. Current project state

The approved sequence is:

```text
Phase 1     baseline evidence and mapping
Phase 1.5   minimal-kernel boundary stabilization
Phase 2     first runtime/build/infrastructure extraction       IMPLEMENTED
Phase 2.6   LETC bootstrap completeness                         NEXT
Phase 3     hello vertical slice
Phase 4     intentional authenticated ACL / MFS capabilities
Phase 5     marketing as first real application
Phase 6     kernel stabilization from real application needs
Phase 7+    Team migration module by module
```

Do not repeat Phase 2 unless correcting a demonstrated defect.

Do not begin a later phase merely because the previous phase is complete. Perform only the phase explicitly requested by the user.

Historical sections or documents that say "mapping only" or recommend a particular future branch are no longer authoritative phase gates.

---

# 2. Repository layout

The working structure is conceptually:

```text
transient/
├── AGENTS.md
├── SOURCE_MANIFEST.md
│
├── docs/
│   └── refactoring/
│
├── sources/                         # immutable imported evidence
│   ├── server-core/
│   ├── server-essentials/
│   ├── server-team/
│   ├── ui-core/
│   ├── ui-essentials/
│   ├── ui-team/
│   ├── schemas/
│   ├── setup-schemas/
│   ├── setup-infra/
│   ├── debian/
│   ├── cli/
│   ├── signin/
│   ├── loby/
│   └── other pinned Drumee repositories
│
├── target/
│   ├── foundation/
│   │   ├── server-runtime/          # transitional backend kernel extraction
│   │   └── ui-runtime/              # transitional frontend kernel extraction
│   │
│   ├── tooling/
│   │   └── ui-build/                # shared CommonJS/Webpack frontend build contract
│   │
│   ├── os/
│   │   ├── server/
│   │   ├── ui/
│   │   └── schemas/
│   │
│   ├── modules/
│   │   └── hello/                   # Phase 3 validation module, when authorized
│   │
│   ├── control-plane/
│   │   └── cli/
│   │
│   ├── distributions/
│   │   └── team/
│   │
│   └── deployment/
│       └── self-hosting/
│
├── scripts/
│   └── test-env/
│       └── kernel/
│
└── tests/
    ├── compatibility/
    ├── reconstruction/
    └── integration/
```

This is still a transitional architecture. Do not turn these directories into final public repository/package boundaries without explicit approval.

---

# 3. `sources/**` is immutable

This is non-negotiable.

Everything under:

```text
sources/**
```

is evidence imported from the current Drumee ecosystem.

Agents may:

```text
read
search
trace dependencies
inspect Git history
run safe tests
build existing components
use code as extraction evidence
```

Agents must never modify it.

Do not:

```text
refactor
rename
format
update dependencies
change imports
patch bugs
change schemas
alter package locks
write generated artifacts
write test output
perform cleanup commits
```

If an existing implementation must change, create the new implementation under `target/**`, `scripts/**`, or `tests/**` as appropriate.

Before completing implementation work, verify:

```bash
git diff -- sources/
```

is empty.

---

# 4. Source provenance

Every imported repository must be pinned in:

```text
SOURCE_MANIFEST.md
```

with at least:

```text
repository URL
branch
commit SHA
import date
import method
```

Never depend on a moving GitHub branch at build or test time when a pinned source is available.

Every significant extracted primitive must retain provenance.

For implementation under `target/**`, record where appropriate:

```text
new path
source repository
source file
source symbol/class/function
source SHA
reason for extraction
intentional semantic difference
```

Broad copy operations without provenance are prohibited.

---

# 5. Git discipline

`transient` is the only repository agents may modify for this refactoring.

Do not commit or push refactoring changes to original Drumee repositories.

Do not assume that an old branch recommendation in documentation is still mandatory.

Use the currently checked-out branch unless the user explicitly asks to create, switch, merge, or rebase a branch.

Never rewrite imported source history merely for convenience.

Prefer focused architectural commits.

Do not mix unrelated extraction, migration, deployment, and application work in one commit.

---

# 6. Architectural hierarchy

The desired long-term layering is:

```text
CONTROL PLANE / TOOLING
          │
          ▼
APPLICATIONS / DISTRIBUTIONS
          │
          ▼
MINIMAL DRUMEE OS / SHELL
          │
          ▼
DRUMEE RUNTIME / GENERIC FOUNDATIONS
          │
          ▼
DEPLOYMENT / PACKAGING
```

The control plane may administer Drumee but must not be required for the runtime to boot.

Deployment installs/configures Drumee but must not leak into the application runtime.

Applications consume kernel contracts but must not define them implicitly through Team-specific assumptions.

---

# 7. Team is a migration source, not the first target

The current Team implementation must remain available under `sources/**` as immutable evidence.

The no-Team kernel must not depend on:

```text
server-team
ui-team
Team billing policy
Team secure-share policy
Team service allow/deny lists
Team chat/conference/task behavior
Team desktop/application registry
```

The intended progression is:

```text
minimal runtime
→ hello
→ intentional authenticated/resource capabilities
→ MFS where required
→ marketing
→ kernel stabilization
→ Team migration
```

Do not reproduce every Team-era behavior before new independent applications can run.

Any later Team incompatibility must be explicit and tested, never silently introduced.

---

# 8. `server-essentials` invariant

`server-essentials` is a generic reusable server package and must remain usable outside Drumee.

Its generic responsibilities may include:

```text
MariaDB connectivity
query helpers
stored procedure helpers
transactions
pooling
Redis/cache
generic configuration
logging
generic errors/results
```

Do not add Drumee-specific concepts to `server-essentials` merely to simplify kernel extraction.

In particular, it must not become dependent on:

```text
hub
drumate
Drumee ACL
MFS semantics
module.method dispatch
plugin discovery
Team policy
```

The current imported `server-essentials` implementation is authoritative for new kernel work.

Do not downgrade it to historical Team/Core lockfile versions.

When old runtime code expects older behavior:

```text
identify exact incompatibility
→ inspect current Essentials behavior
→ adapt inside server-runtime
→ test the adaptation
→ document it
```

Do not modify Essentials to emulate legacy Team behavior.

---

# 9. `ui-essentials` invariant

`ui-essentials` must likewise remain a generic frontend foundation.

Do not move Drumee-specific concepts into it merely for convenience.

Drumee-specific concepts such as:

```text
Host
Visitor
Organization
plugin orchestration
MFS semantics
Finder
Window Manager
Team application behavior
```

belong above generic Essentials unless evidence proves otherwise.

Ownership must be explicit.

Do not declare `@drumee/ui-essentials` as a dependency or peer dependency of `ui-runtime` unless the runtime actually consumes it.

Conversely, do not silently copy a generic primitive from `ui-essentials` into `ui-runtime` without documenting why the generic dependency is intentionally avoided.

Avoid ambiguous double ownership.

---

# 10. CommonJS is authoritative

Do not migrate the current kernel refactoring to ESM.

The approved model is:

```text
server-runtime            CommonJS
ui-runtime                CommonJS
frontend modules/plugins  CommonJS + Webpack
```

Do not introduce during the current kernel phases:

```text
"type": "module"
native browser import() as plugin loader
ESM-only package boundaries
dual ESM/CommonJS packaging
an ESM migration of historical modules
```

ESM may be reconsidered only after the kernel and real applications have stabilized.

---

# 11. Webpack remains intentional frontend infrastructure

Webpack is currently part of the Drumee frontend contract, not incidental boilerplate.

It provides behavior used heavily by Drumee:

```text
CommonJS module resolution
SCSS/CSS processing
chainable/factorized style imports
assets
aliases/shortcuts
dynamic frontend bundles
build hashing
build metadata generation
```

Do not replace Webpack during minimal-kernel work with:

```text
native ESM loading
a new StyleRegistry
runtime SCSS dependency resolution
a new asset dependency protocol
```

Preserve the current Widget/skin model and existing SCSS composition behavior.

---

# 12. `ui-build` owns reusable build-time behavior

Reusable per-application Webpack boilerplate belongs in:

```text
target/tooling/ui-build/
```

not in `ui-runtime`.

The ownership model is:

```text
ui-runtime
    = browser/runtime behavior

ui-build
    = Webpack configuration
      + frontend artifact production
      + build metadata/hash production

ui-dev-tools
    = developer workflow commands where applicable
```

`ui-build` should factor only proven shared behavior.

Typical candidates:

```text
Webpack rules/loaders
SCSS/CSS/PostCSS
asset handling
resolve extensions
generic build plugins
minimal Drumee aliases
build hash/metadata production
```

Do not make the entire historical alias/shortcut surface a kernel dependency.

Classify aliases as:

```text
generic
minimal Drumee
legacy compatibility
application-specific
```

Legacy aliases should be opt-in where possible.

Do not migrate all historical applications to `ui-build` merely to prove it works.

---

# 13. Frontend build metadata is a runtime contract

Historical `webpack/sync.js` contains two distinct responsibilities.

## Required platform behavior

The build-time portion that derives frontend metadata from the Webpack compilation is part of the Drumee runtime contract.

Conceptually:

```text
Webpack compilation
→ stats.hash
→ frontend build metadata
→ server RuntimeEnv
→ app.hash
→ server bootstrap/template model
→ appHash
→ frontend runtime
```

Fields may include, depending on actual consumers:

```text
hash
entry
version
rev/head
timestamp
```

Do not change their observable semantics without characterization tests.

This required manifest/hash generation belongs to `ui-build`.

## Optional workflow behavior

Mechanisms such as:

```text
UI_RUNTIME_HOST
rsync
stage copying
development synchronization
deployment upload
```

are not kernel runtime responsibilities.

Keep them separate and optional.

---

# 14. Build metadata and application manifest are different contracts

Do not conflate:

```text
BUILD METADATA
Webpack output/hash/entry/version/revision information
```

with:

```text
APPLICATION MANIFEST
application/runtime metadata independently loaded by RuntimeEnv
```

Before changing either, document:

```text
producer
path
fields
consumer
semantic purpose
cache behavior
```

Do not invent a merged manifest format prematurely.

---

# 15. Build producer and runtime consumer ownership

`ui-build` produces frontend build metadata.

Server runtime code consumes frontend build metadata.

Do not put a second server-side RuntimeEnv implementation into the production `ui-build` library.

A build/runtime contract emulator may exist only as a clearly marked test fixture or characterization helper.

If RuntimeEnv behavior is extracted for production use, its owning implementation belongs on the server/runtime side, not inside frontend build tooling.

Avoid two independently evolving implementations of:

```text
metadata → app.hash → bundle names/appHash
```

---

# 16. `server-runtime`

`target/foundation/server-runtime/` is the transitional backend extraction workspace for the minimal Drumee server kernel.

It is not a final public package API.

It should contain Drumee runtime behavior not already owned by generic Essentials.

Initial kernel responsibilities include only what is justified by module hosting:

```text
request/runtime context
session context
ACL/service descriptors
module registry
module.method parsing
public/private implementation selection
permission descriptor resolution
lazy WorkerClass loading
WorkerClass cache
generic authorization flow
service method execution
frontend plugin resolver (`bootstrap.plugin`)
```

Do not copy `server-core` wholesale.

Do not copy `server-team` router policy wholesale.

---

# 17. Backend module/service contract

Preserve the current logical backend mechanism unless a later phase explicitly redesigns it.

Discovery:

```text
module/plugin roots
→ acl/*.json
→ service descriptors
→ registry
```

Execution:

```text
module.method
→ module lookup
→ service descriptor
→ public/private implementation
→ permission descriptor
→ lazy require()
→ WorkerClass cache
→ worker instance
→ authorization
→ worker method
```

Do not create a universal frontend/backend descriptor merely for architectural neatness.

Backend ACL descriptors and frontend `index.json` remain distinct contracts for now.

---

# 18. ACL fast path and schema deferral

The first no-Team vertical slice intentionally uses:

```json
{
  "permission": {
    "src": "anonymous",
    "fast_check": "public-api"
  }
}
```

`permission.fast_check = "public-api"` is an existing database-free ACL path and must not be documented as a newly invented compatibility behavior.

For `hello`, this allows the real service/ACL/dispatch pipeline to run without introducing DB-backed ACL.

Do not introduce solely for `hello`:

```text
acl_check.sql
user_permission
user_expiry
MFS ACL SQL
MFS schemas
factory provisioning
hub provisioning
```

Database-backed ACL belongs to the first authenticated/resource-aware iteration that genuinely needs it.

Extract SQL dependency closures only when required by an approved capability.

---

# 19. `ui-runtime`

`target/foundation/ui-runtime/` is the transitional frontend kernel extraction workspace.

Its job is to bootstrap the non-MFS LETC core completely enough that plugins can assume the elementary Widget environment already exists.

Do not copy `ui-core` wholesale.

---

# 20. Canonical LETC bootstrap

Use:

```text
sources/ui-core/letc/index.js
```

as the canonical historical reference for bootstrap ordering and exported globals/singletons.

Before any plugin loads, initialize:

```text
Preset
Template
Skeletons
Websocket
Validator
Kind
pointerDragged
LetcBlank
LetcBox
LetcList
LetcText
Platform
Env
Host
Visitor
Organization
```

Initialize required prerequisites in the same semantic order, including lodash, jQuery/`$`, Marionette, required jQuery UI primitives and addons where still needed.

Initialization must be deterministic and idempotent.

Expose an explicit READY contract. `Kind.loadPlugin()` must wait for readiness or fail clearly.

Explicitly exclude `DrumeeMFS` until the approved MFS phase.

## `KIND` is legacy

Do **not** export or initialize the historical global `KIND` in the kernel.

A Widget kind is canonically its string value:

```js
"note"
"box"
"image_svg"
```

not `KIND.*`.

When extracting Skeleton/Widget code, replace `KIND.*` references with the exact string value.

A future Team compatibility layer may recreate `KIND` for legacy modules, but kernel code must not depend on it.

Add a static test for this invariant.

---

# 21. Complete non-MFS `Skeletons.*` catalog

Use:

```text
sources/ui-core/letc/toolkit/skeleton/
sources/ui-core/letc/toolkit/skeletons.js
sources/ui-core/letc/widgets/
```

as the canonical elementary Widget source.

Before the first plugin can load, `ui-runtime` must expose the complete non-MFS `Skeletons.*` API and register every elementary Widget kind those builders can emit.

For every exported builder, trace and test:

```text
Skeletons.* builder
→ emitted string kind
→ static Kind registration
→ Widget implementation
→ direct generic prerequisites
```

Example:

```text
Skeletons.Note(...)
→ "note"
→ Kind.get("note")
→ elementary text/note Widget
```

Never expose a builder whose kind cannot resolve. Do not invent replacement elementary renderers.

Extract the minimum complete non-MFS dependency closure, not arbitrary neighboring widgets.

MFS/Finder/Window Manager/Team application widgets remain excluded unless explicitly authorized.

---

# 22. Real Widget semantics

Frontend validation must exercise the real Widget/LETC model, not a synthetic function registry.

Use the minimal Widget pattern generated by `ui-dev-tools/widget` when that repository is pinned in the source baseline. If it is used as extraction evidence and is not yet pinned, import it with provenance before relying on it.

```text
CommonJS class
→ minimum valid LETC parent (typically LetcBox)
→ initialize()
→ load skin
→ super.initialize()
→ declareHandlers()
→ onDomRefresh()
→ feed(require("./skeleton")(this))
```

Its skeleton must compose elementary Widgets through `Skeletons.*`.

The Widget structure remains:

```text
brain
skeleton
skin
kind
```

A Phase 2 `Widget(props)` helper may remain a test seam, but is not final LETC evidence.

Phase 3 `hello` must use at least one real elementary Widget, preferably `Skeletons.Note`, through static `Kind` resolution.

Do not substitute direct DOM rendering.

---

# 23. Frontend plugin readiness and handshake

The approved contract remains:

```text
core bootstrap READY
→ Kind.loadPlugin({ name, kind })
→ Kind.exists(kind)
→ bootstrap.plugin(name)
→ backend resolves frontend index.json
→ backend returns { path }
→ loadJS(path)
→ CommonJS/Webpack bundle executes
→ Kind.registerAddons(...)
→ addons:registered
→ Kind.get(kind)
```

Plugins must not initialize kernel globals/singletons.

`Host`, `Visitor`, and `Organization` are initialized before plugins because they participate in identity/ACL context; retain only non-Team, non-MFS responsibilities.

The backend remains the security authority.

Do not replace `loadJS` with native ESM import or invent another plugin registry.

---

# 24. `setup-infra` is the infrastructure contract source

`sources/setup-infra` is the pinned reference for the current Drumee host/infrastructure contract.

It is immutable.

Its role is:

```text
setup-infra = source of Nginx/host configuration semantics
```

It is not the application kernel.

For kernel integration, derive the minimum real Drumee HTTP/static/plugin contract from the pinned source.

Do not invent an unrelated simplified Nginx architecture.

Do not pull unrelated infrastructure into the kernel:

```text
DNS/BIND
mail/Postfix/DKIM
Jitsi
Prosody
Coturn
other unrelated host services
```

---

# 25. `debian` is the historical deployment baseline

`sources/debian` represents current packaging/self-hosting behavior.

Its historical images/packages are evidence for:

```text
existing self-hosting behavior
packaging behavior
later Team compatibility
```

They are not the canonical host for the new kernel.

Do not patch historical Team containers to inject new `server-runtime` or `ui-runtime`.

Do not force new runtime layout to match historical Debian packages.

New `.deb` packaging is a later deployment concern unless explicitly requested.

---

# 26. Canonical kernel integration environment

The new kernel is validated in a separate disposable environment:

```text
clean Debian runtime
+
Node.js
+
Nginx
+
configuration derived/generated from pinned setup-infra
+
server-runtime
+
ui-runtime build artifacts
```

Infrastructure-only services such as Redis or MariaDB may be reused only when the tested capability genuinely needs them.

Do not introduce MariaDB simply because historical Drumee uses it.

Generated configuration belongs outside `sources/**`, preferably under:

```text
.tmp/test-env/kernel/
```

Never mutate the production host `/etc`.

If a setup tool normally writes system paths, execute it inside a disposable container/root or safely redirect output.

---

# 27. Known historical provisioning defect

The historical Debian/provisioning path has a known failure involving search-projection rebuilding inside an active transaction and subsequent factory/user provisioning failure.

Treat this as historical baseline evidence.

It must not force the no-Team kernel to import schemas/MFS prematurely.

Do not claim Team/self-hosting parity until that separate historical path is corrected and validated.

---

# 28. Phase 3 — `hello`

When Phase 3 is explicitly authorized, create exactly one synthetic validation module:

```text
target/modules/hello/
```

Do not create additional synthetic applications before the first real application.

`hello` must remain intentionally small.

Its purpose is to prove a complete vertical Drumee slice.

## Backend

At minimum:

```text
hello ACL descriptor
→ anonymous/public-api fast path
→ hello.ping
```

`hello.echo` is optional if useful.

The service must be discovered and executed through the extracted real module/ACL/Worker dispatch path.

Do not bypass the dispatcher with a direct test HTTP handler.

## Frontend

The frontend must prove:

```text
Kind.loadPlugin("hello")
→ bootstrap.plugin
→ frontend index.json/entry resolution
→ loadJS(bundle)
→ Kind.registerAddons
→ requested kind resolution
→ genuine minimal LETC widget render
```

The rendered `hello` must be a real minimal Drumee Widget/LETC artifact, not merely a plain function called by a synthetic renderer.

## Build

`hello` should be the first synthetic application/module consumer of shared `ui-build`.

It must use the approved CommonJS/Webpack pipeline.

The build should produce the current required frontend build metadata/hash contract.

## Infrastructure

The end-to-end slice should run behind the kernel integration Nginx/setup-infra contract.

## Explicitly excluded from `hello`

```text
database-backed ACL
schemas introduced solely for ACL
MFS
Finder
Desktop
Window Manager
marketing
AI
Team behavior
complex provisioning
```

The governing rule is:

> **`hello` validates the kernel; `marketing` drives the next useful kernel capabilities.**

---

# 29. Phase 4 — authenticated/resource capabilities and MFS

Do not extract MFS merely because historical code expects it.

After `hello`, introduce only the resource/identity/storage capabilities demanded by an approved real use case.

When DB-backed ACL becomes necessary:

```text
identify direct SQL primitive
→ trace complete transitive SQL dependency closure
→ classify each object
→ extract only the required closure
→ preserve install ordering/database ownership
→ test independently
```

Do not copy schema directories wholesale.

Distinguish:

```text
service/session authorization
resource/node authorization
MFS semantics
provisioning semantics
```

Do not make one imply all the others automatically.

Window Manager is not an initial kernel primitive; reconsider it only after intentional MFS/resource semantics exist.

Finder remains a system application, not the MFS engine.

---

# 30. Marketing is the first real application

After `hello` validates the kernel, `marketing` is the first real application intended to exercise actual business needs.

Marketing may drive requirements such as:

```text
private hub usage
authenticated ACL
MFS
hub-local schemas
dynamic services
LETC frontend
AI integration
```

Do not pre-build these capabilities speculatively before the application requires them.

Use:

```text
hello → validate kernel
marketing → discover real kernel requirements
```

---

# 31. Classification model

Use these classifications when ownership is unclear:

## `KEEP_OS`

Required to load, isolate, authorize, execute, or host Drumee applications.

## `SYSTEM_MODULE`

Generally useful application functionality not required for kernel boot.

Examples may include Finder or Signin.

## `TEAM_MODULE`

Team-specific application/distribution behavior.

## `SDK_OR_ESSENTIALS`

Generic reusable primitives not inherently Drumee-specific.

## `BUSINESS_MODULE`

Business-domain applications such as Marketing/Copywriting.

## `CONTROL_PLANE`

Administrative/developer tooling that manages Drumee but is not required in the runtime.

## `DEPLOYMENT`

Packaging, installation, host configuration and self-hosting infrastructure.

## `LEGACY`

Unused/duplicated/obsolete code, only after evidence.

## `INVESTIGATE`

Use whenever ownership remains uncertain.

Do not force classification to complete a diagram.

---

# 32. Core decision principle

When ownership is ambiguous:

> If Drumee needs the capability to load, isolate, authorize, execute, or host applications, it may belong to the OS.

> If it performs useful user work but Drumee can host applications without it, it is probably a module.

> If it administers a running system but is not needed to boot it, it belongs to the control plane.

> If it installs/configures the system on machines, it belongs to deployment.

Examples:

```text
service dispatcher       → KEEP_OS
ACL engine integration   → KEEP_OS
MFS primitive            → KEEP_OS when actually required
Finder                    → SYSTEM_MODULE
Window Manager            → INVESTIGATE after MFS/resource semantics
Chat                      → TEAM_MODULE
CLI administration       → CONTROL_PLANE
Webpack ui-build          → tooling/build infrastructure
Debian packaging          → DEPLOYMENT
setup-infra               → DEPLOYMENT/infrastructure contract source
```

---

# 33. Do not reinvent existing Drumee primitives

Before proposing a new primitive, inspect current source evidence.

Especially inspect:

```text
server-core
server-essentials
ui-core
ui-essentials
ui-toolkit
ui-styles
schemas
setup-infra
ui-dev-tools where imported
existing module/plugin loaders
```

Do not create replacement abstractions merely because current ownership is imperfect.

When moving/reimplementing a primitive, document:

```text
current implementation
existing related primitive
why ownership is wrong
new owner
compatibility impact
smallest viable change
```

---

# 34. Test requirements

Every extracted capability requires focused tests.

## Backend runtime

Cover where relevant:

```text
descriptor registration
malformed descriptors
module.method parsing
unknown module/method
public/private implementation selection
lazy WorkerClass loading
WorkerClass cache
permission/privilege semantics
public-api fast path
Team policy absence
bootstrap.plugin resolution
```

## Frontend runtime

Cover where relevant:

```text
Kind register/exists/get
addon registration
addons:registered
Kind.loadPlugin
bootstrap.plugin invocation
loadJS
duplicate loading
failure propagation
Host
Visitor
Organization
absence of MFS/Team dependencies
```

## ui-build

Cover where relevant:

```text
Webpack build succeeds
CommonJS works
SCSS/CSS imports work
assets work
build metadata is generated
hash exists
entry maps to emitted bundle
source change alters content-sensitive hash
legacy aliases are not hidden kernel requirements
```

## Build/runtime contract

Characterize:

```text
Webpack hash
→ generated metadata
→ RuntimeEnv consumer
→ app.hash
→ bootstrap appHash
```

Do not maintain a production duplicate of RuntimeEnv in `ui-build` merely to make the test easy.

Use fixtures for characterization where appropriate.

## Integration

Validate:

```text
setup-infra-derived config generation
nginx -t
server-runtime startup without server-team
ui-runtime artifacts served without ui-team
service route reaches server-runtime
static/plugin route works
```

Historical Team E2E failure does not block independent no-Team kernel work unless the selected capability actually depends on that failing path.

---

# 35. Documentation

Implementation phases must update the relevant documentation under:

```text
docs/refactoring/
```

Do not rewrite correct historical findings merely because architecture evolved.

Mark superseded decisions clearly.

Current important documents include:

```text
03-dependency-map.md
04-schema-map.md
05-module-contract.md
06-target-architecture.md
07-migration-plan.md
08-risk-register.md
09-self-hosting-map.md
12-compatibility-harness.md
13-test-environment.md
14-minimal-kernel-plan.md
15-phase2-runtime-extraction.md
```

Phase 3 should produce a focused implementation/validation document for `hello` if one does not already exist.

Risk register updates must be evidence-based.

---

# 36. Package and publication policy

Transitional packages under `target/**` are private extraction workspaces.

Their metadata/readmes should state that they are:

```text
private
transitional
not final public APIs
not final repository boundaries
not for publication
```

Do not publish npm packages, container images, Debian packages, releases, or production deployments unless explicitly requested.

---

# 37. Safety and destructive operations

No production deployment, production DB mutation, remote destructive action, or host configuration mutation is authorized by ordinary refactoring tasks.

Use disposable test environments.

Destructive tests must require explicit safeguards.

Never let test tooling mutate:

```text
sources/**
host production /etc
production databases
production storage
```

---

# 38. Definition of done for any implementation task

Before reporting completion, verify as applicable:

```text
requested scope implemented
tests executed
results documented
provenance preserved
sources/** unchanged
no unrelated phase started
no Team policy leaked into kernel
no MFS/schema scope expanded without authorization
no production/deployment side effects
```

Run:

```bash
git diff -- sources/
```

and report any non-empty result as a blocker.

Do not claim compatibility or production readiness that was not actually tested.

---

# 39. Stop discipline

Respect phase boundaries.

When a requested phase or correction is complete:

```text
STOP
```

Do not automatically continue into:

```text
next phase
MFS extraction
schema extraction
Team migration
deployment packaging
ESM migration
historical app migration
```

unless explicitly asked.

Partial, evidence-backed completion is preferable to broad speculative work.

---

# 40. Final architectural objective

The target is:

```text
                     Drumee Control Plane
                             │
                             ▼
                     Minimal Drumee OS
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         Drumee Team      Marketing      Future apps
         distribution     application
```

with:

```text
generic Essentials below the kernel
shared build tooling outside browser runtime
real module/plugin contracts
minimal infrastructure contract
applications dynamically loadable
Team reconstructed later as a distribution
```

The minimal OS must remain business-domain neutral.

The kernel should grow from demonstrated application requirements, not historical product co-location.
