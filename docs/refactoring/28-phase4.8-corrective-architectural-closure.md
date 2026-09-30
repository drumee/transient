# Phase 4.8 — Corrective architectural closure
## ACL, bounded lifecycle, download pipeline, host-filesystem abstraction and media representations

Phase 4.8 is functionally complete, but GitHub verification exposed several architectural inconsistencies and missing invariants in the current closure.

This task is a **narrow corrective pass**.

Do NOT restart Phase 4.8.

Do NOT redesign Finder.

Do NOT start Phase 4.9.

Do NOT publish any npm package.

Do NOT redesign the generic lifecycle `stop()` mechanism during this pass.

The objective is to align the implementation and documentation with the historical Drumee architecture while preserving the minimal-kernel refactor boundaries.

---

# 1. Current canonical baselines

## transient

Repository:

```text
/home/somanos/github/transient
```

Branch:

```text
refactor/mapping
```

Current remote HEAD before this correction:

```text
6fc5a270c7b40679433287e636253f6f8a8e7bd9
```

Relevant commits:

```text
95b142a400c009cec4b65553f148151d6b412fa9
    refactor(mfs): align Phase 4.8 runtime boundaries

410a16fb646b8dd81d778c3d7c61db9df0970cdb
    docs(refactor): close canonical Phase 4.8

6fc5a270c7b40679433287e636253f6f8a8e7bd9
    docs(refactor): record Phase 4.7 package regression
```

## system-mfs

Repository:

```text
/home/somanos/github/system-mfs
```

Branch:

```text
main
```

Current remote HEAD:

```text
a7f7395bdbc79560aed072219b87c0b81c004bce
```

Relevant commits:

```text
ee44cd205e1ce1ac1f5f4cb9f56053bda0b17b8d
    realign system-mfs with resolved shards

a7f7395bdbc79560aed072219b87c0b81c004bce
    test system-mfs permission inheritance
```

`system-mfs` is not the primary problem in this corrective pass.

Do not modify it unless the corrective work exposes a proven blocking defect.

---

# 2. Core Drumee architectural principles

All implementation decisions MUST follow these principles in this order:

```text
1. SECURITY FIRST
2. RESOURCE LIFETIME MUST BE EXPLICIT AND BOUNDED
3. PERFORMANCE AS BEST EFFORT
4. GRANULAR WHEN POSSIBLE
```

Decision order:

```text
security
    ↓
correctness / transactional integrity / bounded resource lifetime
    ↓
performance
    ↓
granularity / maintainability
    ↓
convenience
```

Historical Drumee code must not be copied blindly.

However, when the historical implementation clearly encodes one of these principles, preserve the architectural intent unless there is strong evidence for a better implementation.

---

# 3. Security first

Security always takes precedence over convenience, compatibility shortcuts or optimization.

Required invariants include:

```text
trusted identity comes from Session

authorization happens before service execution

client-provided uid/principal is never authoritative

physical shard or filesystem information is never public request identity

every required source and destination is checked

transfer ids are not authorization credentials

public DTO projection is explicit

structured HTTP output passes through Output/sanitize

WebSocket events use recipient-safe projections

download retrieval is authorized before file delivery

media representation generation happens only after authorization
```

Fail closed whenever authorization context is missing or ambiguous.

---

# 4. Resource lifetime must be explicit and bounded

Long-lived Node.js processes must not rely solely on garbage collection to eventually recover request/service state.

Every resource should have:

```text
an owner
a bounded lifetime
an explicit release/stop/cleanup path
```

Examples:

```text
request/session objects
    → stop / cleanup

database connections
    → end / release

timers
    → clearTimeout / clearInterval

subscriptions/listeners
    → unsubscribe / off / stopListening where applicable

streams/sockets
    → close / destroy / abort

uploads
    → deterministic tempfile ownership

transfers
    → explicit job lifecycle + expiry + cleanup

download archives
    → filesystem artifact + explicit release

conversion workers
    → finite worker lifecycle

collections/caches
    → bounded size or TTL
```

Avoid process-local structures that can grow indefinitely.

---

# 5. Preserve the historical stop() safeguard

Historical reference:

```text
https://github.com/drumee/server-essentials/blob/main/lib/logger.js
```

The existing generic lifecycle mechanism:

```js
stop()
```

uses:

```text
_stopping
isPersistent
delayed cleanup
clear()
child stop()
child clear()
reference nulling
```

to defensively disconnect request/service object graphs after a grace period.

This mechanism is intentional and MUST be preserved.

It is a last-resort lifecycle safety net.

Do NOT redesign, remove or simplify it during this Phase 4.8 corrective pass.

Do NOT attempt to replace it with implicit garbage collection.

A dedicated review of this lifecycle mechanism belongs to a later `server-runtime` review.

Record this future review item explicitly.

For this task:

```text
PRESERVE stop() SEMANTICS.
DO NOT MODIFY THE GENERIC stop() SAFEGUARD.
```

Individual components must still correctly close their own external resources before relying on the generic cleanup.

Examples:

```text
db.end()
stream.destroy()
worker.kill()
timer clear
subscription unsubscribe
then generic stop()
```

---

# 6. Performance as best effort

