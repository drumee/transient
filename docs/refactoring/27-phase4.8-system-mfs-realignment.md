# Phase 4.8 — system-mfs architectural realignment and canonical closure

Phase 4.8 Finder Integration is functionally implemented and validated in `transient`.

Do NOT restart the Finder implementation.

Do NOT start Phase 4.9.

The remaining work is to **realign `system-mfs` with the actual Drumee backend architecture before committing its Phase 4.8 changes**, then rerun the complete integration against that committed canonical baseline.

Treat this prompt as authoritative for this corrective pass.

---

# 1. Current validated Phase 4.8 state

Repository:

```text
/home/somanos/github/transient
```

Existing Phase 4.8 commits:

```text
97ede9555  synchronize ui-team snapshot
897d51e2a  synchronize server-team snapshot
80222a56f  record Phase 4.8 reference snapshots
d6196192b  add MFS service/transfer boundaries
906816fd8  integrate Finder
5b965e5ea  close Phase 4.8 documentation
```

Closure report:

```text
docs/refactoring/26-phase4.8-finder-integration.md
```

Already validated:

```text
standalone LETC Finder
separate FinderWindow

optimized grid + pagination

single / checkbox / marquee selection

multi-item drag

same-hub MOVE

cross-hub COPY

multi-client synchronization

filtering
idempotence
reconnect reconciliation

recursive mixed upload

empty-folder preservation

chunked/resumable upload

recursive multi-root download

progress
cancellation

mfs-service boundary

mfs-transfer boundary

real Chromium Finder + Window Manager

two real WebSocket clients

Phase 4.7 regression against standalone packages
```

Do not redesign these components unless this backend audit proves an actual contract incompatibility.

---

# 2. Current system-mfs state

Authoritative repository:

```text
/home/somanos/github/system-mfs
https://github.com/drumee/system-mfs
```

Current package:

```text
@drumee/system-mfs@0.1.0-alpha.1
```

Previous canonical HEAD:

```text
cd87db7085bc8dd40614af7fa37cdd1a76ffc5a0
```

The generic Phase 4.8 working-tree changes have already passed the standalone suite, including disposable MariaDB tests:

```text
11/11
```

However:

```text
DO NOT COMMIT THE CURRENT SYSTEM-MFS WORKING TREE AS-IS.
```

First perform the architectural realignment described below.

No npm publication is authorized.

---

# 3. Architectural references

Inspect these repositories/files as authoritative architectural references.

## Request normalization

```text
https://github.com/drumee/server-core/blob/main/lib/input.js
```

## Session / trusted identity / hub context

```text
https://github.com/drumee/server-core/blob/main/lib/session.js
```

Pay particular attention to:

```text
_initHub()
_initUser()
_assign_user()
uid()
```

## Service access control

```text
https://github.com/drumee/server-core/blob/main/lib/acl.js
https://github.com/drumee/server-core/blob/main/lib/entity.js
```

## Output boundary

```text
https://github.com/drumee/server-core/blob/main/lib/output.js
```

## Last-resort sanitization

```text
https://github.com/drumee/server-essentials/blob/main/lib/logger.js
```

Pay particular attention to:

```text
sanitize()
```

## Historical shard provisioning

```text
https://github.com/drumee/server-team/tree/main/offline/factory
```

Especially:

```text
offline/factory/index.js
offline/factory/schema.js
```

## Historical MFS service implementation

Use the already pinned Phase 4.8 historical server-team snapshot where behavioral comparison matters:

```text
7fb16c449ed09258c501e88e3c87a4d71c51a941
```

Important paths include:

```text
service/media.js
service/private/media.js
acl/media.json
offline/media/**
```

## Historical schemas

```text
https://github.com/drumee/schemas
```

Important references include:

```text
common/procedures/mfs/**
common/procedures/acl/**
common/procedures/permission/**
common/tables/**

hub/**
drumate/**

yellow_page/procedures/hub/get_hub.sql
yellow_page/procedures/session/session_check_cookie.sql
```

Pay particular attention to:

```text
common/procedures/mfs/mfs_create_node.sql
common/procedures/mfs/user-permission.sql
common/procedures/mfs/parent-permission.sql
```

Do NOT modify `schemas`, `server-core`, `server-essentials` or `server-team` during this task.

---

# 4. Core architectural principle

Drumee deliberately delegates complex shard-local data operations to MariaDB procedures/functions.

The target architecture is NOT:

```text
JavaScript
    performs many individual SQL statements
    recomputes MFS tree state
    recomputes permissions
    manages local transactional mutation algorithms
```

when the operation is naturally local to one shard.

Preferred architecture:

```text
service / JS orchestration
        ↓
CALL shard.mfs_operation(...)
        ↓
stored procedure/function
        ↓
local transaction / local computation
        ↓
canonical result
```

JavaScript remains responsible for:

```text
request/service orchestration
cross-shard orchestration
calling procedures
retry policy where justified
normalizing SQL results
mapping typed SQL errors
inter-capability coordination
public result projection
```

---

# 5. SQL is part of the runtime implementation

SQL owned by `system-mfs` is not merely bootstrap material.

It is part of the executable capability.

`system-mfs` should own and version the SQL required for the generic MFS capability, including appropriate:

