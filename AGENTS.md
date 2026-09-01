# Drumee OS Refactoring — Agent Instructions

## Mission

This repository, **`transient`**, is a controlled transitional refactoring monorepo used to transform the current Drumee implementation into a minimal, extensible operating-system-like platform.

`transient` is **not** the future Drumee OS repository. It is a temporary integration and refactoring workspace from which the validated final repositories will later be extracted. One of those final outputs is expected to be the future **`drumee-os`** repository, subject to the repository boundaries approved after mapping.

The current Drumee Team product **must not be broken, degraded, or functionally changed** by this work.

The repository contains:

1. an immutable copy of the current Drumee ecosystem used as the compatibility baseline;
2. documentation describing the refactoring;
3. the future modular architecture being built alongside the baseline;
4. compatibility and reconstruction tests.

The refactoring must be incremental, auditable, reversible, and evidence-driven.

---

# 1. Repository layout

The expected high-level structure is:

```text
transient/
│
├── AGENTS.md
├── SOURCE_MANIFEST.md
│
├── docs/
│   └── refactoring/
│
├── sources/
│   ├── ui-team/
│   ├── server-team/
│   ├── schemas/
│   ├── setup-schemas/
│   ├── debian/
│   ├── cli/
│   ├── loby/
│   ├── signin/
│   └── other imported Drumee repositories
│
├── target/
│   ├── foundation/
│   │   ├── server-runtime/       # transitional backend extraction workspace
│   │   └── ui-runtime/           # transitional frontend extraction workspace
│   │
│   ├── os/
│   │   ├── server/
│   │   ├── ui/
│   │   └── schemas/
│   │
│   ├── control-plane/
│   │   └── cli/
│   │
│   ├── modules/
│   │   ├── hello/                # minimal kernel validation module
│   │   ├── finder/
│   │   ├── signin/
│   │   ├── loby/
│   │   ├── chat/
│   │   ├── tasks/
│   │   ├── meetings/
│   │   └── other extracted modules
│   │
│   ├── distributions/
│   │   └── team/
│   │
│   └── deployment/
│       └── self-hosting/
│
└── tests/
    ├── compatibility/
    ├── reconstruction/
    └── integration/
```

This structure is a working hypothesis.

It may evolve after the mapping phase.

The distinction between `sources/` and `target/` is mandatory.

---

# 2. The `sources/` tree is immutable

## This is a non-negotiable rule.

Everything under:

```text
sources/
```

represents the current Drumee compatibility baseline.

Agents may:

- read it;
- search it;
- trace dependencies;
- inspect Git history;
- run existing tests;
- build current components;
- use it as implementation reference.

Agents must **never modify it**.

Do not:

- refactor files under `sources/`;
- rename files;
- fix formatting;
- update dependencies;
- change imports;
- modify schemas;
- apply patches;
- alter package locks;
- make "small cleanup" commits.

If a change appears necessary, implement the new version under `target/` after the mapping phase has been approved.

The baseline must remain available for comparison throughout the entire refactoring.

---

# 3. Source provenance

Every imported repository must be traceable to its original source.

Maintain:

```text
SOURCE_MANIFEST.md
```

For every repository, record at minimum:

```text
name
repository URL
branch
commit SHA
import date
import method
```

Example:

```text
ui-team
repository: https://github.com/drumee/ui-team
branch: preview
commit: <sha>
```

For `cli`, record the exact branch/SHA being mapped.

The manifest is part of the reproducibility contract.

If Git history has been imported into the monorepo, preserve it.

Do not rewrite source history unnecessarily.

---

# 4. Primary architectural goal

The desired architecture is:

```text
                  CONTROL PLANE / TOOLING
                           │
                           ▼
APPLICATIONS / DISTRIBUTIONS
            │
            │ dynamically loadable modules
            ▼
DRUMEE MINIMAL OS / SHELL
            │
            ▼
DRUMEE CORE / SDK / RUNTIME
            │
            ▼
PACKAGING / DEPLOYMENT
```

The Control Plane is administratively above the runtime but must not be required for the runtime to boot.

Drumee Team must become a distribution assembled from:

```text
Drumee Minimal OS
+
System Modules
+
Team Modules
```

The current user-facing behavior of Drumee Team must remain available.

---

# 5. Drumee Team is a migration source and later compatibility target

The existing Team implementation must remain fully functional as an immutable reference system.

However, Drumee Team is **not** the primary architectural target of the first minimal-kernel extraction.

The primary target is:

```text
server-essentials          ui-essentials
        ↑                        ↑
 server-runtime              ui-runtime
        └──────────┬─────────────┘
                   ↓
                 hello
                   ↓
               marketing
```

The first kernel must be application-neutral and capable of hosting new independent modules without depending on:

```text
server-team
ui-team
```

Conceptually:

```text
sources/ui-team
sources/server-team
sources/schemas
        │
        ▼
CURRENT DRUMEE TEAM
        │
        │ migration source / reference evidence
        ▼
minimal kernel
        +
later extracted Team modules
        │
        ▼
FUTURE DRUMEE TEAM DISTRIBUTION
```

The baseline compatibility harness remains valuable as:

```text
evidence
+
regression reference
+
source of intentionally selected kernel contracts
```

It is **not** a requirement to reproduce every Team-era behavior before the no-Team kernel can be built.

Do not allow historical Team coupling, policy, MFS presentation behavior, Finder behavior, Window Manager behavior, collaboration features, or distribution-specific assumptions to determine the initial kernel boundary unless they are independently justified as application-neutral primitives.

Selected Team behavior must eventually be migrated and preserved where required, but that migration happens **after** the kernel has been validated by `hello` and exercised by `marketing`.

The intended sequence is:

```text
minimal backend/frontend runtime
→ hello
→ intentional MFS
→ marketing
→ kernel stabilization
→ Team migration module by module
```

Any deliberate incompatibility with Team-era behavior must be documented.

Do not silently remove valuable Team behavior, but do not optimize the first kernel for Team compatibility at the expense of a small, reusable module host.

---

# 6. The first phase is mapping only

Until explicitly instructed otherwise, the current phase is:

```text
ANALYSIS
→ MAPPING
→ ARCHITECTURE
```

not implementation.

During the mapping phase:

## Allowed writes

Only write to:

```text
docs/refactoring/
```

and, when necessary:

```text
SOURCE_MANIFEST.md
```

## Forbidden writes

Do not modify:

```text
sources/
target/
tests/
```

Do not begin extraction.

Do not create compatibility shims.

Do not move code.

Do not implement new loaders.