After security, correctness and bounded lifecycle are satisfied, prefer designs minimizing:

```text
CPU
memory
I/O
copies
blocking work
large process-local state
```

Performance is part of architecture, not only a later optimization pass.

Prefer:

```text
stored procedures for complex shard-local operations

set-based SQL

bounded queries

pagination

bounded concurrency

filesystem references/symlinks instead of copies

offline workers for expensive work

specialized external tools for conversion/archive generation

Nginx X-Accel-Redirect for heavy file delivery

resumable transfers

recipient-filtered push events
```

Avoid:

```text
large Buffers

whole ZIP archives in Node heap

whole-file buffering where filesystem handoff is possible

unbounded Maps/Sets

blocking archive generation in request processes

unnecessary filesystem copies

duplicated SQL algorithms in JavaScript
```

When two secure and correct solutions exist, prefer the one that performs less work and moves less data.

---

# 7. Granular when possible

Prefer meaningful component boundaries.

Examples:

```text
one SQL object per file

one stored procedure per file

ACL policy separate from effective-permission calculation

download preparation separate from download delivery

logical MFS separate from host filesystem access

representation generation separate from delivery

Finder separate from FinderWindow

mfs-service separate from mfs-transfer

archive worker separate from HTTP worker

internal SQL result separate from public DTO
```

Do not fragment naturally atomic operations merely for stylistic granularity.

A shard-local transactional mutation should remain one coherent stored procedure when appropriate.

---

# 8. Authoritative historical references

Inspect current implementations before modifying code.

## Request / Session / ACL / Output

```text
drumee/server-core/lib/input.js
drumee/server-core/lib/session.js
drumee/server-core/lib/acl.js
drumee/server-core/lib/output.js
```

## File delivery

```text
drumee/server-core/lib/file-io.js
```

## Logical MFS → host filesystem abstraction

```text
drumee/server-core/lib/utils/mfs.js
```

## Derived representation generators

```text
drumee/server-core/lib/utils/generator.js
drumee/server-core/lib/utils/document.js
```

## Historical media service

```text
drumee/server-team/service/media.js
```

Pinned historical Phase 4.8 reference:

```text
server-team
7fb16c449ed09258c501e88e3c87a4d71c51a941
```

## Historical long-form video service

```text
drumee/server-team/service/video.js
```

## Historical offline download worker

```text
drumee/server-team/offline/media/download.js
```

## SQL permission resolution

```text
drumee/schemas/common/procedures/acl/acl_check.sql
drumee/schemas/common/procedures/acl/acl_array_check_next.sql
drumee/schemas/common/procedures/mfs/user-permission.sql
drumee/schemas/common/procedures/mfs/parent-permission.sql
```

Understand the architecture, not only the syntax.

---

# 9. ACL defect found during Phase 4.8 verification

Current code:

```text
target/modules/mfs-service/lib/acl.js
```

contains:

```text
MfsAclAuthorizer
```

It currently:

```text
reads service-required permission

resolves src/dest resources

calls effectivePermission(uid,node)

compares privilege & asked

returns granted=true/false
```

The current integration test:

```text
tests/integration/kernel/phase4.8-backend-dispatch.test.js
```

injects it directly into:

```js
new ServiceDispatcher({
  authorize: authorizer.authorize.bind(authorizer)
})
```

Therefore the currently tested path is:

```text
ServiceDispatcher
      ↓
MfsAclAuthorizer
      ↓
system-mfs.effectivePermission()
      ↓
shard.user_permission()
      ↓
GRANTED / DENIED
```

This puts the final service-level authorization authority inside the MFS integration layer.

That must be corrected.

---

# 10. Canonical authorization ownership

Correct responsibility split:

```text
Input
    normalize untrusted request

Session
    establish trusted uid + trusted current hub

service ACL descriptor
    declare required permission

runtime ACL
    resolve/check required resources
    obtain effective privileges
    make final GRANTED / DENIED decision

system-mfs
    provide MFS-specific effective privilege primitive

mfs-service
    execute semantic operation only after GRANTED
```

Short form:

```text
ACL descriptor
    says WHAT IS REQUIRED

user_permission()
    calculates WHAT THE USER HAS

runtime ACL
    compares REQUIRED vs HAS

mfs-service
    executes after GRANTED
```

---

# 11. Trusted uid invariant

The authoritative caller identity is:

```js
session.uid()
```

Never derive effective identity from:

```text
input.uid
input.principal_id
input.owner_id
input.user_id
```

A client cannot replace `Session.uid()`.

Nobody and validated token identities remain server-resolved identities.

---

# 12. MFS effective-permission primitive

The canonical MFS privilege primitive remains:

```sql
user_permission(uid, nid)
```

inside the resolved shard.

Conceptually:

```text
trusted Session.uid()
        +
{hub_id,nid}
        ↓
resolve shard
        ↓
shard.user_permission(uid,nid)
        ↓
effective privilege
```

`user_permission()` does NOT choose required service policy.

---

# 13. Service permission descriptors remain authoritative

Examples:

```text
mfs.list
    src read

mfs.get
    src read

mfs.mkdir
    dest write

mfs.rename
    src delete

mfs.remove
    src delete

mfs.move
    every src delete
    dest write

mfs.copy
    every src read
    dest write
```

