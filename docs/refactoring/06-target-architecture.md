# Target Architecture

This proposal requires approval and does not define final repository splits.

```text
Control Plane / CLI
        | stable administrative contracts
        v
Distribution manifest --> lifecycle/schema provisioner
        |                         |
        v                         v
Minimal OS shell <------ dynamically loaded modules
        |
existing Core / Essentials / LETC SDK
        |
deployment consumes versioned runtime + distribution + modules
```

The Minimal OS (`KEEP_OS`) contains boot/configuration, request/session/context, identity/entity/hub context, ACL enforcement, service dispatch, backend/frontend discovery adapters, event/WebSocket transport, MFS semantic primitives and storage adapter, LETC integration, browser router/shell and Window Manager primitives. It excludes user applications and administration.

Core/SDK remains based on `server-core`, `server-essentials`, `ui-core`, `ui-essentials`, `ui-toolkit`, and `ui-styles`; no new low-level replacement is proposed.

Candidate system modules are Finder, signin/loby, generic previewers/editors, and possibly contacts/sharing after investigation. Team modules are chat/channels, meetings/rooms/signaling, tasks, collaboration notifications/workflows and Team-specific billing. Team is a distribution manifest composing the OS, selected system modules and all compatibility-required Team modules.

The Control Plane contains CLI concepts, administrative contracts and user/hub/settings/MFS administration. Module lifecycle enters it only after approval. The OS never imports it. DB mode may remain transitional but does not define the stable contract.

Deployment contains Docker/native packaging, configuration, artifact acquisition, install ordering, backup/restore and upgrade/rollback. It consumes runtime, distribution and module artifacts rather than Team repository layout.

Schemas follow capability ownership: entity/identity/session/ACL/MFS/provisioning primitives remain minimal; module schema/migrations ship with modules. Provisioning must apply the distribution's module schemas to new and existing entity databases.

Compatibility remains `sources/ui-team + sources/server-team + sources/schemas`. Service contracts, schema behavior, boot routes, MFS semantics, CLI DB behavior and both self-host channels remain protected during incremental coexistence.