Do not change package dependencies.

Do not modify Drumee Core.

Do not change schemas.

Do not implement business modules.

The first deliverable is documentation.

---

# 7. Repositories that must be analyzed

At minimum inspect:

```text
sources/ui-team
sources/server-team
sources/schemas
sources/setup-schemas
sources/debian
sources/cli
sources/loby
sources/signin
```

Also inspect the lower-level packages used by Team, including where relevant:

```text
@drumee/server-core
@drumee/server-essentials
@drumee/ui-core
@drumee/ui-essentials
@drumee/ui-toolkit
@drumee/ui-styles
```

If these packages are imported into `sources/`, inspect them there.

Otherwise inspect the exact versions used by the baseline.

Do not assume that repository or package names define correct architectural ownership.

The code is the source of truth.

---

# 8. Special role of `debian`

The existing `debian` repository is part of the analysis because it represents the current **self-hosting and distribution layer**.

It must not automatically be classified as part of the minimal OS.

Analyze how it currently depends on:

```text
server-team
ui-team
schemas
setup-schemas
other build/deployment components
```

Determine how those dependencies should evolve after modularization.

The intended future responsibility of the deployment layer is conceptually:

> take a Drumee runtime, a distribution manifest, and a set of modules, and produce a self-hosted installable system.

Do not redesign the deployment format during the mapping phase.

Document the current behavior first.

---

# 9. Special role of `cli`

The `cli` repository is part of the architectural mapping because it represents the current administrative/control-plane interface to Drumee.

It must be analyzed independently from both the runtime and the deployment layer.

The current CLI branch being mapped exposes at least these functional domains:

```text
user / drumate
hub
settings
MFS
generic Drumee API access
```

It also exposes an important abstraction:

```text
commands
   ↓
backend abstraction
   ├── database backend
   └── API backend
```

The mapping must determine the exact implementation and responsibilities of both backends.

Inspect how the CLI currently interacts with:

- user/drumate lifecycle;
- hub lifecycle;
- settings/sys_conf;
- factory warm-pool provisioning;
- yellow-pages / `yp`;
- entity shard databases;
- MFS SQL procedures;
- physical MFS storage;
- MFS import/export;
- hub/drumate deletion and purge;
- API authentication;
- generic `module.method` service calls;
- local/native self-hosting;
- Docker/self-hosting;
- configuration files such as `/etc/drumee`;
- `@drumee/server-essentials` or related packages.

The CLI must **not** be assumed to manage plugin lifecycle today unless this is proven from the imported source.

Future module-management responsibilities must be classified as `INVESTIGATE`, not as existing behavior.

The desired long-term relationship is conceptually:

```text
CLI / CONTROL PLANE
        ↓
stable Drumee administrative contracts
        ↓
Minimal OS + installed modules
```

The OS must not depend on the CLI.

The CLI may depend on stable APIs/contracts exposed by the OS and platform services.

---

# 10. Required classification model

Every major subsystem, directory, service family, schema family, UI application, CLI command family, and build component must be classified into one of these categories.

## `KEEP_OS`

Required for a minimal Drumee operating environment.

Potential examples:

```text
bootstrap
runtime initialization
session/context
hub/drumate context
ACL engine integration
service dispatch
module discovery/loading
MFS primitives
event transport
LETC runtime integration
Window Manager primitives only as a later post-MFS kernel candidate
```

A capability belongs here only if Drumee requires it to load, isolate, authorize, execute, or host applications.

---

## `SYSTEM_MODULE`

A generally useful application or service that should be dynamically loadable but is not required for Drumee to boot.

Potential examples:

```text
Finder
Signin
generic previewers
generic user utilities
```

Do not confuse a system application with an OS primitive.

Example:

```text
MFS engine     → KEEP_OS
Finder         → SYSTEM_MODULE
```

---

## `TEAM_MODULE`

A capability belonging specifically to the Drumee Team distribution.

Potential examples:

```text
chat
meetings
tasks
Team collaboration workflows
```

These modules must still be available in the reconstructed Team distribution.

---

## `SDK_OR_ESSENTIALS`

Reusable primitives that belong in an existing or future SDK/core/essentials/toolkit layer.

A key architectural invariant is that **`server-essentials` must remain usable outside Drumee**.

Generic capabilities such as MariaDB connectivity, stored-procedure/query helpers, transactions, pooling, generic error/result handling, logging/configuration helpers, and other server utilities may belong here when they do not require Drumee concepts.

Before using this category, inspect existing Drumee packages.

Do not create new low-level packages merely to produce cleaner diagrams.

Do not introduce Drumee-specific dependencies into `server-essentials` merely to simplify the transition.

Apply the same principle to `ui-essentials`: keep it generic and reusable. Drumee-specific runtime context such as `Host`, `Visitor`, `Organization`, plugin orchestration, MFS semantics, Finder, or Window Manager belongs above `ui-essentials`.

---

## `BUSINESS_MODULE`

Business-domain functionality that clearly does not belong to Drumee OS.

Example:

```text
Copywriting
```

Future business applications should be installable modules.

---

## `CONTROL_PLANE`

Administrative or developer-facing tooling used to manage, inspect, configure or operate a Drumee installation without being required inside the runtime process itself.

Potential examples:

```text
Drumee CLI
node administration
domain administration
user/drumate administration
hub administration
administrative MFS commands
runtime inspection
future module lifecycle commands
```

A `CONTROL_PLANE` component may depend on stable OS/platform contracts.

The OS must never depend on the control-plane implementation.

---

## `DEPLOYMENT`

Packaging, installation, self-hosting, distribution generation, system configuration, or release infrastructure.

The current `debian` repository is primarily expected to fall into this category, subject to source analysis.

---

## `LEGACY`

Code that appears:

```text
unused
duplicated
obsolete
superseded
```

Do not remove it during mapping.

Provide evidence.

---

## `INVESTIGATE`

Use this whenever ownership is unclear.

Never force a classification merely to complete a table.

---

# 11. Core decision principle

Use the following rule when classification is ambiguous:

> If a capability is required for Drumee to load, isolate, authorize, execute, or host modules, it may belong to the OS.
>
> If a capability performs useful work for the user but Drumee can boot and host modules without it, it is probably a module.
>
> If a capability administers a running Drumee installation without being required by the runtime itself, it probably belongs to the Control Plane.
>
> If a capability installs, packages or deploys Drumee onto machines, it probably belongs to Deployment.

Examples:

```text
MFS primitive            → KEEP_OS
Finder application       → SYSTEM_MODULE

Window Manager runtime   → INVESTIGATE initially; possible KEEP_OS only after MFS/resource semantics are established
Document editor          → SYSTEM_MODULE

ACL engine               → KEEP_OS
Meeting permissions UI   → TEAM_MODULE

Module loader            → KEEP_OS
Chat                     → TEAM_MODULE

CLI user management      → CONTROL_PLANE
CLI MFS administration   → CONTROL_PLANE

Debian package build     → DEPLOYMENT
Docker self-hosting      → DEPLOYMENT
```

---

# 12. Required dependency mapping

For each major component, record:

```text
component
repository
path
responsibility
direct imports
runtime dependencies
database dependencies
MFS dependencies
ACL dependencies
frontend dependencies
CLI dependencies
build dependencies
deployment dependencies
consumers
classification
extraction difficulty
risk
```

Pay particular attention to hidden coupling:

```text
hard-coded paths
dynamic require
webpack aliases
global variables
singleton state
runtime registration
implicit schema dependencies
procedure naming assumptions
cross-repository imports
MFS assumptions
Window Manager assumptions
shared SCSS dependencies
filesystem layout assumptions
build-time generated files
deployment assumptions
direct SQL access from administrative tooling
physical storage assumptions
factory/provisioning assumptions
```

Important indirect dependencies must also be documented.

---

# 13. Do not reinvent Drumee Core

Before proposing a new primitive, search the existing implementation.

In particular inspect:

```text
server-core
server-essentials
ui-core
ui-essentials
ui-toolkit
ui-styles
schemas
cli backend abstractions
```

Do not create a replacement abstraction where Drumee already has one.

When recommending that code move to a lower-level package, document:

1. current implementation;
2. existing related primitives;
3. why ownership is currently wrong;
4. proposed destination;
5. compatibility impact;
6. smallest viable change.

## Transitional backend extraction: `server-runtime`

The project may introduce:

```text
target/foundation/server-runtime/
```

as the **transitional extraction workspace for the future minimal Drumee server kernel**.

Its purpose is not to preserve `server-team` as the primary target. Its purpose is to extract, reduce, and stabilize the minimum application-neutral backend required to host independent Drumee modules.

The long-term architectural intent is:

```text
@drumee/server-essentials
          ↑
          │
server-runtime
          │
          ▼
future minimal Drumee server kernel
```

`server-essentials` remains an independent reusable package and must continue to work outside Drumee.

`server-core` is treated as a source of candidate Drumee runtime primitives. It is not assumed to survive unchanged as a final package.

`server-team` is a later migration source.

### Kernel inclusion rule

A capability belongs in the minimal kernel only when it is required to:

- boot Drumee;
- establish application/runtime context;
- authorize requests;
- dispatch module services;
- discover/load modules;
- expose stable module lifecycle primitives;
- provide generic persistence/shard access where required;
- provide MFS primitives when required by independent applications;
- host the frontend/runtime shell and managed application windows where applicable.

Do not move a capability into the kernel merely because Team currently depends on it.

Historical Team policy must not determine the future kernel boundary unless independently justified.

### `server-core` extraction rule

For every candidate area in `sources/server-core`:

```text
inspect current implementation
→ identify the minimal application-neutral responsibility
→ extract into server-runtime
→ test independently
→ keep Team-specific policy outside
```

Do not copy `server-core` wholesale merely to preserve compatibility.

Track provenance for every extracted capability.

### `server-essentials` independence invariant

No new Drumee-specific dependency may be introduced into `server-essentials`.

Code that remains in Essentials must not require concepts such as:

```text
hub
drumate
Drumee ACL
MFS semantics
module.method dispatch
plugin discovery
Team application behavior
```

unless ownership is explicitly reconsidered.

The deciding question is:

> Can this capability remain useful and coherent in a generic Node.js/MariaDB server application that does not run Drumee?

The MariaDB API and related generic database primitives are specifically considered valuable standalone capabilities and must remain independently usable.

### Reference application sequence

Before the first real business application, create exactly one minimal kernel-validation module:

```text
hello
```

No additional synthetic application is required before marketing.

The intended sequence is:

```text
Phase A   extract/iterate server-runtime and ui-runtime toward the minimal kernel
Phase B   validate backend/frontend plugin contracts with hello
Phase C   extract the minimal backend MFS/context capabilities required by real applications
Phase D   build marketing as the first real application
Phase E   stabilize the kernel from real application needs
Phase F   extract Finder / Window Manager only after MFS semantics exist
Phase G   migrate/extract Team capabilities one module at a time
```

### `hello` module

`hello` is a validation module, not a business application.

It must remain intentionally small.

At minimum it should prove:

```text
backend module discovery
→ backend ACL/descriptor registration
→ lazy backend service loading
→ module.method dispatch
→ Kind.loadPlugin({name, kind})
→ bootstrap.plugin(name)
→ frontend index/entry resolution
→ loadJS(path)
→ Kind.registerAddons(...)
→ requested kind rendered in a minimal host
```

Representative backend services may include:

```text
hello.ping
hello.echo
```

with behavior conceptually similar to:

```text
hello.ping
→ { status: "ok" }

hello.echo
→ returns supplied payload
```

The frontend should be a minimal LETC widget/application rendered in a simple host container. `hello` must not require Finder, MFS presentation, Desktop, or Window Manager.

Do not add MFS, AI, campaign logic, complex schemas, workflows, chat, tasks, meetings, or Team-specific capabilities to `hello`.

The governing rule is:

> `hello` validates the kernel; `marketing` drives the next useful kernel capabilities.

### Marketing as first real application

After `hello` passes, `marketing` becomes the first real application built against the new kernel.

Marketing may introduce real requirements such as:

```text
private hub usage
MFS
hub-local MariaDB schemas
ACL
dynamic services
LETC frontend
AI integration
Window Manager only if/after the MFS-based shell contract has been intentionally added
```

For every new requirement, decide deliberately whether it belongs in:

```text
server-essentials
minimal kernel
system module
marketing module
```

Do not automatically promote application needs into the kernel.

### Compatibility policy

The Phase 1 baseline harness remains useful as evidence and regression reference.

It is not an absolute requirement to reproduce every Team-era behavior.

Preserve the behaviors intentionally selected as kernel contracts.

Any deliberate incompatibility with Team-era behavior must be documented.

### Final extraction expectation

The current `server-runtime` name/package is transitional.

It may later disappear, be renamed, or become the final server-kernel package only by explicit architectural decision.

What must survive is:

```text
independent server-essentials boundary
+
validated minimal Drumee kernel boundary
```