Media representation and transfer services also use descriptor-driven policy.

Do not hard-code a universal media permission.

---

# 14. Correct runtime authorization flow

Target:

```text
DescriptorRegistry
      ↓
resolved service descriptor
      ↓
runtime authorizer
      │
      ├── trusted Session.uid()
      ├── required permission
      ├── src/dest resource normalization
      └── MFS privilege backend/provider
                    ↓
          system-mfs.effectivePermission()
                    ↓
          shard.user_permission()
      │
      ▼
GRANTED / DENIED
      ↓
ServiceDispatcher
      ↓
worker
      ↓
mfs-service / mfs-transfer / media representation service
```

Workers MUST NOT execute before authorization.

---

# 15. Runtime authorizer extension

The current minimal runtime handles primarily:

```text
public-api
domain
```

Extend it so MFS authorization can be delegated through an injected backend/provider.

Conceptually:

```js
createAuthorizer({
  domainAuthorizer,
  mfsAuthorizer
})
```

Then:

```text
public-api
    → fast path

scope=domain
    → domainAuthorizer

scope=mfs
    → MFS authorization backend
```

The final authorization invocation remains owned by the runtime authorizer used by `ServiceDispatcher`.

---

# 16. Avoid hard coupling

Generic runtime code MUST NOT import `system-mfs` directly.

Use dependency injection:

```text
server-runtime
      ↓
generic MFS authorization contract
      ↓
MFS backend/provider
      ↓
system-mfs.effectivePermission()
```

Runtime knows the authorization capability.

It does not know MariaDB MFS internals.

---

# 17. Correct MfsAclAuthorizer responsibility

Audit:

```text
target/modules/mfs-service/lib/acl.js
```

The current class MUST NOT remain an independent service authorization policy engine.

Preferred correction:

```text
runtime ACL
    owns final decision

MFS ACL adapter/backend
    resolves MFS resources
    obtains effective privilege
```

It may retain compatibility naming temporarily if necessary, but responsibility must be clear.

Prefer a clearer name where practical, for example:

```text
MfsPermissionBackend
MfsAclBackend
MfsPermissionProvider
```

Do not duplicate policy.

---

# 18. Every source and destination must be checked

Fail closed.

For MOVE:

```text
every source → DELETE
destination → WRITE
```

For COPY:

```text
every source → READ
destination → WRITE
```

For DOWNLOAD:

```text
every requested root → READ
```

Cross-hub checks are independent.

---

# 19. Preserve permission bit semantics

Unless proven otherwise by existing Drumee ACL:

```js
(effective & asked) === asked
```

must hold.

Do not weaken compound permission requirements.

---

# 20. No duplicate ACL in mfs-service

After correction:

```text
runtime ACL
    ↓
GRANTED
    ↓
mfs-service
```

`mfs-service` may still validate filesystem/semantic integrity:

```text
valid node
valid destination
folder destination
no cycle
valid operation state
```

Those are not access-control policy.

---

# 21. Physical storage access must be abstracted

Historical reference:

```text
drumee/server-core/lib/utils/mfs.js
```

Business/service code MUST NOT manipulate MFS physical paths directly.

Logical MFS identities are resolved to physical storage only through the designated host-filesystem abstraction.

That abstraction owns concerns such as:

```text
path conventions

canonical content locations

derived representation locations

filesystem safety checks

cross-filesystem move fallback

physical copy/move/remove primitives

filesystem walking

content hashing
```

Historical primitives include:

```text
get_node_content()
get_base()
check_base()
check_safety()

move_node()
copy_node()
remove_node()

move_item()
remove_item()

mkdir()
cp()
mv()

walkDir()
get_md5Hash()
```

Do not scatter code equivalent to:

```js
path.join(home_dir, "__storage__", nid, ...)
```

through service implementations.

The physical storage convention must remain behind one abstraction boundary.

Physical paths are internal.

---

# 22. system-mfs remains logical, not host-filesystem specific

`system-mfs` remains responsible for:

```text
{hub_id,nid}

tree / parentage

MFS permissions

logical node metadata

transactional mutations

resolved shard semantics

canonical content identity
```

It MUST NOT directly own:

```text
ffmpeg

GraphicsMagick/ImageMagick

LibreOffice/soffice

pdfinfo

X-Accel-Redirect

temporary conversion directories

HLS process orchestration
```

Do not move historical `utils/mfs.js`, `Generator`, document conversion or `FileIo` semantics into SQL.

---

# 23. Representation generation is a separate capability

Historical generators:

```text
drumee/server-core/lib/utils/generator.js
drumee/server-core/lib/utils/document.js
```

They produce derived filesystem artifacts.

Examples include:

```text
IMAGE
    vignette
    thumb
    preview
    card
    slide
    webp
    theme

AUDIO
    derived images
    MP3 stream representation

VIDEO
    card
    thumb
    vignette
    stream
    HLS
    segments
    OGV

DOCUMENT
    PDF conversion
    PDF metadata
    preview/slide/thumb/card
    indexing support
```

Generation and delivery are different responsibilities.

Canonical chain:

```text
authorized logical node
    ↓
host-filesystem abstraction
    ↓
Generator / Document conversion
    ↓
filesystem artifact
    ↓
FileIo
    ↓
Nginx
```

---

# 24. Generator selection is server-owned

Historically, FileIo uses a convention equivalent to:

```js
const func_name = `create_${filetype}_${format}`;
const generator = Generator[func_name];
```

This convention may be preserved or refactored.

But generator selection MUST remain internal and whitelist-based.

Never expose:

```text
?generator=create_anything

?path=/internal/storage/...

?format=<arbitrary executable backend name>
```

The client chooses a known public service.

The server maps that service to an internal representation.

---

# 25. The public service defines the requested representation

Historical examples:

```text
media.orig

media.preview
media.thumb
media.vignette
media.card
media.slide

media.audio
media.video
media.ogv

media.stylesheet
media.script

video.master
video.stream
video.segment
```

The service name is the public representation contract.

The server-side handler maps service → internal format.

This mapping is part of the security boundary.

---

# 26. media.orig invariant

This is a strict architectural invariant:

```text
media.orig ALWAYS returns the original stored file.
```

It MUST NOT:

```text
auto-convert a document to PDF

replace a video with a stream representation

replace an image with a preview

return a cached derivative instead of the original
```

Canonical flow:

```text
media.orig
    ↓
runtime ACL
    ↓
canonical MFS original
    ↓
host-filesystem abstraction
    ↓
FileIo
    ↓
X-Accel-Redirect
    ↓
Nginx
```

Even for an Office document:

```text
media.orig
    → original .doc/.docx/.odt/... content
```

not the PDF derivative.

All transformations belong to explicit derived representation services.

---

# 27. Derived media representation invariant

A Drumee MFS node may expose several derived representations.

Examples:

```text
thumbnail
vignette
card
preview
slide

converted document representation

audio stream

video stream

HLS master playlist

HLS stream playlist

HLS segment
```

Canonical flow:

```text
public representation service
    ↓
runtime ACL
    ↓
authorized MFS node
    ↓
service → internal format mapping
    ↓
host-filesystem abstraction
    ↓
existing derived artifact?
    ├─ yes → reuse
    └─ no  → supported generator/converter
                 ↓
             artifact on disk
    ↓
FileIo / representation handler
    ↓
Nginx or small control-plane response
```

Generation should be idempotent where possible.

Re-use an existing valid representation instead of regenerating it.

---

# 28. Image preview behavior

Finder/media UI should not fetch full original images merely to render thumbnails.

Preferred path:

```text
media.preview / media.thumb / ...
    ↓
authorized node
    ↓
cached derived image
       OR
server-side generation
    ↓
small derived filesystem artifact
    ↓
FileIo
    ↓
Nginx
```

This preserves both performance and bounded request memory.

---

# 29. Document conversion behavior

Documents may expose derived representations suitable for:

```text
preview
slide
thumbnail
PDF-derived display
document reader
```

Conversion belongs to the representation layer, not Finder and not `system-mfs`.

Historical document utilities also demonstrate detached/background processing:

```text
offline/media/to-pdf.js
offline/media/seo.js
```

Preserve the architectural principle:

```text
expensive conversion work should not block the normal HTTP service process
```

where practical.

---

# 30. Long-form video architecture

Historical reference:

```text
drumee/server-team/service/video.js
```

Long-form video uses on-demand HLS generation.

A request for:

```text
video.master
```

checks for:

```text
<mfs-root>/<nid>/master.m3u8
```

If the HLS representation does not exist, the service:

```text
Generator.create_hls_args(node)
    ↓
spawn detached/low-priority ffmpeg
    ↓
HLS artifacts progressively materialize
```

Do NOT require the full conversion to complete before playback begins when progressive HLS generation allows playback to start earlier.

This is an intentional performance-first architecture.

---

# 31. Video URL normalization belongs to Input

Historical reference:

```text
drumee/server-core/lib/input.js
```

The `/vdo/` URL namespace is normalized by Input.

Input maps logical paths to:

```text
video.master
video.stream
video.segment
```

and normalized logical parameters such as:

```text
nid
hub_id
serial
segment
```

Physical paths remain internal.

The client requests a logical video resource.

Input converts it to a canonical service invocation.

---

# 32. HLS control plane vs media data plane

Do NOT apply the "Nginx sends bytes" rule mechanically to every small media-related artifact.

HLS playlists are control-plane artifacts.

They may be read and rewritten by Node when application logic is required, for example to append authorization information such as `keysel` to segment URLs.

Therefore:

```text
.m3u8 master/playlist
    → small control artifact
    → Node processing is acceptable when required
```

Large media payloads remain data-plane artifacts:

```text
.ts segment
    → FileIo
    → X-Accel-Redirect
    → Nginx

original large video/audio
    → FileIo
    → X-Accel-Redirect
    → Nginx
```

General rule:

```text
Node MAY process small control artifacts when application-level
transformation is required.

Node MUST NOT become the normal byte-transfer data plane for large
media or downloadable content.
```

---

# 33. Download architecture defect

Current Phase 4.8 `mfs-transfer` approximately does:

```text
manifest
    ↓
read every file into Buffer
    ↓
build archive in memory
    ↓
store Buffer in job.archive
    ↓
downloadRetrieve()
    ↓
Output.write(Buffer)
```

This violates Drumee's historical performance-first architecture.

It must be corrected.

---

# 34. Historical download architecture

Reference:

```text
drumee/server-team/offline/media/download.js
```

The historical architecture separates:

```text
ARCHIVE PREPARATION

from

HTTP FILE DELIVERY
```

Archive preparation:

```text
authorized nodes
    ↓
offline worker
    ↓
resolve per-hub manifests
    ↓
filesystem staging
    ↓
symlinks to canonical content
    ↓
external archive program
    ↓
physical ZIP on disk
    ↓
progress through Redis/socket/runtime push
```

File delivery:

```text
authorized retrieval request
    ↓
resolve prepared archive
    ↓
FileIo
    ↓
X-Accel-Redirect
    ↓
Nginx
    ↓
client
```

The offline worker NEVER sends the archive bytes to the HTTP client.

---

# 35. Nginx delivery invariant

Historical reference:

```text
drumee/server-core/lib/file-io.js
```

Drumee delegates physical heavy file transfer to Nginx.

`FileIo` prepares headers such as:

```text
X-Accel-Redirect
Content-Disposition
Content-Length
Content-Type
Accept-Ranges
Cache-Control
```

Then Nginx sends the bytes.

Node.js MUST NOT be the normal data plane for downloadable files.

---

# 36. Canonical direct-file download

For a single already-existing canonical file:

```text
Input
    ↓
Session
    ↓
runtime ACL
    ↓
GRANTED
    ↓
resolve canonical file
    ↓
host-filesystem abstraction
    ↓
FileIo
    ↓
X-Accel-Redirect
    ↓
Nginx
    ↓
client
```

Do not copy or buffer the file unnecessarily.

---

# 37. Canonical archive download

For multi-file/folder download:

```text
PREPARE

Input
    ↓
Session
    ↓
runtime ACL
    ↓
GRANTED
    ↓
mfs-service authorized manifest
    ↓
mfs-transfer creates download job
    ↓
offline archive worker
    ↓
filesystem/symlink staging
    ↓
external archive process
    ↓
ZIP physically stored
    ↓
progress / ready event
```

Then:

```text
RETRIEVE

Input
    ↓
Session
    ↓
runtime ACL
    ↓
transfer ownership/state validation
    ↓
resolve completed archive
    ↓
FileIo
    ↓
X-Accel-Redirect
    ↓
Nginx
    ↓
client
```

---

# 38. Download preparation and delivery must be separate

`mfs-transfer` owns:

```text
download job identity

authorized roots

archive preparation state

progress

cancellation

worker lifecycle

archive reference/path

expiry

release/cleanup
```

`mfs-transfer` does NOT own:

```text
HTTP byte streaming

whole-file buffering for delivery

whole-ZIP buffering

response.write of archive bytes
```

---

# 39. Eliminate whole-archive Node buffering

Remove architecture equivalent to:

```js
job.archive = zip(entries)
```

when it produces the complete downloadable ZIP in Node memory.

Remove:

```js
return {
  data: job.archive
}
```

from the normal download retrieval path.

The final archive should exist as a filesystem artifact suitable for `FileIo` / Nginx delivery.

---

# 40. Eliminate per-file buffering during archive preparation

Avoid:

```js
const data = await content_reader(...);
entries.push({ data });
```

for potentially large download trees.

Prefer:

```text
canonical filesystem source
    ↓
symlink/reference inside archive staging tree
```

where compatible with the storage architecture.

Then let the archive tool work from the filesystem.

Do not copy bytes unnecessarily.

---

# 41. Offline archive worker

Large/non-trivial archive generation MUST be executable outside the HTTP request process.

Use the historical pattern as architecture reference:

```text
short HTTP service interaction
        ↓
spawn / worker
        ↓
finite archive job
        ↓
physical result
```

The implementation may be modernized, but preserve:

```text
process isolation

bounded request memory

non-blocking HTTP process

filesystem-based archive generation

explicit worker completion/failure
```

---

# 42. Archive tool

Prefer existing Drumee archive tooling where compatible.

Do not introduce an in-memory JavaScript ZIP implementation as the main production path.

External specialized archive tooling is intentional performance architecture.

---

# 43. Download progress

Archive preparation progress remains requester-scoped.

Historical implementation uses Redis/socket delivery.

The refactor may use the runtime push abstraction, but preserve:

```text
only the intended requester receives transfer progress

MFS mutation synchronization is separate from transfer progress
```

Progress must not leak backend paths.

---

# 44. Download cancellation

Cancellation must terminate or signal the active archive worker where possible.

Then clean:

```text
temporary staging tree
symlinks
partial archive
worker handle
job state
```

Cancellation must have bounded cleanup.

---

# 45. Download release and expiry

A prepared archive cannot remain forever.

Define deterministic cleanup for:

```text
explicit release
successful retrieval lifecycle
cancellation
failure
timeout
stale abandoned job
process restart where practical
```

Do not use an unbounded process-local `Map` as the only authority for artifact lifetime.

If in-memory indexing remains for performance, it must be bounded and recoverable or backed by inspectable filesystem/job state.