```text
tables
functions
procedures
triggers
```

But ownership must remain modular.

Do NOT absorb unrelated SQL merely because an old procedure references it.

---

# 6. Mandatory SQL file granularity

This is a strict invariant:

```text
ONE SQL OBJECT PER FILE
```

Every module-owned `.sql` file must contain exactly one schema object.

That means exactly one of:

```text
stored procedure
stored function
table definition
trigger
other independently versioned schema object where explicitly justified
```

In particular:

```text
ONE STORED PROCEDURE PER FILE.
```

Forbidden:

```text
one file containing several CREATE PROCEDURE statements

one file containing several functions

one file mixing tables + functions + procedures

one monolithic SQL bootstrap containing the entire MFS schema
```

Required form:

```text
schemas/common/procedures/mfs_create_node.sql
    → mfs_create_node only

schemas/common/procedures/mfs_make_dir.sql
    → mfs_make_dir only

schemas/common/functions/user_permission.sql
    → user_permission only

schemas/common/functions/parent_permission.sql
    → parent_permission only

schemas/common/tables/media.sql
    → media table only
```

Each routine file should follow the established Drumee convention:

```sql
DELIMITER $

DROP PROCEDURE IF EXISTS `routine_name`$
CREATE PROCEDURE `routine_name`(...)
BEGIN
  ...
END$

DELIMITER ;
```

or the equivalent for functions/triggers.

The schema manifest/provisioner is responsible for applying these files in dependency order.

Do not use file concatenation as an excuse to put multiple schema objects in one source file.

This invariant applies to all new or migrated `system-mfs` SQL introduced by this corrective pass.

---

# 7. Real shard architecture

The current Phase 4.6 assumption:

```js
databaseName(principal_id)
→ `mfs_${principal_id}`
```

must not remain the target architecture.

Drumee already has sharded entity databases registered in Yellow Pages.

The relevant database classes are primarily:

```text
hub
drumate
```

with a common schema layer shared between them:

```text
common
```

Conceptually:

```text
hub shard
    = common capabilities
    + hub-specific overlay

drumate shard
    = common capabilities
    + drumate-specific overlay
```

`common` is NOT a third MFS namespace type.

---

# 8. Public MFS identity

The canonical public MFS identity remains:

```js
{
  hub_id,
  nid
}
```

This identity must be used consistently by:

```text
Finder location
Finder items
MfsClient
MfsSync
drag payloads
move/copy source
move/copy destination
upload destination
download roots
public MFS events
```

Physical database identity is never the public MFS identity.

---

# 9. Shard resolution

The shard-resolution rule is:

```text
if hub_id is explicitly supplied:
    resolve that hub_id

otherwise:
    use the trusted virtual host / request host
    to determine hub_id

then:
    hub_id
        ↓
    entity / hub directory
        ↓
    physical shard descriptor
```

Historically this resolution is exposed through logic such as:

```text
get_hub(...)
```

The internal descriptor may contain:

```js
{
  hub_id,
  db_name,
  db_host,
  fs_host,
  home_dir,
  home_id,
  type
}
```

This descriptor is INTERNAL.

`system-mfs` MUST NOT derive the shard from:

```text
principal_id
nid
filename
client-provided db_name
```

---

# 10. Current-host fallback

If the request explicitly identifies a `hub_id`, use that hub.

If no explicit hub is supplied, the trusted request/session host context is used to resolve the current hub.

Conceptually:

```text
explicit hub_id
    ↓
get_hub(hub_id)

OR

trusted host/vhost
    ↓
get_hub(host/vhost)
    ↓
hub_id
```

Then:

```text
hub_id
    ↓
db_name / db_host / home_dir / type
```

Do not expose the physical descriptor outside the backend.

---

# 11. Input responsibility

`server-core/Input` is the canonical ingress-normalization layer.

It normalizes request data from:

```text
URL
query string
x-param-* headers
JSON/form body
cookies
host/vhost
multipart uploads
stream uploads
```

Service implementations should not independently reparse:

```text
request.headers
request.url
raw query strings
cookies
body
```

when the equivalent data is already available through `Input`.

However:

```text
Input DOES NOT AUTHORIZE.
```

Input only normalizes.

Its client-provided values remain untrusted.

---

# 12. Trusted uid

The authoritative caller identity is established by `server-core Session`.

It MUST NOT be taken from request parameters.

Canonical trust chain:

```text
request credentials / cookie / token
        ↓
Input
        ↓
Input.authorization()
        ↓
Session._initUser()
        ↓
yp.session_check_cookie(...)
        ↓
trusted server-side user
        ↓
Session.user
        ↓
Session.uid()
```

For normal cookie-based access:

```text
sid
    ↓
yp.cookie
    ↓
uid
    ↓
entity / drumate identity
```

If no authenticated identity is associated with the session, the server resolves the caller to the canonical nobody identity.

Historically:

```text
ID_NOBODY = ffffffffffffffff
```

or the configured equivalent.

The client must never choose its effective uid by submitting:

```text
uid
principal_id
owner_id
user_id
```

in request data.

---

# 13. Token-based identity

Special mechanisms such as validated MFS tokens also resolve identity server-side.