Team migration must target that validated kernel rather than forcing the kernel back toward the old Team architecture.

---

## Transitional frontend extraction: `ui-runtime`

The project may introduce:

```text
target/foundation/ui-runtime/
```

as the **transitional extraction workspace for the future minimal Drumee frontend kernel**.

It plays the frontend role symmetric to `server-runtime`:

```text
@drumee/server-essentials          @drumee/ui-essentials
          ↑                                  ↑
          │                                  │
   server-runtime                       ui-runtime
          │                                  │
          └──────── minimal Drumee ──────────┘
                        kernel
```

`ui-essentials` remains the generic lower-level frontend package.

`ui-core` is treated as a source of candidate frontend runtime primitives. It is **not** assumed to survive unchanged as the final frontend kernel because it currently contains responsibilities beyond a minimal LETC runtime, including MFS-related built-in kinds and other higher-level Drumee concepts.

### Initial `ui-runtime` inclusion rule

The initial frontend kernel should contain only capabilities required to:

- initialize the minimal Drumee frontend context;
- execute LETC widgets;
- maintain the Kind/addon registry;
- dynamically resolve and load frontend plugins;
- perform service calls to the backend;
- establish the Drumee identity/ACL context needed by applications.

The following current concepts are considered kernel candidates because they participate in the frontend/backend ACL and runtime context:

```text
Host
Visitor
Organization
```

Do not remove these merely because they look application-specific. They are required to maintain the client-side Drumee context corresponding to backend authorization semantics.

The backend remains the security authority. Frontend ACL/context objects must never be treated as sufficient authorization by themselves.

### Initial exclusions from `ui-runtime`

Do not initially include higher-level MFS presentation or desktop behavior such as:

```text
DrumeeMFS presentation/workflow logic
media_folder
media_document
media_thread
Finder
Window Manager
Desktop
file/application associations
Team seeds
Team routes
```

Generic MFS client primitives may later enter the kernel only after the backend MFS boundary has been intentionally extracted and validated.

Window Manager extraction must not precede the backend MFS/context capabilities that give managed resources and applications their semantics.

### `ui-core` extraction rule

For every candidate area in `sources/ui-core`:

```text
inspect current implementation
→ identify minimal application-neutral responsibility
→ extract into ui-runtime
→ test independently
→ leave MFS presentation / desktop / Team behavior outside
```

Do not copy `ui-core` wholesale.

Track provenance for every extracted capability.

---

## Existing plugin contracts to preserve during initial extraction

The current Drumee implementation already contains useful dynamic-plugin mechanisms on both backend and frontend.

The first kernel extraction must **preserve and simplify these existing contracts before attempting to unify or redesign them**.

Do not invent a new plugin system while extracting the minimal kernel.

### Backend plugin contract

The current backend mechanism is conceptually:

```text
startup
  ↓
plugin roots / ACL directories
  ↓
acl/*.json
  ↓
module/service descriptor registration
  ↓
module registry

request: module.method
  ↓
resolve service descriptor
  ↓
choose public/private implementation from session context
  ↓
lazy require(service implementation)
  ↓
Worker cache
  ↓
ACL / permission evaluation
  ↓
GRANTED
  ↓
worker.method()
```

The generic responsibilities to extract from the current Team router into `server-runtime` include, where confirmed by source:

```text
module registry
plugin ACL/descriptor discovery
module.method parsing
service descriptor resolution
public/private implementation resolution
permission descriptor resolution
lazy Worker loading
Worker cache
post-authorization dispatch
```

Do **not** extract Team-specific router policy with this mechanism.

Examples of policy that must remain outside the generic dispatcher include product-specific secure-share restrictions, billing/over-limit rules, and service-specific Team allow/deny lists.

The current backend ACL JSON is both authorization metadata and an execution descriptor. Preserve that behavior for the first extraction unless a later approved module-contract phase replaces it.

### Frontend plugin contract — two-stage resolution

Frontend plugin loading is a two-stage contract shared between `ui-core` and the backend bootstrap service.

#### Stage 1 — frontend request and dynamic load

The canonical frontend primitive is the existing:

```text
Kind.loadPlugin({ name, kind })
```

Its minimal behavior to preserve is:

```text
kind already registered?
  ├── yes → return it
  └── no
       ↓
call bootstrap.plugin(name)
       ↓
receive { path }
       ↓
loadJS(path)
       ↓
wait for addon registration
       ↓
Kind.get(kind)
```

The frontend must resolve plugins by **logical name**, not by knowing installation paths directly.

`Kind.loadPlugin()`, the Kind/addon registry, dynamic JS loading, and addon registration are therefore first-class `ui-runtime` candidates.

#### Stage 2 — backend bundle resolution

The backend service equivalent to the current:

```text
bootstrap.plugin
```

is a first-class `server-runtime` candidate.

Its generic responsibility is:

```text
logical plugin name
  ↓
locate installed frontend plugin descriptor/index.json
  ↓
read entry
  ↓
resolve public bundle URL/path
  ↓
return { path }
```

Preserve the current distinction between logical plugin identity and physical/public bundle location.

Do not make frontend code depend on filesystem layout.

#### Registration handshake

Loading the JavaScript bundle is not the end of the frontend plugin lifecycle.

The loaded bundle must register its kinds/addons through the existing registration mechanism, conceptually:

```text
loadJS(path)
  ↓
execute plugin bundle
  ↓
Kind.registerAddons(...)
  ↓
addons:registered
  ↓
Kind.loadPlugin() resolves requested kind
```

This registration handshake is part of the minimal frontend plugin contract and must be covered by tests.

### Do not unify backend and frontend descriptors prematurely

Today backend and frontend plugins use different existing descriptors:

```text
backend:  acl/*.json
frontend: index.json + bundle entry
```

For the first minimal kernel, preserve those two proven mechanisms.

Do not introduce a universal manifest merely for architectural symmetry.

A normalized/common descriptor may be considered later only after the `hello` vertical slice works end-to-end and the concrete requirements are understood.

### Kernel plugin symmetry

The minimal vertical path to validate is:

```text
                         hello
                       /       \
                      /         \
              frontend           backend
                  │                 │
             ui-runtime       server-runtime
                  │                 │
          ui-essentials     server-essentials
                  │                 │
                  └───── HTTP ──────┘
```

with two key runtime contracts:

```text
backend service call: module.method
frontend plugin load: bootstrap.plugin → { path }
```

---

# 14. Analyze dynamic-module reference implementations

Use at minimum:

```text
loby
signin
```

as architectural evidence.