---

# 46. Transfer authorization

`transfer_id` is not authorization.

Every transfer endpoint must enter through runtime ACL.

For persistent operations, resolve:

```text
transfer_id
    ↓
original authorized MFS resources
```

so runtime ACL can re-evaluate required resources where appropriate.

Then additionally validate:

```text
transfer owner == Session.uid()
job state is valid
```

ACL and transfer ownership are complementary.

---

# 47. File delivery security

Physical archive/content paths remain private.

Never expose publicly:

```text
absolute archive path
home_dir
mfs_root
db_name
fs_host
storage_ref
payload_ref
```

The client receives only logical transfer/media metadata.

---

# 48. Output boundary for heavy downloads/media

Structured responses still use:

```text
session.output.data(...)
```

But downloadable heavy content follows:

```text
FileIo
    ↓
Output.head(...)
    ↓
X-Accel-Redirect
    ↓
Nginx
```

Do NOT use:

```text
output.write(largeBuffer)
```

for normal heavy content delivery.

Exception:

```text
small control-plane artifacts requiring application-level rewriting,
such as HLS playlists
```

may legitimately use Node output.

---

# 49. Preserve upload architecture

Do not unnecessarily redesign upload during this corrective pass.

Keep validated invariants:

```text
Input owns initial upload tempfile

ownership transfers exactly once

mfs-transfer owns staging/chunks/resume

semantic commit goes through mfs-service

system-mfs adopts canonical content

payload_ref stays private

failure/cancel cleanup is deterministic
```

Only change upload ACL wiring if needed for runtime authorization correction.

---

# 50. system-mfs remains procedure-first

Do not regress:

```text
complex shard-local operation
    ↓
stored procedure/function
```

Keep:

```text
one SQL object per file
one stored procedure per file
one function per file
one table definition per file
```

No SQL rewrite is expected for this task.

---

# 51. Required runtime ACL tests

Test the generic runtime authorizer:

```text
public-api still works

domain still works

mfs scope delegates correctly

missing MFS backend fails closed

unsupported scope fails closed
```

---

# 52. Replace the current backend-dispatch test path

Update:

```text
tests/integration/kernel/phase4.8-backend-dispatch.test.js
```

Do NOT inject the complete MFS authorizer directly as:

```js
authorize: MfsAclAuthorizer.authorize.bind(...)
```

Instead exercise:

```text
DescriptorRegistry
    ↓
createAuthorizer(...)
    ↓
MFS authorization backend/provider
    ↓
effectivePermission()
    ↓
ServiceDispatcher
```

Prove the production architecture.

---

# 53. Required MFS ACL cases

Test:

```text
Session.uid() used

client uid ignored

client principal_id ignored

read grant/deny

write grant/deny

delete grant/deny

every source checked

destination checked

cross-hub checks independent

missing identity denied

missing backend denied
```

---

# 54. Worker execution boundary test

Prove:

```text
DENIED
    → worker never invoked

GRANTED
    → worker invoked exactly once
```

This is mandatory.

---

# 55. Transfer ACL tests

Test at least:

```text
upload_start

one persistent upload operation

download_prepare

download_retrieve

one persistent download status/cancel/release operation
```

through the runtime ACL path.

---

# 56. Host-filesystem abstraction tests

Add/adjust tests proving:

```text
logical node → physical path resolution occurs through one abstraction

physical paths are not returned in public DTOs

canonical original and derived representations resolve predictably

cross-filesystem move fallback remains correct where supported

safety-lock protections are not bypassed
```

Do not expose host paths through the browser/API.

---

# 57. media.orig regression test

Add a strict regression proving:

```text
media.orig returns the original stored file
```

for at least:

```text
image
document
video
```

For a non-PDF Office document, prove:

```text
media.orig → original Office file
```

not a generated PDF.

For video, prove:

```text
media.orig → original video file
```

not HLS or MP4 stream derivative.

---

# 58. Derived representation tests

At minimum verify architecture for:

```text
image preview/thumb

document-derived representation

video representation
```

Prove:

```text
known service → known internal representation

unknown/arbitrary generator cannot be selected by client

existing derivative is reused when valid

generated derivative becomes a filesystem artifact

heavy artifact delivery delegates to FileIo/Nginx
```

Do not require reimplementation of every historical converter if some are explicitly deferred.

But the architecture must remain compatible with them.

---

# 59. Long-form HLS tests

Verify:

```text
Input /vdo/ route normalization

video.master service selection

video.stream service selection

video.segment service selection

nid/hub_id/serial/segment normalization
```

For `video.master`:

```text
existing master playlist → reused

missing master playlist → detached/low-priority ffmpeg path starts

request does not require full conversion to finish before first usable control artifact
```

For HLS playlists:

```text
small playlist may be processed by Node

required authorization query information can be injected safely
```

For `.ts` segments:

```text
FileIo / X-Accel-Redirect / Nginx path
```

No segment Buffer streaming through Node.

---

# 60. Download preparation tests

Replace in-memory ZIP assumptions.

Test:

```text
download_prepare creates a job

authorized manifest reaches archive preparation

filesystem staging is created

canonical content is referenced without unnecessary Buffer copies

archive process produces a real archive file

progress is emitted

ready state is emitted

internal archive path is not public
```

