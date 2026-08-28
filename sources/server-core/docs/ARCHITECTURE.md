# Architecture Overview — @drumee/server-core

`@drumee/server-core` is the middleware foundation for all Drumee backend services. It handles the full lifecycle of an HTTP request: parsing, session resolution, permission checking, business logic execution, media operations, and response formatting.

---

## Table of Contents

- [Architecture Overview — @drumee/server-core](#architecture-overview--drumeeserver-core)
  - [Table of Contents](#table-of-contents)
  - [1. Platform Context](#1-platform-context)
  - [2. The Hub — Multi-Tenancy Unit](#2-the-hub--multi-tenancy-unit)
  - [3. Full Stack Overview](#3-full-stack-overview)
  - [4. High-Level Request Pipeline](#4-high-level-request-pipeline)
  - [5. Module Responsibilities](#5-module-responsibilities)
  - [6. Base Class and Inheritance](#6-base-class-and-inheritance)
  - [7. Event-Driven Flow](#7-event-driven-flow)
  - [8. Session Lifecycle](#8-session-lifecycle)
  - [9. Access Control Model](#9-access-control-model)
  - [10. Service Declarations](#10-service-declarations)
  - [11. Meta-Filesystem (MFS)](#11-meta-filesystem-mfs)
  - [12. Media Processing](#12-media-processing)
  - [13. Response Formatting](#13-response-formatting)
  - [14. LETC — Frontend Rendering Engine](#14-letc--frontend-rendering-engine)
  - [15. Error Handling](#15-error-handling)
  - [16. Runtime Environment](#16-runtime-environment)
  - [17. Yellow Pages (YP) — Service Registry](#17-yellow-pages-yp--service-registry)
  - [18. Plugin / Extensibility Model](#18-plugin--extensibility-model)
  - [19. Key Conventions](#19-key-conventions)
  - [20. Dependency Map](#20-dependency-map)

---

## 1. Platform Context

Drumee is a **self-hosted, sovereign data infrastructure** — a Meta Operating System that turns a filesystem into a collaborative workspace. Rather than assembling separate SaaS tools, it delivers authentication, storage, backend, and frontend as one integrated system where users own their data.

`server-core` is the Node.js backbone of that system. Every backend service in the Drumee ecosystem — file management, sharing, messaging, user administration — is built on top of this library. It provides the infrastructure; individual services provide the business logic.

The three design priorities that shape every architectural decision:

1. **Sovereignty first** — data and identity stay on the operator's infrastructure
2. **Usability second** — the system must work for non-technical end users
3. **Extensibility third** — developers can add services without modifying core

---

## 2. The Hub — Multi-Tenancy Unit

A **Hub** is the fundamental unit of multi-tenancy in Drumee. Each hub is an independent collaborative workspace with:

- Its own **subdomain** (or custom domain)
- Its own **MariaDB schema** — data is strictly isolated at the database level
- Its own **MFS storage root** on disk
- Its own **set of users, roles, and permissions**
- Its own **theme, logo, wallpaper, and metadata**

A single Drumee installation hosts many hubs. When a request arrives, one of the first things `Session` does is identify which hub the request belongs to (via the `Host` header), then load that hub's configuration from YP. All subsequent database calls, file operations, and permission checks are scoped to that hub.

```
Drumee Instance
  ├── Hub A  (team.example.com)  → schema_a,  /mfs/a/
  ├── Hub B  (org.example.com)   → schema_b,  /mfs/b/
  └── Hub C  (project.example.com) → schema_c, /mfs/c/
```

---

## 3. Full Stack Overview

`server-core` runs inside the following infrastructure stack. Understanding where each component sits helps explain many design choices in the library.

```
┌────────────────────────────────────────┐
│  Nginx                                 │
│  ├─ TLS termination                    │
│  ├─ Serve static UI bundles            │
│  └─ X-Accel-Redirect for media files   │  ← FileIo relies on this
└──────────────────┬─────────────────────┘
                   │ proxy_pass
┌──────────────────▼─────────────────────┐
│  Node.js  (@drumee/server-core)        │
│  ├─ HTTP request pipeline              │
│  ├─ Session / ACL                      │
│  ├─ Service execution                  │
│  └─ Media conversion (child procs)     │
└──────┬────────────────────┬────────────┘
       │                    │
┌──────▼──────┐    ┌────────▼───────┐
│  MariaDB    │    │  Redis         │
│  Per-hub    │    │  Session cache │
│  schemas    │    │  WebSocket     │
│  MFS nodes  │    │  pub/sub       │
│  ACL data   │    │                │
└─────────────┘    └────────────────┘
```

**Why Nginx matters to this library:** `FileIo` never streams large files through Node.js. It sets an `X-Accel-Redirect` response header pointing to the physical file path, and Nginx handles the actual byte transfer. This keeps Node.js free for request processing.

---

## 4. High-Level Request Pipeline

Every HTTP request flows through the same ordered pipeline. Each stage is a class that communicates with the next via events.

```
HTTP Request
     │
     ▼
┌──────────────────────────────────┐
│  Input                           │  Parse URL, headers, cookies,
│  lib/input.js                    │  multipart uploads, body.
│                                  │  Emits: INPUT_READY
└──────────────┬───────────────────┘
               │ INPUT_READY
               ▼
┌──────────────────────────────────┐
│  Session                         │  Identify hub, resolve user
│  lib/session.js                  │  from session cookie, handle
│                                  │  login/OTP/mimic flows.
│                                  │  Emits: READY / START
└──────────────┬───────────────────┘
               │ READY
               ▼
┌──────────────────────────────────┐
│  Acl                             │  Check bitwise permissions on
│  lib/acl.js                      │  the requested service, source
│                                  │  node, and destination node.
│                                  │  Emits: GRANTED / DENIED
└──────────────┬───────────────────┘
               │ GRANTED
               ▼
┌──────────────────────────────────┐
│  Entity  (extends Acl)           │  Execute service logic; send
│  lib/entity.js                   │  hub/user/email notifications;
│                                  │  spawn background tasks.
└──────────────┬───────────────────┘
               │
       ┌───────┴──────────────────┐
       ▼                          ▼
┌─────────────┐        ┌────────────────────┐
│  Mfs / FileIo│        │  Generator /       │
│  (file ops) │        │  Document          │
│             │        │  (media conversion)│
└──────┬──────┘        └────────┬───────────┘
       └───────────┬────────────┘
                   ▼
┌──────────────────────────────────┐
│  Output                          │  Serialize response (JSON/HTML/
│  lib/output.js                   │  media), set headers, cookies,
│                                  │  CORS. Emits: SENT
└──────────────────────────────────┘
     │
     ▼
HTTP Response
```

If any stage encounters an error it delegates to **Exception** (`lib/exception.js`), which sends a formatted error response and terminates the pipeline.

---

## 5. Module Responsibilities

| Module | File | Role |
|---|---|---|
| **Input** | `lib/input.js` | Parse raw HTTP request into a normalized data structure |
| **Session** | `lib/session.js` | Identify hub; authenticate user; load context |
| **Acl** | `lib/acl.js` | Enforce bitwise access control rules |
| **Entity** | `lib/entity.js` | Extend Acl with notification and service execution utilities |
| **Output** | `lib/output.js` | Format and write the HTTP response |
| **Data** | `lib/data.js` | Wrap request payload; extract service name, module, method, recipient |
| **User** | `lib/user.js` | Expose user profile, locale, identity helpers |
| **Mfs** | `lib/mfs.js` | Virtual filesystem abstraction backed by MariaDB |
| **FileIo** | `lib/file-io.js` | Stream physical files; serve media with proper format headers |
| **Exception** | `lib/exception.js` | Emit structured HTTP error responses |
| **RuntimeEnv** | `lib/runtimeEnv.js` | Build client-facing runtime configuration (bundles, locale, hub settings) |
| **Page** | `lib/page.js` | Render Lodash HTML templates with runtime context injected |
| **Generator** | `lib/utils/generator.js` | Convert media files (images, video, audio, documents) into derived formats |
| **Document** | `lib/utils/document.js` | Index and rebuild document previews in background subprocesses |
| **MfsTools** | `lib/utils/mfs.js` | Low-level filesystem utilities used by Mfs and FileIo |

---

## 6. Base Class and Inheritance

All major classes extend **`Logger`** from `@drumee/server-essentials`.

```
Logger  (from @drumee/server-essentials)
  ├─ EventEmitter-like interface: .trigger(), .on(), .once()
  ├─ Standardised logging
  └─ Access to Cache, Mariadb, RedisStore
       │
       ├── Input
       ├── Session
       ├── Output
       ├── User
       ├── Data
       ├── Mfs
       │     └── FileIo
       ├── Exception
       ├── RuntimeEnv
       │     └── Page
       └── Acl
             └── Entity
```

Each class exposes an `initialize(opt)` method as its constructor-equivalent. Options typically carry references to the other pipeline objects: `input`, `output`, `session`, `yp` (Yellow Pages registry).

---

## 7. Event-Driven Flow

The pipeline stages do not call each other directly. They communicate through named events.

| Event | Emitted by | Consumed by |
|---|---|---|
| `INPUT_READY` | Input | Session |
| `READY` | Session | Acl / calling code |
| `START` | Session | Acl / calling code |
| `GRANTED` | Acl | Entity / service handler |
| `DENIED` | Acl | Exception |
| `ERROR` | Any stage | Exception |
| `SENT` | Output | Cleanup / connection tracking |
| `END_OF_SESSION` | Session | Cleanup |
| `precondition_failed` | Input | Exception |

This decoupling means any stage can be replaced or short-circuited without modifying upstream code.

---

## 8. Session Lifecycle

```
1. Input emits INPUT_READY
2. Session._selectSession()
      ├─ _initHub()   → load hub config from YP (by Host header)
      └─ _initUser()  → resolve user from session cookie
             ├─ Normal user  → load profile + settings JSON
             ├─ Guest/DMZ    → dmz_login()
             ├─ OTP pending  → send_otp()
             └─ Mimic        → validate impersonation window
3. Session emits READY (with hub + user context set)
```

**User states checked during init:**

| State | Meaning |
|---|---|
| `active` | Normal login |
| `new` | First-time user |
| `otp` | Awaiting one-time password |
| `online` | Already connected |
| `offline` | Inactive |
| `frozen` / `locked` / `archived` | Access denied |
| `system` | Internal service identity |

**Mimic (impersonation):** A privileged user can mimic another. The session validates that the mimic window is still open on every request; if expired, access is denied.

---

## 9. Access Control Model

Drumee uses a **Linux-inspired, bitwise permission model**. Permission values are integers combined with bitwise OR/AND to express combinations of rights (read, write, execute, share, etc.), consistent with how Unix file permissions work.

ACL checks permissions across two axes — **source** (who is acting) and **destination** (what resource is being acted upon) — and at three scopes:

```
Platform scope  (global remit)
  └── Domain scope   (hub / tenant)
        └── Resource scope  (MFS node)
```

**Check sequence in `Acl._start()`:**

1. `check_env()` — verify MFS home and basic environment
2. `check_source()` — validate user's bitwise permissions on the source
3. `check_dest()` — validate bitwise permissions on the target resource
4. `check_domain()` — domain-level permission check
5. `check_remit()` — platform-level remit validation
6. Emit `GRANTED` or `DENIED`

If a service is not declared or the user's permission bits do not satisfy the requirement, the server returns `403` without executing any service code.

**Fast-check path:** Simple services (e.g., read-only fetches with no target node) use `fast_check(name)` to skip expensive node lookups.

---

## 10. Service Declarations

Every backend service exposed to the client must be **declared in a JSON configuration file**. The ACL layer reads these declarations to know which permission bits are required before a service may execute.

```json
{
  "media.copy": {
    "remit": 4,
    "source": 2,
    "dest": 3
  },
  "yp.get_env": {
    "remit": 0
  }
}
```

This separation means:
- New services can be added or restricted by editing JSON, without touching Node.js code.
- The ACL can reject unauthorized calls before any service handler runs.
- Plugin services follow exactly the same declaration format as core services.

---

## 11. Meta-Filesystem (MFS)

The MFS is a **virtual filesystem tree stored in MariaDB** — files have database nodes with metadata, and the physical bytes live on disk under the hub's MFS storage root.

```
MFS Node (MariaDB row)
  ├─ nid          — node ID
  ├─ parent_id    — parent folder
  ├─ filename     — display name
  ├─ ftype        — type (dir, file, link, …)
  ├─ mimetype     — MIME type
  ├─ size         — byte size
  └─ ...

Physical path: {mfs_root}/{node_path}/orig.{ext}
Derived paths: {mfs_root}/{node_path}/{format}.{ext}
               e.g. preview.png, slide.jpg, thumb.webp
```

**`Mfs`** handles the database side: creating nodes, browsing, deleting, default folder provisioning.  
**`FileIo`** handles the physical side: streaming file bytes, negotiating output format, setting Nginx `X-Accel-Redirect` headers for acceleration.  
**`MfsTools`** (`lib/utils/mfs.js`) provides low-level shell-safe file operations shared by both.

**Special node IDs:**

| ID | Meaning |
|---|---|
| `-1` | Hub logo |
| `-2` | User avatar |
| `-3` | Hub wallpaper |

---

## 12. Media Processing

**`Generator`** (`lib/utils/generator.js`) converts original files into derived formats on demand.

| Source type | Tools used | Generated formats |
|---|---|---|
| Image | GraphicsMagick | vignette, preview, slide, card, thumb, webp, theme |
| Video | FFmpeg | stream (H.264), card, thumb, vignette, HLS segments |
| Audio | FFmpeg | stream (MP3), vignette, thumb, browse, slide |
| Document | LibreOffice + GM | PDF, vignette, thumb, card, slide, search index |

Generated files are cached alongside the original under the node's physical path. Subsequent requests are served directly by Nginx via `X-Accel-Redirect` without re-entering Node.js.

**Long-running conversions** (document indexing, email notifications) are offloaded to detached child processes spawned with `shelljs` or Node's `spawn`, so the HTTP response is not delayed.

---

## 13. Response Formatting

`Output` wraps every response in a standard envelope:

```json
{
  "__ack__":       "<service name>",
  "__status__":    "<ok | error | …>",
  "__expiry__":    "<cache TTL>",
  "__timestamp__": "<ms since epoch>",
  "data":          { … }
}
```

Convenience methods:

| Method | Use |
|---|---|
| `output.data(obj)` | JSON data response |
| `output.row(obj)` | Single database record |
| `output.rows(arr)` | Multiple records |
| `output.list(arr)` | Array payload |
| `output.html(str)` | HTML page |
| `output.redirect(url)` | 302 redirect |

Cookies are always set `httpOnly`, `SameSite=Strict`, and scoped to the hub domain.

---

## 14. LETC — Frontend Rendering Engine

**LETC** stands for *Limitlessly Extensible Tree Components*. It is the client-side rendering engine Drumee uses instead of a traditional SPA framework. Understanding it explains why `RuntimeEnv` and `Page` are structured the way they are.

**How LETC works:**

- Every UI element — screens, panels, buttons, forms, lists — is a **widget** identified by a `kind` string.
- Widgets are built using **Backbone.Marionette** classes registered in a client-side component registry.
- A page is described as a **JSON tree structure** of widgets, sent from the server and rendered declaratively on the client.
- There is no server-side HTML generation beyond the initial shell page; content is rendered by composing widgets.

**What `server-core` provides to LETC:**

`RuntimeEnv` assembles the configuration object that bootstraps the LETC runtime on page load:

```
RuntimeEnv output (injected into the HTML shell)
  ├─ hub domain, protocol, instance ID
  ├─ WebSocket endpoint
  ├─ user auth state and locale
  ├─ JavaScript bundle entry points  ← LETC registry files
  ├─ content-hash references         ← from ui manifest.json
  └─ hub profile, theme, metadata
```

`Page` extends `RuntimeEnv` and uses Lodash template rendering to inject this bootstrap configuration into the HTML shell that LETC starts from.

---

## 15. Error Handling

`Exception` maps semantic errors to HTTP status codes:

| Method | HTTP code |
|---|---|
| `exception.server()` | 500 |
| `exception.user()` | 400 |
| `exception.unauthorized()` | 401 |
| `exception.forbiden()` | 403 |
| `exception.not_found()` | 404 |
| `exception.reject()` | 405 |
| `exception.precondition()` | 412 |
| `exception.fatal()` | 512 |

All methods accept an optional `reason` field for additional context logged server-side but not exposed to the client.

---

## 16. Runtime Environment

`RuntimeEnv` assembles a configuration object that is embedded into every HTML page response. It includes:

- Hub domain, protocol, instance ID
- WebSocket endpoint
- User auth state and locale
- JavaScript bundle entry points and content-hash references (loaded from the UI `manifest.json`)
- Hub profile, theme, and metadata

`Page` extends `RuntimeEnv` and uses Lodash template rendering to inject this configuration into server-rendered HTML. Font links, language titles, and descriptions are also injected at this stage.

---

## 17. Yellow Pages (YP) — Service Registry

**YP** is Drumee's internal RPC/registry abstraction backed by MariaDB stored procedures. It is not a class defined in this library — it is injected via `initialize(opt)` and used throughout.

```js
// Typical YP call pattern
this.yp.asyncCall("procedure_name", [arg1, arg2], (err, rows) => { … });
```

YP is the primary mechanism for:
- Loading hub and user data during session init
- Resolving MFS nodes and permissions in ACL
- Any database read/write from service handlers

Multi-tenancy is enforced at the YP level: each hub has its own database schema, and YP routes calls to the correct schema.

---

## 18. Plugin / Extensibility Model

Drumee is designed so that **new backend services can be added without modifying `server-core`**. A plugin is a separate Node.js package that:

1. Extends `Entity` (or `Acl`) from this library for its service handlers.
2. Declares its services in a JSON config file (same format as [§10](#10-service-declarations)).
3. Is registered in the Drumee service loader alongside core services.

The permission and pipeline infrastructure is inherited from `server-core` automatically. The plugin only needs to implement the service-specific business logic.

This means `server-core` is an infrastructure boundary — it should not need to change when new product features are added. Features live in plugins; core provides the contract.

---

## 19. Key Conventions

**Service naming:** `module.method` — e.g., `yp.get_env`, `media.copy`, `share.link`. The ACL and input parsing both rely on this dot-separated format.

**`initialize(opt)` pattern:** No class uses a traditional constructor for setup. All wiring happens in `initialize(opt)`, making it straightforward to inject mocks or reconfigure a stage in tests.

**Double-underscore naming:** Private/internal class variants are prefixed with `__` (e.g., `__acl`, `__data`). Exported names drop the prefix.

**Physical file paths follow a predictable template:**
```
{mfs_root}/{node_path}/orig.{ext}         ← original
{mfs_root}/{node_path}/{format}.{ext}     ← derived (preview, slide, …)
{mfs_root}/{node_path}/info.json          ← metadata cache
```

**Async strategy:** Database and I/O calls use YP callbacks. Media generation uses `async/await`. For long run calls, child processes are forked in background in fire-and-forget mode (`detached: true`) or queued. Results are later pushed back through websocket.

---

## 20. Dependency Map

```
@drumee/server-core
  ├─ @drumee/server-essentials   Logger, Cache, Mariadb, RedisStore, Events, Attr
  ├─ multiparty                  Multipart form / file upload parsing
  ├─ cookie                      Cookie string parsing
  ├─ accept-language             Accept-Language header negotiation
  ├─ shelljs                     Shell command execution (file operations, subprocesses)
  ├─ file-type                   Detect MIME type from file buffer (magic bytes)
  ├─ music-metadata              Audio file metadata extraction
  ├─ js-yaml                     YAML config parsing
  └─ jsonfile                    JSON file read/write (info.json caches)

External tools (must be installed on the host):
  ├─ GraphicsMagick (gm)         Image resizing and conversion
  ├─ FFmpeg / FFprobe            Video and audio conversion
  ├─ LibreOffice (soffice)       Document-to-PDF conversion
  ├─ pdfinfo                     PDF metadata extraction
  └─ Nginx                       Static file acceleration (X-Accel-Redirect)
```