Also inspect other sandbox or plugin examples if present.

Document how current modules handle:

```text
identity
package registration
backend services
ACL
schema installation
frontend widgets
kinds
Window Manager integration
build output
runtime discovery
versioning
installation
upgrade
enable/disable
```

Do not assume these implementations are perfect.

For each pattern distinguish:

```text
existing behavior
good candidate for standardization
historical inconsistency
missing capability
```

---

# 15. `schemas` requires explicit ownership analysis

The future minimal schemas layer must contain only data structures and procedures required to operate Drumee itself.

Business and Team-specific schemas should ultimately belong to their modules.

Analyze at minimum:

```text
common
yellow_page
hub
drumate
templates
patches
provisioning
application-specific schemas
```

For each schema/procedure family determine:

```text
what uses it
which database class owns it
whether provisioning depends on it
whether new hub creation depends on it
whether new drumate creation depends on it
whether Team depends on it
whether CLI depends on it
whether self-hosting depends on it
whether it is an OS primitive
whether it can become module-owned
```

Do not modify `common` during mapping.

Do not assume existing schema placement is correct simply because it is old.

---

# 16. Provisioning requires explicit mapping

Because both current administrative tooling and self-hosting may depend on provisioning behavior, map the complete lifecycle for:

```text
new drumate
new hub
factory warm pool
database assignment
MFS allocation
yp registration
entity initialization
deletion/purge
```

For every step identify:

```text
CLI responsibility
server/runtime responsibility
schema/procedure responsibility
setup-schemas responsibility
deployment responsibility
physical storage responsibility
```

Do not redesign provisioning during mapping.

First document the existing behavior.

---

# 17. MFS requires explicit cross-layer mapping

MFS is a central OS primitive and is currently consumed by multiple layers.

Map at minimum:

```text
MFS SQL procedures
MFS service APIs
physical storage layout
MFS node identity
permissions/ACL
Finder/UI usage
Window Manager drag-and-drop
CLI import/export
CLI destructive operations
cross-hub operations
```

The mapping must distinguish:

```text
MFS engine / semantic primitives
MFS storage implementation
MFS user-facing applications
MFS control-plane operations
```

Do not classify Finder, CLI MFS commands and the MFS engine as the same architectural component.

---

# 18. Target module contract

The mapping phase must propose a normalized Drumee module contract.

Do not implement it yet.

Investigate whether the standard contract should support:

```text
identity
name
version
compatibility

backend
services
ACL
schemas

frontend
widgets
kinds
windows
locales
assets

lifecycle
install
upgrade
enable
disable
remove
```

Prefer extension and normalization of existing Drumee mechanisms over replacement.

The module contract must eventually be consumable by:

```text
runtime module loader
schema installer/provisioner
distribution builder
control plane / CLI
deployment tooling
```

Do not assume all consumers need the same implementation API.

Identify the smallest stable shared contract.

---

# 19. CLI and future module lifecycle

The current CLI source must be mapped as it exists today.

Do not claim plugin/module lifecycle support unless proven.

However, the mapping must answer this architectural question:

> Should the Drumee CLI become the administrative interface for module install / enable / disable / upgrade / remove once the module contract is standardized?

Classify the answer initially as:

```text
INVESTIGATE
```

The analysis should determine whether existing CLI architecture can support this cleanly.

Specifically inspect whether its current:

```text
command architecture
backend abstraction
API transport
DB transport
configuration
error handling
output formatting
```

can support module lifecycle without introducing Team-specific knowledge.

---

# 20. Distribution model

The target architecture should distinguish:

```text
runtime
control plane
modules
distribution
deployment
```

Example conceptual model:

```text
                 Drumee CLI
                     │
                     ▼
             Drumee Minimal OS
                     │
        ┌────────────┼─────────────┐
        │            │             │
      Signin       Finder        Team modules
                                   │
                                   ▼
                           Drumee Team Distribution
                                   │
                                   ▼
                           Self-hosting deployment
```

Do not hard-code this exact final module list before mapping the code.

The architecture document must derive the real boundaries from source analysis.

---

# 21. Implementation phase rules

These rules apply only after the mapping phase has been explicitly approved.

During implementation:

## Read from

```text
sources/**
```

## Write to

```text
target/**
tests/**
docs/**
```

## Never modify

```text
sources/**
```

New architecture must be built beside the baseline.

Do not "move" code out of `sources/`.

Instead:

```text
study source
→ reproduce/extract under target
→ test compatibility
```

## Kernel extraction subphase — Phase 1.5

Before normalized module-contract work proceeds, perform:

```text
Phase 1.5 — Minimal backend/frontend kernel extraction
```

The purpose is to establish **both** transitional extraction workspaces:

```text
target/foundation/server-runtime/
target/foundation/ui-runtime/
```

and use them to extract the smallest Drumee kernel capable of running an independent `hello` module without `server-team` or `ui-team`.

Initial sources are:

```text
sources/server-core                 sources/ui-core
        +                                +
independent server-essentials      independent ui-essentials
        ↓                                ↓
server-runtime                      ui-runtime
        └──────────────┬─────────────────┘
                       ↓
                  minimal kernel
                       ↓
                     hello
```

Phase 1.5 must not:

- alter `sources/**`;
- absorb `server-team` or `ui-team`;
- use Team compatibility as the primary design constraint;
- make `server-essentials` Drumee-dependent;
- copy all of `server-core` without classification;
- copy all of `ui-core` without classification;
- introduce MFS presentation, Finder, Desktop, or Window Manager merely to make `hello` work;
- redesign the backend/frontend plugin contracts before the existing mechanisms have been extracted and tested;
- begin unrelated Team module extraction;
- turn `server-runtime` or `ui-runtime` into permanent public APIs by accident.

Phase 1.5 is complete only when:

- [ ] `server-runtime` builds reproducibly;
- [ ] `ui-runtime` builds reproducibly;
- [ ] the first minimal backend and frontend kernel boundaries are documented;
- [ ] `hello` runs without `server-team` and without `ui-team`;
- [ ] backend `hello.ping` works through the extracted `module.method` dispatch path;
- [ ] the backend plugin descriptor/ACL registration and lazy service loading path are covered;
- [ ] frontend `Kind.loadPlugin()` calls the extracted `bootstrap.plugin` resolver;
- [ ] `bootstrap.plugin` resolves a logical plugin name to the frontend bundle entry/path;
- [ ] `loadJS()` loads the bundle and the addon registration handshake completes;
- [ ] the requested `hello` kind is rendered in a minimal host without Window Manager;
- [ ] `Host`, `Visitor`, and `Organization` are available where required for the frontend Drumee/ACL context;
- [ ] Essentials-only standalone tests pass without Drumee Core;
- [ ] ownership/provenance of every extracted `server-core` and `ui-core` area remains traceable;
- [ ] no Drumee-specific dependency has leaked into `server-essentials`;
- [ ] MFS-specific built-in kinds and Team/desktop policy remain outside the first `ui-runtime` boundary;
- [ ] Team-specific backend policies remain outside `server-runtime`;
- [ ] the transitional nature of both runtime workspaces is documented.