---

# 61. Download retrieval tests

Do NOT test:

```text
downloadRetrieve() → Buffer
```

Instead test:

```text
runtime ACL GRANTED

transfer owner valid

archive ready

FileIo invoked

X-Accel-Redirect set

Content-Disposition set

Content-Type application/zip

Content-Length correct

Node does not return/write archive Buffer
```

---

# 62. Real Nginx integration test

Where the existing Phase 4.8 kernel test environment includes Nginx, add or adapt a real integration test.

Prove:

```text
archive prepared on disk
    ↓
HTTP retrieval request
    ↓
ACL passes
    ↓
FileIo emits internal redirect
    ↓
Nginx resolves file
    ↓
client receives actual ZIP bytes
```

Verify ZIP signature/content at the client side.

This is the correct place to inspect actual ZIP bytes.

Do not inspect them by reading the complete archive into the service process.

Also, where practical, verify one heavy media artifact through the same Nginx data-plane principle.

---

# 63. Download resource-lifetime test

Prove:

```text
prepare
    → artifact exists

cancel
    → partial state cleaned

release
    → archive/staging cleaned

failed worker
    → partial state cleaned

stale job cleanup
    → bounded lifetime
```

No orphaned download artifacts.

---

# 64. No unbounded job registry

Audit:

```js
this.downloads = new Map()
```

If retained:

```text
it must be bounded

it must support expiry

it must not hold archive Buffers

it must not hold full media payloads

it must not be the only artifact authority
```

Prefer lightweight metadata only.

Do not retain large manifests indefinitely.

---

# 65. Memory-safety regression

Add tests or instrumentation proving the corrected path does NOT retain:

```text
archive Buffer

whole-file Buffers

finished worker handles

stale transfer jobs

staging directories after release

conversion process handles after completion
```

Do not redesign generic `Logger.stop()` as part of these tests.

Test each new component's own lifecycle.

---

# 66. Preserve generic stop() for future server-runtime review

Record a future architectural review item:

```text
SERVER-RUNTIME LIFECYCLE REVIEW

Preserve Drumee's defensive stop()/cleanup semantics.

Review later:
    lifecycle ownership
    delayed cleanup window
    persistent components
    external handle cleanup
    listener/timer cleanup
    reference breaking
    bounded request graph retention
```

This review is explicitly OUT OF SCOPE for Phase 4.8.

No generic `stop()` behavior change now.

---

# 67. Existing Phase 4.8 regressions

Rerun at minimum:

```text
target/modules/mfs-service/test/service.test.js

target/modules/mfs-transfer/test/transfer.test.js

tests/integration/kernel/phase4.8-backend-dispatch.test.js

tests/integration/kernel/phase4.8-transfer-boundary.test.js

tests/integration/kernel/phase4.8-multi-client-sync.test.js

tests/integration/kernel/phase4.8-finder-browser.test.js

tests/integration/kernel/phase4.6b-system-mfs.test.js

tests/integration/kernel/phase4.7-window-manager.test.js
```

Also run any new:

```text
Nginx download tests
media.orig tests
media representation tests
HLS routing/delivery tests
host-filesystem abstraction tests
resource-lifetime tests
```

---

# 68. system-mfs regression

Unless `system-mfs` requires an actual correction, keep:

```text
a7f7395bdbc79560aed072219b87c0b81c004bce
```

Run:

```text
npm test

node --test test/sql-granularity.test.js

node --test test/mariadb.test.js
```

Do not create a new `system-mfs` commit if no source change is needed.

---

# 69. Standalone server-runtime consideration

The runtime ACL correction may belong in the standalone:

```text
@drumee/server-runtime
```

Do not create a transient-only architectural fork if the standalone runtime is the real authority.

If the required change belongs there:

```text
make the smallest generic runtime change

run server-runtime tests

commit it

DO NOT publish npm
```

Do NOT redesign generic lifecycle cleanup during this runtime change.

Keep `stop()` review separate.

---

# 70. Protected scope

Do NOT modify unrelated repositories or architecture.

In particular, do not reopen:

```text
Finder

FinderWindow

Window Manager

MfsSync semantics

selection

marquee

drag/drop UX

system-mfs SQL model

stored procedure layout

Phase 4.9 work
```

Only add the smallest integration required for:

```text
runtime ACL correctness

host-filesystem abstraction correctness

media representation compatibility

download architecture correctness

bounded resource lifecycle
```

---

# 71. Documentation correction

Update:

```text
docs/refactoring/26-phase4.8-finder-integration.md
```

Correct the authorization description to:

```text
runtime ACL owns final service GRANTED / DENIED

system-mfs supplies effective MFS privilege

mfs-service executes semantics after ACL grant
```

Correct the storage/media description to:

```text
system-mfs owns logical MFS semantics

host-filesystem adapter owns logical-node → physical-artifact mapping

Generator/Document own derived representation creation

FileIo owns representation delivery headers/internal redirect

Nginx owns heavy byte transfer
```

Correct the download description to:

```text
mfs-transfer owns archive job orchestration

offline worker owns archive generation

filesystem owns prepared artifact

FileIo prepares internal redirect

Nginx owns actual byte transfer
```