Conceptually:

```text
mfs_token
    ↓
server-side validation
    ↓
trusted pseudo-entity uid
```

This still does NOT mean the client supplied uid is trusted.

The authoritative identity remains:

```js
session.uid()
```

---

# 14. Session establishes trusted user and trusted current hub

Before normal ACL/service execution, the server must have:

```text
trusted uid
+
trusted current hub
```

`Session` is the owner of this context.

The service must not recreate either identity from request data.

---

# 15. Access control architecture

The actual authorization chain has multiple distinct responsibilities.

Do not collapse them.

The canonical model is:

```text
Session
    establishes WHO is calling

service ACL declaration
    states WHAT permission is required

user_permission(uid, nid)
    computes WHAT privilege the user has on an MFS node

Acl
    compares REQUIRED vs EFFECTIVE privilege

GRANTED / DENIED
    decides whether service execution may continue
```

---

# 16. ACL remains the service-level authorization authority

`server-core/lib/acl.js` owns service-level access-control orchestration.

It determines:

```text
service scope

required source permission

required destination permission

source node set

destination node set

platform/domain/resource checks

GRANTED / DENIED
```

An external MFS service must execute only after:

```text
ACL → GRANTED
```

Do not build a second service-level permission engine in:

```text
mfs-service
mfs-transfer
system-mfs
```

---

# 17. Service permissions are declarative

Externally exposed services must participate in the standard Drumee ACL declaration mechanism.

Historical reference:

```text
server-team/acl/media.json
```

Declarations include concepts such as:

```text
scope
src
dest
preproc
fast_check
```

Examples:

```text
read/download
    src: read

mkdir/upload
    destination/write semantics

remove
    source delete

move
    source delete
    destination write

copy
    source read
    destination write
```

Use historical behavior as evidence.

Do not invent new permission semantics merely for the refactor.

---

# 18. user_permission() is the canonical MFS effective-permission primitive

Historical reference:

```text
common/procedures/mfs/user-permission.sql
```

The function:

```sql
user_permission(uid, nid)
```

computes the effective MFS privilege of a trusted uid on a node.

It currently considers concepts including:

```text
account-wide permission

node-specific permission

no_traversal grants

wildcard identities

nobody / ffffffffffffffff normalization

parent inheritance through parent_permission()

resource-specific grants
```

This calculation belongs close to the MFS tree and shard data.

Do not reimplement it in JavaScript.

---

# 19. Authorization chain

The effective authorization path is conceptually:

```text
trusted Session.uid()
        +
declarative required permission
        +
public resource identity {hub_id,nid}
        ↓
server-core ACL
        ↓
acl_check / acl_array_check_next
        ↓
hub_id → physical shard
        ↓
<shard>.user_permission(uid, nid)
        ↓
effective privilege
        ↓
privilege & asked
        ↓
GRANTED / DENIED
```

This distinction is critical.

---

# 20. Authorization ownership invariant

`server-core ACL` owns:

```text
which permission a service requires

source/destination orchestration

scope checking

GRANTED/DENIED decision
```

`system-mfs` owns or must provide the MFS-specific primitives necessary to calculate effective MFS privilege, where those primitives are genuinely part of the MFS schema closure.

In particular, audit:

```text
user_permission()
parent_permission()
```

as likely MFS-owned primitives.

Do NOT assume every object involving a permission column automatically belongs to `server-core`.

---

# 21. Permission-schema ownership must be audited, not guessed

There is historical overlap between:

```text
common/procedures/mfs/**
common/procedures/permission/**
server-core/schemas/common/**
```

Therefore explicitly determine ownership of:

```text
permission table

user_permission

parent_permission

user_expiry

acl_check

acl_array_check_next

permission_grant

permission_revoke

permission_set

permission_tree
```

Expected conceptual boundary:

```text
ACL orchestration / generic permission administration
    likely server-core

MFS-tree-specific effective permission computation
    likely system-mfs
```

But inspect actual dependencies before moving anything.

Do NOT duplicate one authoritative routine in both packages.

Produce an ownership table in the final report.

---

# 22. Source and destination permission checks

The existing ACL already supports resource identities close to:

```js
{
  hub_id,
  nid
}
```

For multi-resource operations, preserve this model.

Examples:

```text
MOVE
    source permission
    +
    destination permission

COPY
    source permission
    +
    destination permission
```

Do not rebuild this logic in the Finder or service implementation.

---

# 23. mfs-service responsibility

`mfs-service` owns:

```text
MFS semantic request validation

service orchestration after ACL GRANTED

trusted shard resolution for explicit additional hubs

system-mfs invocation

cross-shard orchestration

normalization of internal results

public DTO projection

affected-scope determination

mutation-event construction

recipient-safe event projection

invocation of generic runtime push infrastructure
```

It does NOT own:

```text
authentication

trusted uid resolution

generic service ACL

generic permission calculation

native WebSocket transport

Redis socket registry

HTTP body parsing
```

---

# 24. Service-specific integrity checks remain valid

Removing general authorization logic from services does NOT remove service-specific invariants.

Examples:

```text
transfer_id belongs to current trusted uid

transfer belongs to expected hub

chunk index is valid

chunk size is valid

operation_id corresponds to existing operation

destination node is structurally valid

requested move does not create a cycle
```