---

# 22. Target repository areas

The current hypothesis is:

```text
target/
├── foundation/
│   ├── server-runtime/       # transitional backend extraction workspace
│   └── ui-runtime/           # transitional frontend extraction workspace
│
├── os/
│   ├── server/
│   ├── ui/
│   └── schemas/
│
├── control-plane/
│   └── cli/
│
├── modules/
│   └── ...
│
├── distributions/
│   └── team/
│
└── deployment/
    └── self-hosting/
```

This structure may be refined after mapping.

Agents must not create final repository boundaries prematurely.

The monorepo exists precisely so cross-cutting refactors can remain atomic while boundaries are still evolving.

---

# 23. Avoid big-bang refactoring

The migration must be incremental.

Preferred sequence:

```text
identify boundary
→ add compatibility tests
→ extract one capability
→ integrate it dynamically
→ reconstruct Team behavior
→ verify compatibility
→ proceed to next capability
```

Avoid:

```text
rewrite ui-team
rewrite server-team
rewrite schemas
rewrite CLI
rewrite deployment
→ test at the end
```

The target tree must remain testable throughout implementation.

---

# 24. Compatibility requirement for every extraction

Every extraction proposal must answer:

## Before

Where does the capability live today?

## Target

Where should it live?

## Dependencies

What must move with it?

## Compatibility

How does Drumee Team continue to use it?

## Control Plane

Does the CLI currently depend on this capability?

If yes, how will that dependency remain compatible?

## Deployment

Does self-hosting depend on this capability?

If yes, how will packaging/install behavior remain compatible?

## Incremental migration

Can old and new implementations coexist temporarily?

## Tests

How will functional equivalence be proven?

## Rollback

How can the extraction be reverted?

No extraction is considered planned without these answers.

---

# 25. Reconstruction of Drumee Team

A major goal of the monorepo is to enable this test:

```text
target/os
+
target/modules
+
target/distributions/team
        ↓
Drumee Team
```

The reconstructed distribution must eventually match the baseline behavior represented by:

```text
sources/ui-team
sources/server-team
sources/schemas
```

Compatibility tests should progressively compare both environments.

This reconstruction is the primary proof that modularization has not damaged Drumee Team.

---

# 26. Control-plane compatibility

The refactoring must also preserve administrative capabilities.

Conceptually:

```text
sources/cli
   ↓
CURRENT ADMINISTRATION MODEL
```

must eventually remain viable against:

```text
target/os
+
target/modules
+
target/control-plane/cli
```

The final control plane should not require Team-specific internal knowledge.

Administrative contracts should become explicit and stable.

Do not force this migration before the current CLI dependencies are mapped.

---

# 27. Self-hosting compatibility

The refactoring must preserve both current self-hosting channels where applicable.

Map and later test:

```text
Docker / container deployment
native Debian deployment
```

The deployment layer must eventually consume stable distribution/runtime/module artifacts rather than rely on accidental repository layout.

Do not change current self-hosting behavior during mapping.

---

# 28. Required mapping deliverables

Create:

```text
docs/refactoring/
```

with the following documents.

---

## `01-current-architecture.md`

Describe the current architecture of:

```text
ui-team
server-team
schemas
setup-schemas
debian
cli
core/essentials packages
module loading system
```

Use diagrams where useful.

---

## `02-component-map.md`

Use a component-by-component table.

Recommended form:

| Component | Repo/path | Responsibility | Dependencies | Classification | Extraction risk |
|---|---|---|---|---|---|

Allowed classification values:

```text
KEEP_OS
SYSTEM_MODULE
TEAM_MODULE
SDK_OR_ESSENTIALS
BUSINESS_MODULE
CONTROL_PLANE
DEPLOYMENT
LEGACY
INVESTIGATE
```

---

## `03-dependency-map.md`

Document major dependencies across repositories.

Include at minimum:

```text
ui-team → ui-core / ui-essentials
server-team → server-core / server-essentials
Team apps → MFS
Team apps → ACL
Team apps → schemas
schemas → provisioning/templates
cli → server-essentials
cli → yp
cli → entity shards
cli → MFS procedures/storage
cli → Drumee service API
debian → Team/server/schema sources
dynamic modules → runtime loader
```

Highlight:

```text
cycles
implicit dependencies
runtime coupling
build coupling
control-plane coupling
deployment coupling
```

---

## `04-schema-map.md`

Inventory and classify schema and procedure families.

For each family identify whether it belongs to:

```text
minimal OS
system module
Team module
control plane dependency
deployment/provisioning
legacy
investigate
```

---

## `05-module-contract.md`

Document the current module-loading contract based on actual source implementations.

Then propose a normalized target contract.

Clearly separate:

```text
CURRENT
STANDARDIZE
ADD
DEPRECATE
```

Also identify how the future contract could be consumed by the CLI without assuming that such support already exists.

---

## `06-target-architecture.md`

Describe the proposed final architecture:

```text
Core / SDK
Minimal OS
Control Plane / CLI
System Modules
Team Modules
Team Distribution
Business Modules
Self-hosting Deployment
```

Cover:

```text
frontend
backend
schemas
module lifecycle
control plane
build
deployment
```

---

## `07-migration-plan.md`

Provide an incremental migration sequence.

For every phase include:

```text
goal
scope
prerequisites
affected areas
compatibility strategy
control-plane impact
deployment impact
tests
rollback
risk
expected benefit
```

---

## `08-risk-register.md`

At minimum investigate:

```text
schema provisioning
hub/drumate template generation
factory warm pool
dynamic imports
runtime globals
circular dependencies
webpack/module resolution
MFS assumptions
physical storage assumptions
ACL assumptions
Window Manager dependencies
Team boot sequence
CLI direct database access
CLI destructive MFS/storage operations
CLI DB/API behavioral differences
upgrade process
patch process
self-hosting packaging
existing installations
package version compatibility
```

Rate risks:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

---

## `09-self-hosting-map.md`

Dedicated analysis of `sources/debian`.