Correct the original-file contract to:

```text
media.orig always returns the canonical original file
```

Document the HLS distinction:

```text
playlists are small control-plane artifacts that may be rewritten by Node

segments/heavy media remain Nginx-delivered data-plane artifacts
```

Do not state or imply that Node streams downloadable heavy files.

---

# 72. Add architectural principles to the closure record

Record:

```text
SECURITY FIRST

RESOURCE LIFETIME MUST BE EXPLICIT AND BOUNDED

PERFORMANCE AS BEST EFFORT

GRANULAR WHEN POSSIBLE
```

Also record:

```text
generic stop() lifecycle safeguard preserved

dedicated stop()/server-runtime lifecycle review deferred

media.orig invariant preserved

host-filesystem access remains abstracted

heavy file/media delivery delegated to Nginx
```

---

# 73. Git commits

Append corrective commits.

Do not rewrite previous history.

Suggested structure:

```text
server-runtime, if required:
    add injectable MFS authorization backend

transient:
    fix(refactor): route MFS authorization through runtime ACL

    fix(refactor): restore host-filesystem media boundaries

    fix(refactor): restore nginx-backed download delivery

    test(refactor): cover media and transfer lifecycle invariants

    docs(refactor): finalize Phase 4.8 corrective closure
```

Use actual logical grouping based on implementation.

No npm publication.

---

# 74. Canonical HEAD update

The previous transient HEAD:

```text
6fc5a270c7b40679433287e636253f6f8a8e7bd9
```

will no longer be the final Phase 4.8 canonical HEAD after this correction.

Record the new HEAD.

If standalone `server-runtime` changes, record its new HEAD too.

Keep `system-mfs` at:

```text
a7f7395bdbc79560aed072219b87c0b81c004bce
```

unless explicitly changed for a proven reason.

---

# 75. Final Phase 4.8 closure conditions

Phase 4.8 may be declared definitively:

```text
CLOSED / VALIDATED
```

only when all of the following are true:

```text
runtime ACL owns final MFS authorization

Session.uid() remains authoritative

service descriptors define required permission

system-mfs.user_permission() supplies effective privilege

all sources/destinations are checked

workers execute only after GRANTED

transfer endpoints use runtime ACL

transfer ownership checks remain enforced

logical MFS and host filesystem access are separated

physical paths remain private

media.orig always returns the original file

derived representations use explicit service contracts

client cannot choose arbitrary generators or physical paths

image/document/video derived representation architecture is preserved

long-form HLS can generate on demand

HLS URL normalization occurs through Input

HLS playlists may be processed by Node when needed

HLS/media heavy payloads are not streamed through Node

download archives are not built as complete Node Buffers

download source files are not unnecessarily buffered in Node

large archive preparation can execute offline

archive result exists as filesystem artifact

downloadRetrieve does not return archive Buffer

FileIo handles heavy download/media handoff

X-Accel-Redirect is emitted

Nginx sends actual heavy file/media bytes

download artifacts have bounded lifetime

conversion/archive workers have bounded lifecycle

cancel/failure/release cleanup works

generic stop() mechanism remains unchanged

server-runtime lifecycle review is explicitly deferred

Output/sanitize boundaries remain intact

public {hub_id,nid} remains unchanged

system-mfs procedure-first design remains intact

one SQL object per file remains intact

all Phase 4.8 regressions pass

real Nginx download integration passes

media.orig regressions pass

HLS routing/delivery regressions pass

Phase 4.7 regression passes

working trees are clean

no npm publication occurred

Phase 4.9 has not started
```

---

# 76. Final report

Return:

```text
1. Root causes

2. Previous ACL path

3. Corrected ACL path

4. Runtime ACL changes

5. MFS permission backend changes

6. Host-filesystem abstraction used

7. media.orig invariant validation

8. Derived representation architecture

9. Image/document/video representation handling

10. Long-form HLS flow

11. Input video-route normalization

12. Control-plane vs data-plane distinction

13. Previous download path

14. Corrected download preparation path

15. Corrected download delivery path

16. Offline worker architecture

17. FileIo/Nginx integration

18. Resource lifecycle / cleanup model

19. mfs-service changes

20. mfs-transfer changes

21. server-runtime changes, if any

22. Tests changed

23. Exact test commands/results

24. Nginx integration result

25. media.orig regression result

26. HLS regression result

27. Memory/resource-lifetime validation

28. Repositories modified

29. Commit hashes

30. Final transient HEAD

31. Final server-runtime HEAD if changed

32. Confirmation of system-mfs HEAD

33. Working-tree status

34. Explicit confirmation:
      generic stop() preserved
      stop()/lifecycle review deferred
      no npm publication
      no Phase 4.9
```

Do not solve unrelated architectural issues during this pass.

The goal is to restore and explicitly preserve the intended Drumee architecture:

```text
security first

bounded lifecycle

performance-aware execution

granular responsibilities

stored-procedure-first local data operations

logical MFS separated from host filesystem

derived media representations separated from originals

media.orig always means original

offline expensive work

small control artifacts may be processed by Node

Nginx as heavy file/media data plane

runtime ACL before services
```