Distinguish:

```text
ACL:
    may this caller perform the operation?

service/system invariant:
    is the requested operation internally valid?
```

---

# 25. system-mfs responsibility

`system-mfs` owns the generic filesystem capability:

```text
MFS-specific schema closure

node/tree representation

node creation

folder creation

node lookup

bounded/paginated child listing

rename

hard deletion

same-shard move

tree enumeration

generic recursive tree operations

filesystem invariants

transactional correctness

canonical storage adoption

MFS-specific effective-permission primitives where appropriate
```

It does NOT own:

```text
HTTP

Input

Session

service-level ACL policy

Output

WebSocket routing

Redis socket registry

Finder

transfer-progress UX
```

---

# 26. Filesystem invariant vs access decision

For example:

```text
MOVE
```

ACL decides:

```text
does the trusted uid have required rights on source?

does the trusted uid have required rights on destination?
```

After `GRANTED`, `system-mfs` decides:

```text
does source exist?

does destination exist?

is destination a valid folder?

would this create a cycle?

is this a same-shard operation?

can the local mutation be committed consistently?
```

Do not confuse these concerns.

---

# 27. Stored-procedure-first design

For every Phase 4.8 MFS primitive, classify it as:

```text
A. shard-local database operation

B. cross-shard orchestration

C. physical-storage operation

D. service/runtime concern
```

For category A:

```text
prefer stored procedures/functions
```

owned/versioned with the appropriate capability.

For category B:

```text
JavaScript may coordinate multiple shards
```

while each shard-local mutation remains procedure-driven where practical.

For category C:

```text
use canonical storage abstraction
```

without exposing physical paths.

For category D:

```text
keep it outside system-mfs
```

All stored procedures introduced or migrated under this classification must obey:

```text
ONE STORED PROCEDURE PER FILE
```

without exception.

---

# 28. mfs_create_node is an architectural reference

Historical reference:

```text
common/procedures/mfs/mfs_create_node.sql
```

Its significance is architectural.

Node creation historically centralizes database-local concerns such as:

```text
transaction

nid generation

parent resolution

path computation

filename normalization

unique filename resolution

metadata preparation

media insertion

canonical result
```

inside MariaDB.

Do not blindly copy it.

Extract the minimal generic Phase 4.8 closure while preserving this execution model.

If decomposing surrounding historical SQL, keep `mfs_create_node` or its replacement in its own dedicated SQL file.

---

# 29. Schema classes and mandatory file structure

Audit required SQL objects and classify them as:

```text
common

hub-specific

drumate-specific
```

Suggested structural target:

```text
system-mfs/
└── schemas/
    ├── common/
    │   ├── tables/
    │   ├── functions/
    │   ├── procedures/
    │   └── triggers/
    │
    ├── hub/
    │   ├── tables/
    │   ├── functions/
    │   ├── procedures/
    │   └── triggers/
    │
    └── drumate/
        ├── tables/
        ├── functions/
        ├── procedures/
        └── triggers/
```

Only create directories actually required.

File granularity is mandatory:

```text
one table definition per file
one function per file
one stored procedure per file
one trigger per file
```

For example:

```text
schemas/common/tables/media.sql

schemas/common/functions/mfs_clean_path.sql
schemas/common/functions/user_permission.sql
schemas/common/functions/parent_permission.sql

schemas/common/procedures/mfs_node_attr.sql
schemas/common/procedures/mfs_make_dir.sql
schemas/common/procedures/mfs_create_node.sql
schemas/common/procedures/mfs_show_node_by.sql
```

Forbidden final structure:

```text
schemas/context/001-mfs-core.sql
```

if that file contains several tables/functions/procedures.

The current Phase 4.6 monolithic schema must be decomposed into independently versionable SQL objects.

---

# 30. Schema manifest and dependency order

The schema manifest must list individual SQL objects in deterministic installation order.

For example:

```text
tables
    ↓
functions with no MFS dependencies
    ↓
functions depending on tables/functions
    ↓
procedures
    ↓
triggers
```

Do not rely on accidental filesystem ordering.

Every manifest entry must correspond to one independently auditable SQL source file.

Provisioning must remain idempotent.

---

# 31. Provisioning model

Do NOT recreate the complete historical Factory in `system-mfs`.

The historical Factory owns broader lifecycle concerns:

```text
entity pools

entity allocation

complete database creation

home directory creation

template population

pool_state lifecycle
```

`system-mfs` should own the installation/validation/versioning of its capability SQL into an existing supported shard.

It must be composable into the broader hub/drumate provisioning process.

Do not create a parallel per-principal database.

---

# 32. Historical Factory architecture

Understand this flow:

```text
hub/drumate template
        ↓
entity_create(type)
        ↓
entity descriptor:
    id
    db_name
    home_dir
    ...
        ↓
load schema into assigned db_name
        ↓
create physical storage
        ↓
CALL mfs_create_node(...)
    category=root
        ↓
set yp.entity.home_id
        ↓
mark entity usable
```

Use it to understand the real shard lifecycle.

Do not reproduce the whole daemon.

---

# 33. Review current Phase 4.6 provisioning objects