Document:

```text
current build flow
required source repositories
generated packages/artifacts
Docker Compose flow
native Debian flow
schema setup dependencies
configuration generation
runtime assumptions
release assumptions
CLI installation/integration
```

Then identify what the deployment layer will need from the future modular architecture.

Do not redesign it yet.

---

## `10-cli-map.md`

Dedicated analysis of `sources/cli`.

Document at minimum:

### Command architecture

```text
commands
context/lifecycle
argument parsing
output
errors
```

### Current command families

At least inspect:

```text
user/drumate
hub
settings
MFS
generic API access
```

### Backend abstraction

Map precisely:

```text
command
   ↓
backend
   ├── db
   └── api
```

For each backend identify:

```text
responsibility
source path
configuration
authentication
direct DB usage
service/API usage
error behavior
feature parity
```

### User/drumate lifecycle

Map:

```text
list
get
add/create
update
delete/purge
```

### Hub lifecycle

Map:

```text
list
get
members
create
delete/purge
```

### Provisioning

Map dependencies on:

```text
factory warm pool
yp
shard assignment
entity initialization
storage allocation
```

### Settings

Map:

```text
sys_conf
configuration sources
database access
runtime assumptions
```

### MFS

Map:

```text
procedures used
physical storage access
import
export
safety checks
cross-tenant protections
destructive operations
```

### API backend

Map:

```text
authentication/pairing
token handling
module.method dispatch
remote operation model
```

### Dependencies

Map at minimum:

```text
@drumee/server-essentials
MariaDB
filesystem/storage
/etc/drumee or equivalent configuration
self-hosting assumptions
```

### Classification

Default architectural hypothesis:

```text
CONTROL_PLANE
```

but classify subcomponents individually where needed.

### Future module lifecycle

Investigate, but do not assume, whether the CLI should eventually expose:

```text
module install
module list
module enable
module disable
module upgrade
module remove
```

Determine what stable platform contract would be required.

---

## `11-open-questions.md`

Everything not proven from code belongs here.

Never silently convert assumptions into decisions.

---

# 29. Evidence requirement

Every significant architectural conclusion must reference source code.

Use repository-relative paths such as:

```text
sources/server-team/path/file.js
sources/ui-team/path/widget.js
sources/schemas/path/procedure.sql
sources/loby/path/service.js
sources/signin/path/widget.js
sources/debian/path/script.sh
sources/cli/path/file.js
```

Where useful, reference the relevant:

```text
function
class
procedure
module
command
backend adapter
build target
```

Avoid unsupported statements.

---

# 30. Git discipline

This repository is the only Git workspace agents should modify during the refactoring project.

Agents must not commit changes directly to the original Drumee repositories.

## Baseline

After importing all sources, create a baseline tag such as:

```text
baseline/drumee-pre-minimal-os
```

## Mapping branch

Recommended branch:

```text
refactor/mapping
```

During this phase:

```text
write docs/refactoring/**
do not write target/**
do not modify sources/**
```

## Implementation branch

After mapping approval:

```text
refactor/minimal-os
```

During implementation:

```text
sources/** = read-only
target/** = implementation
tests/** = compatibility/integration
```

---

# 31. Commit discipline

Prefer small architectural commits.

Examples:

```text
docs(refactor): map current server architecture
docs(refactor): classify ui-team applications
docs(refactor): map schema ownership
docs(refactor): analyze self-hosting distribution
docs(refactor): map cli control-plane dependencies
docs(refactor): propose target module contract
```

During implementation:

```text
refactor(os): extract service loader
refactor(mfs): isolate MFS runtime primitives
refactor(finder): create system module
refactor(cli): align control plane with stable OS contract
test(team): add reconstruction compatibility checks
```

Do not mix unrelated extractions in one commit.

---

# 32. Original repositories remain untouched

The original GitHub repositories remain production/reference repositories during the refactoring.

Do not:

```text
push refactoring branches to them
modify their histories
publish experimental packages from them
change their default branches
```

All experimental work belongs to `transient`.

---

# 33. Role and lifecycle of `transient`

`transient` is intentionally temporary.

It exists to provide:

```text
immutable current sources
        +
cross-repository mapping
        +
atomic refactoring work
        +
compatibility tests
        ↓
validated architectural boundaries
        ↓
history-preserving repository extraction
```

Do not design APIs, package names, import paths, manifests, deployment logic, or user-facing documentation around the assumption that the repository itself will continue to be named `transient`.

Conversely, do not prematurely use `drumee-os` as the package/repository identity of code under `target/**` until the final repository boundary has been approved.

At least one final output is expected to be named:

```text
drumee-os
```

but the exact relationship between:

```text
target/os/**
```

and the future `drumee-os` repository must be determined by the approved mapping and target architecture.

The intended lifecycle is:

```text
transient
   ↓
mapping
   ↓
implementation under target/**
   ↓
compatibility validation
   ↓
final repository-boundary approval
   ↓
history-preserving extraction
   ↓
drumee-os + other final repositories
```

`transient` must not become the production Drumee OS repository merely by renaming it.

---

# 34. Final repository extraction

Do not split `target/` into final Git repositories during early implementation.

The monorepo exists to allow atomic cross-layer changes while architecture is unstable.

Only after module boundaries are proven should new repositories be extracted.

Conceptually:

```text
target/os/server
→ new repository

target/os/ui
→ new repository

target/control-plane/cli
→ new repository

target/modules/finder
→ new repository

target/modules/chat
→ new repository
```

`target/foundation/server-runtime` is not presumed to become a final repository.

Its purpose is transitional consolidation. Final extraction must preserve or recreate the approved independent `server-essentials` boundary and the Drumee-specific server/OS boundary.

Use history-preserving extraction where practical.

For example, a future extraction may use tooling such as `git filter-repo`.

Do not perform final extraction until explicitly approved.

---

# 35. Baseline tests

During mapping, identify how the current Team implementation is verified.

Document existing commands for:

```text
build
unit tests
integration tests
server startup
frontend startup
schema provisioning
hub creation
drumate creation
CLI smoke tests
CLI DB backend tests
CLI API backend tests
MFS import/export tests
server-essentials standalone tests outside Drumee
server-runtime kernel-contract tests during Phase 1.5
ui-runtime plugin-loading and addon-registration tests during Phase 1.5
self-hosting build
Docker deployment
native Debian deployment
```

If tests are missing, state this explicitly.

Do not hide missing compatibility coverage.

---

# 36. Tests must precede extraction

Before extracting a capability, add or identify tests covering its current behavior.

