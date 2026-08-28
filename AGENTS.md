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
│   ├── os/
│   │   ├── server/
│   │   ├── ui/
│   │   └── schemas/
│   │
│   ├── control-plane/
│   │   └── cli/
│   │
│   ├── modules/
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

# 5. Drumee Team is the compatibility target

The existing Team implementation must remain fully functional as the reference system.

Conceptually:

```text
sources/ui-team
sources/server-team
sources/schemas
        │
        ▼
CURRENT DRUMEE TEAM
```

must eventually be matched by:

```text
target/os
+
target/modules
+
target/distributions/team
        │
        ▼
REBUILT DRUMEE TEAM
```

The refactoring is successful only when the rebuilt distribution is functionally compatible with the current Team distribution.

Do not optimize architecture at the expense of compatibility.

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
Window Manager primitives
LETC runtime integration
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

Before using this category, inspect existing Drumee packages.

Do not create new low-level packages merely to produce cleaner diagrams.

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

Window Manager runtime   → KEEP_OS
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

---

# 22. Target repository areas

The current hypothesis is:

```text
target/
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

---

# 41. Summary instruction for coding agents

> Work only inside the `transient` monorepo. Treat `sources/**` as an immutable baseline containing the current Drumee ecosystem, including Team, schemas, provisioning, CLI, dynamic module examples, and self-hosting distribution code. During the mapping phase, modify only `docs/refactoring/**` and `SOURCE_MANIFEST.md` when needed. Analyze the current system from source code before proposing changes. Classify every major capability as OS primitive, system module, Team module, SDK/essentials, business module, control plane, deployment, legacy, or investigate. Treat `cli` as a first-class control-plane candidate and map its DB/API backends, provisioning dependencies, MFS/storage behavior and runtime/service interactions without assuming plugin lifecycle support that is not present in source. Preserve Drumee Team as the compatibility target and `debian` as the current self-hosting/distribution layer. After mapping, stop and request architectural review. During later implementation, build all new architecture under `target/**`, never modify `sources/**`, and postpone final repository extraction until the OS, modules, control plane, Team reconstruction and self-hosting boundaries have been validated through compatibility tests.