Audit:

```text
system_mfs_installation
system_mfs_provisioning

organisation_id
principal_id

databaseName(principal_id)

schemas/context/**
```

Keep useful capability-version tracking where appropriate.

Remove or redesign assumptions that imply:

```text
one autonomous database per principal
```

The provisioning state should refer to actual supported shards/capability installation state.

Provide evidence for the final model.

---

# 34. Public/private data boundary

Physical infrastructure information is backend-internal.

Examples:

```text
db_name
db_host
fs_host
home_dir
mfs_root
database credentials
physical storage paths
```

They must NOT be intentional public API fields.

Canonical public MFS identity remains:

```text
{hub_id,nid}
```

---

# 35. Explicit public DTO projection

Do not expose raw procedure rows directly.

Avoid:

```js
return {
  ...sqlRow
}
```

when `sqlRow` contains internal fields.

Prefer explicit projection:

```js
{
  hub_id,
  nid,
  parent_id,
  filename,
  filetype,
  filesize,
  mimetype,
  ctime,
  mtime,
  ...
}
```

Only intentionally public fields belong here.

---

# 36. Output is mandatory

All normal request/response services must return data through:

```text
server-core Output
```

Structured API responses must use the normal sanitizing paths:

```text
output.data()
output.row()
output.rows()
output.list()
output.json()
```

Do not directly emit structured JSON using:

```text
response.write()
response.end()
output.write(JSON.stringify(...))
```

when the normal Output abstraction applies.

---

# 37. sanitize() is the final security barrier

The intended security chain is:

```text
explicit public DTO projection
        ↓
Output
        ↓
sanitize()
        ↓
HTTP response
```

The explicit projection is the normal API contract.

`sanitize()` is the last line of defence in case an internal field accidentally escaped.

Do not deliberately return raw internal structures and rely on `sanitize()` to repair them.

---

# 38. Sensitive-key filter

The existing sanitizer already removes classes of sensitive keys including patterns such as:

```text
mfs_*
db_name
home_dir
*_host
*_db
*_root
sys_*
session_id
password
secret fields
```

Do not weaken this filter.

If new sensitive internal concepts are introduced, such as:

```text
payload_ref
internal staging identifiers
physical storage locators
```

ensure they cannot become public even if their naming does not automatically match the existing filter.

Primary protection remains explicit projection.

---

# 39. WebSocket boundary

HTTP `Output.sanitize()` does NOT protect WebSocket/push messages.

MFS sync must therefore use an explicit recipient-safe public projection before the runtime push transport.

Canonical path:

```text
committed mutation
        ↓
mfs-service
        ↓
affected scopes
        ↓
authorized recipients
        ↓
recipient-safe public event
        ↓
runtime push adapter
        ↓
WebSocket
        ↓
MfsSync
        ↓
Finder
```

Never put:

```text
db_name
home_dir
mfs_root
payload_ref
internal ACL rows
physical storage paths
```

into public mutation events.

---

# 40. Input upload behavior

`server-core/Input` already owns HTTP-level body/multipart streaming.

It may produce temporary request artifacts such as:

```text
uploaded_file
uploaded_id
filename
md5Hash
```

Do not build an unnecessary second HTTP parser inside `mfs-transfer`.

Preferred path:

```text
HTTP bytes
    ↓
Input
    ↓
temporary request artifact
    ↓
mfs-transfer
```

---

# 41. Temporary-file ownership

Define explicit ownership transitions:

```text
Input-owned request tempfile
        ↓
mfs-transfer adopts or copies it
        ↓
transfer-owned staging artifact
        ↓
successful commit
        ↓
system-mfs canonical storage
```

Define cleanup for:

```text
success
failure
cancel
timeout
abandonment
```

Avoid:

```text
double deletion
premature deletion
orphan temporary files
```

---

# 42. payload_ref invariant

`payload_ref` is an internal opaque staged-storage reference.

It must NOT publicly encode:

```text
transfer_id
chunk ids
temporary filesystem path
HTTP upload path
staging implementation details
```

It must NOT appear in:

```text
HTTP API responses
Finder models
MfsClient contracts
MfsSync events
public WebSocket payloads
```

---

# 43. mfs-transfer semantic dependency

Preserve:

```text
mfs-transfer
      ↓
mfs-service
      ↓
system-mfs
```

for semantic MFS commits and authorized manifests.

Do not create a second mutation path:

```text
mfs-transfer
      ↓
system-mfs directly
```

for semantic final mutations.

`mfs-transfer` may manipulate its own temporary bytes.

Final MFS state changes must go through the normal MFS semantic layer.

---

# 44. Transfer access control

Transfer endpoints also participate in normal ACL.

Examples:

```text
upload start
upload chunk
upload status
upload complete
upload abort

download prepare
download status
download cancel
download retrieve
download release
```

A `transfer_id` does NOT itself grant authorization.

The normal pipeline remains:

```text
trusted Session uid
        ↓
ACL
        ↓
GRANTED
        ↓
mfs-transfer
        ↓
transfer-session ownership/state validation
```

---

# 45. Review system-mfs API

Audit the current/proposed API:

```text
listChildren

getNode

makeDirectory

renameNode

removeNode

moveNodes

copyTree

commitFile

enumerateTree

resolveAccess
```

Do not preserve an API merely because it already exists in the working tree.

In particular, reconsider:

```text
resolveAccess
```

If it duplicates the established ACL + `user_permission()` model, remove or narrow it.

`system-mfs` may expose MFS-specific effective-permission primitives required by ACL.

It must not become a second service-level authorization engine.

---

# 46. Removal semantics

Phase 4.8 removal remains:

```text
authorized hard filesystem deletion
```

Do NOT reintroduce:

```text
trash
restore
retention
ack
changelog
```

into the minimal Phase 4.8 MFS closure.

---

# 47. Cross-hub operations

Canonical public source:

```js
{
  hub_id: A,
  nid: X
}
```

Canonical public destination:

```js
{
  hub_id: B,
  nid: Y
}
```

Backend:

```text
resolve A
    ↓
source shard descriptor

resolve B
    ↓
destination shard descriptor
```

Then orchestrate.

Never expose or accept:

```text
source db_name
destination db_name
```

as public MFS contract fields.

---

# 48. Cross-hub authorization

For cross-hub operations, ACL must evaluate the required source and destination permissions using the trusted uid.

Conceptually:

```text
Session.uid()
      │
      ├───────────────┐
      ▼               ▼
source {hub,nid}   destination {hub,nid}
      │               │
      ▼               ▼
resolved shard     resolved shard
      │               │
user_permission   user_permission
      │               │
      └───────┬───────┘
              ▼
         ACL decision
```

Do not authorize cross-hub operations merely because one side is granted.

---

# 49. Finder remains independent

Do not redesign the already validated frontend architecture.

Keep:

```text
Finder
    reusable MFS browsing capability

FinderWindow
    thin Window Manager adapter
```

Finder must not depend on:

```text
FinderWindow
@drumee/window-manager
historical Desk Wm
```

Public identity remains:

```text
{hub_id,nid}
```

---

# 50. Historical frontend/backend snapshots remain pinned

Continue using the Phase 4.8 pinned historical snapshots:

```text
ui-team
17d1d4a03a135c33b44bbb22054fa2d140bbc1a6

server-team
7fb16c449ed09258c501e88e3c87a4d71c51a941
```

Do not update the transient historical snapshots to newer upstream `main`.

Current upstream code may be inspected only where this prompt explicitly uses it as architectural reference.

---

# 51. Repositories authorized for modification

Authorized:

```text
/home/somanos/github/system-mfs
```

You may:

```text
rework provisioning
restructure schemas
split monolithic SQL files
add/remove/adapt MFS SQL
refactor SqlMfsStore
refactor MfsNamespace
remove principal-derived database naming
add resolved-shard support
add procedure-backed MFS operations
rework permission primitives as justified by ownership audit
update manifests
update tests
commit validated changes
```

Also authorized as needed for final integration:

```text
/home/somanos/github/transient
```

You may update:

```text
mfs-service integration
mfs-transfer integration
ACL declarations
adapters
tests
Phase 4.8 closure documentation
```

---

# 52. Protected repositories

Do NOT modify without first reporting a proven blocking architectural defect:

```text
server-core
server-essentials
server-team
ui-team
schemas
server-runtime
ui-runtime
window-manager
```

Do not silently patch them merely to satisfy tests.

---

# 53. Required operation audit

Before modifying code, produce an evidence table for at least:

```text
list
get
mkdir
rename
hard remove
same-hub move
cross-hub copy
upload commit
download manifest/tree enumeration
```

For every operation record:

```text
public operation

public input identity

required ACL source permission

required ACL destination permission

historical procedure/function

target system-mfs procedure/API

shard-local or cross-shard

schema class:
    common
    hub
    drumate

public result fields

internal/sensitive fields
```

Drive implementation from this audit.

---

# 54. Required SQL ownership audit

Classify all required SQL dependencies into:

```text
system-mfs owned

server-core ACL owned

YP/platform owned

external capability dependency

excluded from Phase 4.8
```

Explicitly inspect:

```text
media

permission

user_permission

parent_permission

user_expiry

acl_check

acl_array_check_next

permission_grant

permission_revoke

permission_set

permission_tree

uniqueId

entity

vhost

filecap

disk_usage

path helpers
```

Do not duplicate ownership.

---

# 55. Required SQL file-layout audit

Before committing, inspect every module-owned SQL file under `system-mfs/schemas/**`.

For every `.sql` file, report:

```text
file path

schema class

object type

object name
```

The audit must prove:

```text
exactly one schema object per file
```

and specifically:

```text
exactly one stored procedure per procedure file
```

Fail the closure if any file contains multiple independently defined procedures/functions/tables/triggers.

No grandfather exception is allowed for the Phase 4.6 monolithic schema.

Split it before closure.

---

# 56. Required automated SQL granularity test

Add a test or validation script that scans `system-mfs/schemas/**/*.sql` and fails if a file defines more than one top-level schema object.

At minimum detect multiple occurrences of top-level definitions such as:

```text
CREATE PROCEDURE
CREATE FUNCTION
CREATE TABLE
CREATE TRIGGER
```

after accounting for the corresponding `DROP ... IF EXISTS`.