The safe migration pattern is:

```text
baseline behavior
→ test
→ extraction
→ reconstructed behavior
→ same test
```

When feasible, the same test scenarios should run against both baseline and target implementations.

For control-plane-sensitive capabilities, test both:

```text
CLI DB backend
CLI API backend
```

when both modes currently support the operation.

---

# 37. Agent behavior when uncertainty exists

If an agent cannot prove:

```text
ownership
runtime dependency
schema dependency
module loading behavior
CLI dependency
deployment dependency
provisioning behavior
storage ownership
```

it must:

1. classify the item as `INVESTIGATE`;
2. document the uncertainty;
3. continue mapping other areas where possible.

Do not invent architecture merely to make progress.

---

# 38. Stop condition — mapping phase

The mapping phase is complete only when:

- [ ] major `ui-team` subsystems are classified;
- [ ] major `server-team` subsystems are classified;
- [ ] major schema/procedure families are classified;
- [ ] `setup-schemas` responsibilities are understood;
- [ ] `debian` build/distribution dependencies are mapped;
- [ ] `cli` command architecture is mapped;
- [ ] `cli` DB backend is mapped;
- [ ] `cli` API backend is mapped;
- [ ] `cli` provisioning dependencies are mapped;
- [ ] `cli` MFS/storage dependencies are mapped;
- [ ] `loby` dynamic backend loading is documented;
- [ ] `signin` dynamic frontend loading is documented;
- [ ] relevant core/essentials ownership is mapped;
- [ ] major cross-repository dependencies are documented;
- [ ] current module contract is documented;
- [ ] target module contract is proposed;
- [ ] minimal OS boundary is proposed;
- [ ] control-plane boundary is proposed;
- [ ] Team compatibility strategy is explicit;
- [ ] CLI/control-plane compatibility strategy is explicit;
- [ ] self-hosting compatibility strategy is explicit;
- [ ] migration sequence is incremental;
- [ ] risk register exists;
- [ ] unresolved questions are explicit;
- [ ] no implementation source code has been changed.

---

# 39. Mandatory stop after mapping

After producing the required mapping documents:

# STOP.

Do not begin implementation.

Do not create files under:

```text
target/
```

Present the mapping for architectural review.

Implementation may begin only after explicit approval of:

```text
component classification
minimal OS boundary
control-plane boundary
module contract
Team reconstruction strategy
schema ownership
provisioning ownership
migration order
self-hosting strategy
CLI strategy
```

---

# 40. Final architectural objective

The goal is not to create a smaller `ui-team` or `server-team`.

The goal is to establish:

> **Drumee as a minimal operating environment capable of loading independent applications dynamically.**

Drumee Team must remain available as a complete distribution assembled from modules.

Administrative tooling must become a clean control plane consuming stable Drumee contracts.

Self-hosting must remain a deployment concern rather than leaking into runtime architecture.

Other distributions must become possible without forking the runtime.

For example:

```text
                    Drumee CLI
                        │
                        ▼
                Drumee Minimal OS
                        │
          ┌─────────────┼──────────────┐
          │             │              │
     Drumee Team    Copywriting     Future apps
     Distribution   Distribution
```

The minimal OS must remain business-domain neutral.

The new minimal kernel is the primary architectural target. `server-team` is migrated later, capability by capability, after the kernel has been validated by `hello` and exercised by the first real application, `marketing`.

`server-essentials` must remain a reusable server package whose generic capabilities can operate independently of Drumee. In particular, the generic MariaDB API must not become coupled to Hub, Drumate, MFS, Drumee ACL, module loading, or Team semantics.

`server-runtime` and `ui-runtime` are the transitional extraction workspaces used to iterate toward the backend and frontend halves of that minimal kernel. Their current names and packaging are not automatically the final Drumee OS boundaries.

`ui-essentials` should remain the generic lower-level frontend foundation, while `ui-core` is treated as an extraction source rather than an indivisible final kernel. The minimal frontend kernel must preserve the proven `Kind.loadPlugin()` / `bootstrap.plugin` / `registerAddons()` plugin path and the `Host` / `Visitor` / `Organization` context required for Drumee ACL semantics.

---

# 41. Summary instruction for coding agents

> Work only inside the `transient` monorepo. Treat `sources/**` as an immutable baseline containing the current Drumee ecosystem, including Team, schemas, provisioning, CLI, dynamic module examples, and self-hosting distribution code. During the mapping phase, modify only `docs/refactoring/**` and `SOURCE_MANIFEST.md` when needed. Analyze the current system from source code before proposing changes. Classify every major capability as OS primitive, system module, Team module, SDK/essentials, business module, control plane, deployment, legacy, or investigate. Treat `cli` as a first-class control-plane candidate and map its DB/API backends, provisioning dependencies, MFS/storage behavior and runtime/service interactions without assuming plugin lifecycle support that is not present in source. Treat Drumee Team as a migration source and later compatibility target, not as the primary architectural target. The primary target is a minimal, application-neutral Drumee kernel capable of hosting new independent modules. Preserve `debian` as the current self-hosting/distribution layer. Preserve `server-essentials` as an independently reusable, non-Drumee-specific server package; never introduce Hub, Drumate, MFS, Drumee ACL or module-runtime dependencies into its generic boundary merely to simplify the transition. Use `target/foundation/server-runtime` and `target/foundation/ui-runtime` as the Phase 1.5 extraction workspaces for iterating from current `server-core` and `ui-core` behavior toward a minimal backend/frontend Drumee kernel while depending on independent `server-essentials` and `ui-essentials`. Preserve the current plugin mechanics first: backend ACL/descriptor registration with lazy `module.method` service loading, and frontend `Kind.loadPlugin()` → `bootstrap.plugin` → `{path}` → `loadJS()` → `Kind.registerAddons()` handshake. Keep `Host`, `Visitor`, and `Organization` in the minimal frontend context where required for ACL semantics, but keep MFS presentation, Finder, Desktop, and Window Manager out of the first `hello` slice. Validate the new kernel first with exactly one minimal reference module, `hello`; add minimal MFS semantics next as required, then use `marketing` as the first real application to drive additional kernel requirements. Only after the kernel is stable should `server-team` be decomposed and migrated module by module. `server-runtime` and `ui-runtime` are not automatically final package boundaries. After mapping, stop and request architectural review. During later implementation, build all new architecture under `target/**`, never modify `sources/**`, and postpone final repository extraction until the OS, modules, control plane, Team reconstruction, independent Essentials boundary and self-hosting boundaries have been validated through compatibility tests.