The validation must enforce the source-level invariant:

```text
one SQL object per file
```

Do not rely solely on code review.

Run this validation in the normal `system-mfs` test suite or pre-publication verification.

---

# 57. Required provisioning tests

Prove at minimum:

```text
system-mfs common schema can be installed/validated on a hub shard

system-mfs common schema can be installed/validated on a drumate shard

class-specific overlays apply only where intended

provisioning is idempotent

missing routines are detected

schema-version incompatibility is detected

no mfs_<principal_id> database is created

the existing entity shard db_name is used internally

physical database information remains private

individual schema files are applied in deterministic dependency order
```

Use disposable MariaDB where appropriate.

---

# 58. Required procedure tests

Test actual stored procedures/functions, not only JS wrappers.

At minimum cover:

```text
user_permission

parent inheritance required by user_permission

node creation

folder creation

node lookup

paginated listing

rename

hard deletion

same-shard move

recursive enumeration

copy building blocks

commitFile/storage-adoption path
```

Test transactional/error cases where meaningful.

Every tested procedure/function must map to its own SQL source file.

---

# 59. Required trusted-identity tests

Prove:

```text
client-provided uid cannot replace Session.uid()

client-provided principal_id cannot become effective caller

unknown/unauthenticated session resolves to canonical anonymous/nobody identity

valid session resolves trusted user from server-side session state

validated MFS token resolves trusted pseudo-identity server-side
```

ACL must consume:

```js
session.uid()
```

not a request uid.

---

# 60. Required shard-resolution tests

Prove:

```text
explicit hub_id
    → correct hub descriptor

no explicit hub_id
    → trusted host/vhost
    → hub_id
    → correct shard descriptor

client-provided db_name is ignored/rejected

client-provided home_dir is ignored/rejected

client-provided mfs_root is ignored/rejected
```

---

# 61. Required ACL tests

Prove end-to-end service authorization:

```text
allowed read
denied read

allowed write
denied write

allowed remove
denied remove

source granted / destination denied

source denied / destination granted

both granted

multi-node ACL

cross-hub source/destination ACL
```

Tests must exercise the normal ACL path.

Direct `system-mfs` tests are not substitutes for service-level ACL tests.

---

# 62. Required permission-resolution tests

Test the effective MFS permission semantics around `user_permission()`.

Cover relevant cases such as:

```text
account-wide permission

explicit node permission

wildcard permission

anonymous/nobody normalization

parent inheritance

no_traversal

zero permission
```

Do not casually alter historical permission semantics.

Any intentional change must be documented and justified.

---

# 63. Required Output/security tests

For representative service responses, deliberately place internal fields in intermediate objects and prove that they do not reach the client.

Test representative values such as:

```text
db_name
home_dir
mfs_root
db_host
fs_host
payload_ref
```

Demonstrate both:

```text
explicit DTO projection excludes them

Output/sanitize remains an effective final barrier
```

---

# 64. Required WebSocket security tests

Create an internal mutation result containing sensitive backend data.

Prove that the public MFS event contains only intended public fields.

Then rerun the real two-client synchronization tests.

---

# 65. Required transfer tests

Preserve the already validated Phase 4.8 transfer coverage:

```text
mixed recursive upload

multiple folders

standalone files

empty folders

chunk resume

progress

cancel

recursive download

multi-root download
```

Additionally prove:

```text
Input tempfile ownership is explicit

temporary files are cleaned after failure/cancel

canonical committed content is not deleted during cleanup

transfer ownership cannot be bypassed

payload_ref never appears publicly
```

---

# 66. Full runtime pipeline

The target architecture is:

```text
                         EXTERNAL
                            │
                            ▼
                          Input
                    normalize ingress
                            │
                            ▼
                         Session
              trusted uid + current hub
                            │
                            ▼
                       ACL declaration
                   required permission
                            │
                            ▼
                           ACL
             resolves source / destination
                            │
                            ▼
              shard.user_permission(...)
                            │
                            ▼
                 effective privilege
                            │
                      privilege & asked
                            │
             ┌──────────────┴──────────────┐
             │                             │
          DENIED                        GRANTED
             │                             │
             ▼                             ▼
         Exception                    service
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                        mfs-service            mfs-transfer
                              │                     │
                              └──────────┬──────────┘
                                         ▼
                                    system-mfs
                                         │
                                         ▼
                                stored procedures
                                         │
                                         ▼
                                    service
                              explicit public DTO
                                         │
                                         ▼
                                      Output
                                         │
                                     sanitize
                                         │
                                         ▼
                                      EXTERNAL
```

Preserve these boundaries.

---

# 67. Canonical sync path

MFS synchronization remains:

```text
system-mfs committed mutation
        ↓
mfs-service
        ↓
affected scopes
        ↓
authorized recipients
        ↓
recipient-safe public projection
        ↓
runtime push transport
        ↓
WebSocket
        ↓
MfsSync
        ↓
Finder
```

No sensitive physical/internal fields may escape.

---

# 68. Final regression

After correcting `system-mfs`:

1. Commit the corrected `system-mfs`.
2. Record the exact commit hash.
3. Ensure the repository is clean.
4. Run the SQL file-granularity validation from that exact committed HEAD.
5. Run all `system-mfs` tests from that exact committed HEAD.
6. Run disposable MariaDB integration from that exact HEAD.
7. Reconcile `transient` integration against that exact HEAD.
8. Run the complete Phase 4.8 test suite.
9. Run real Chromium Finder + Window Manager.
10. Run real two-client WebSocket synchronization.
11. Run Phase 4.7 regression against the standalone published packages.
12. Ensure both repositories are clean.

Do NOT close Phase 4.8 from an uncommitted `system-mfs` working tree.

---

# 69. Git authorization

You ARE authorized to commit the corrected `system-mfs` implementation.

Prefer auditable logical commits, for example:

```text
realign system-mfs shard provisioning

split system-mfs SQL objects by file

extract procedure-driven MFS schema

restore MFS permission primitives

adapt store to resolved shards

validate Phase 4.8 system-mfs architecture
```

Use the split that best matches the actual changes.

Do not rewrite existing history.

After `system-mfs` is canonical, a final narrowly scoped `transient` integration/closure commit is authorized.

---

# 70. No npm publication

Do NOT:

```text
npm publish

promote @drumee/system-mfs version

publish Finder

publish mfs-service

publish mfs-transfer
```

unless separately authorized.

The package may remain:

```text
@drumee/system-mfs@0.1.0-alpha.1
```

while the Git baseline advances.

---

# 71. No Phase 4.9

Do NOT start:

```text
Finder standalone extraction

advanced selection modifiers

row/simple-view stabilization

advanced contextual menus

undo

new Finder package

Finder publication
```

Those belong to Phase 4.9 or later.

---

# 72. Closure documentation

Update:

```text
docs/refactoring/26-phase4.8-finder-integration.md
```

to record:

```text
final system-mfs architecture

new canonical system-mfs HEAD

SQL ownership map

SQL file-granularity invariant

common/hub/drumate schema model

trusted uid chain

hub/shard resolution chain

user_permission authorization model

ACL ownership boundary

Input responsibility

Session responsibility

mfs-service responsibility

mfs-transfer responsibility

system-mfs responsibility

Output/sanitize boundary

final tests

final transient HEAD
```

---

# 73. Phase 4.8 closure conditions

Phase 4.8 may be declared:

```text
CLOSED / VALIDATED
```

only when all of the following are true:

```text
Finder remains validated

FinderWindow boundary remains intact

public MFS identity remains {hub_id,nid}

trusted uid comes exclusively from Session

client uid/principal cannot override Session.uid()

hub_id resolves through trusted hub/entity directory

host/vhost fallback works when hub_id is absent

no principal-derived MFS database naming remains

db_name remains internal

system-mfs integrates with actual hub/drumate shards

common/hub/drumate schema layering is explicit

complex shard-local operations are procedure-driven

EVERY STORED PROCEDURE HAS ITS OWN SQL FILE

every function/table/trigger also has its own SQL file

no monolithic multi-object SQL source remains in system-mfs

SQL dependency order is explicit in the manifest

automated SQL granularity validation passes

user_permission semantics are preserved

ACL remains the final service-level GRANTED/DENIED authority

mfs-service does not implement a competing ACL engine

system-mfs does not decide service-required permission

permission-related SQL ownership has no duplicate authoritative copies

Input remains the canonical ingress normalizer

all normal HTTP service responses use Output

structured responses pass through sanitization

sanitize remains the final HTTP safety barrier

public DTOs explicitly exclude sensitive infrastructure fields

WebSocket events explicitly exclude sensitive infrastructure fields

temporary upload ownership is deterministic

payload_ref remains private

system-mfs changes are committed

system-mfs tests pass from the committed HEAD

MariaDB tests pass from the committed HEAD

Phase 4.8 integration passes against that exact HEAD

Chromium integration passes

two-client WebSocket integration passes

Phase 4.7 regression passes

system-mfs working tree is clean

transient working tree is clean

no npm publication occurred

Phase 4.9 has not started
```

---

# 74. Final report

When finished, return a concise but complete report containing:

```text
1. Architecture findings

2. SQL ownership map

3. SQL file/object map

4. Confirmation that every stored procedure is in its own file

5. Permission/ACL ownership map

6. Provisioning changes

7. Shard-resolution implementation

8. Trusted-uid implementation

9. user_permission integration

10. Input integration

11. Output/security integration

12. mfs-service changes

13. mfs-transfer changes

14. system-mfs API changes

15. Removed/replaced Phase 4.6 assumptions

16. system-mfs commits

17. final system-mfs HEAD

18. transient closure/integration commit

19. final transient HEAD

20. exact test commands and results

21. SQL granularity validation result

22. working-tree status

23. explicit confirmation:
       no npm publication
       no Phase 4.9
```

If a required correction would force a modification in a protected repository:

```text
server-core
server-essentials
schemas
server-team
ui-team
server-runtime
ui-runtime
window-manager
```

do not silently modify it.

Report instead:

```text
observed evidence

affected component

why the existing contract blocks Phase 4.8

smallest proposed correction

tests required to validate it
```

Otherwise proceed through the complete audit, implementation, tests, commits and canonical Phase 4.8 closure.
