# Target Architecture

This proposal requires approval and does not define final repository splits.

`KEEP_OS` describes capabilities the minimal environment must provide. The present files cited by the mapping are evidence of those capabilities, not predetermined contents of `target/os` or a future repository.

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

The Minimal OS must own the `KEEP_OS` responsibilities: boot/configuration, request/session/context, identity/entity/hub context, the generic ACL evaluation engine, REST/service dispatch, backend/frontend discovery adapters, event/WebSocket transport, MFS semantic primitives and storage adapter, LETC host integration, browser routing/shell hosting and Window Manager primitives. It supplies mechanisms, not every policy consumed by them. Service-specific deny/allow lists remain with their services; billing/over-limit policy belongs to Team or a separately approved policy module; secure-share policy is `INVESTIGATE`. Current implementations may be split, adapted, reproduced, or left partly with modules; no file-level destination is selected by this responsibility list.

The browser shell is therefore a target responsibility, not a description or rename of `sources/ui-team`. UI Team currently bundles the host path with the complete Team product. Mapping must first identify the smallest boot, routing, runtime-readiness, application-hosting and Window Manager contracts; everything beyond those proven host needs stays with system/Team modules or remains `INVESTIGATE`.

Core/SDK remains based on `server-core`, `server-essentials`, `ui-core`, `ui-essentials`, `ui-toolkit`, and `ui-styles`; no new low-level replacement is proposed.

Candidate system modules are Finder, signin/loby, generic previewers/editors, and possibly contacts/sharing after investigation. Team modules are chat/channels, meetings/rooms/signaling, tasks, collaboration notifications/workflows and Team-specific billing. Team is a distribution manifest composing the OS, selected system modules and all compatibility-required Team modules.

The Control Plane contains CLI concepts, administrative contracts and user/hub/settings/MFS administration. Module lifecycle enters it only after approval. The OS never imports it. DB mode may remain transitional but does not define the stable contract.

Deployment contains Docker/native packaging, configuration, artifact acquisition, install ordering, backup/restore and upgrade/rollback. It consumes runtime, distribution and module artifacts rather than Team repository layout.

Schemas follow capability ownership: the entity/identity/session/ACL/MFS/provisioning responsibilities required for hosting belong to the minimal platform, but the exact current SQL objects implementing them remain subject to dependency mapping. Module schema/migrations ship with modules. Provisioning must apply the distribution's module schemas to new and existing entity databases.

Compatibility remains `sources/ui-team + sources/server-team + sources/schemas`. Service contracts, schema behavior, boot routes, MFS semantics, CLI DB behavior and both self-host channels remain protected during incremental coexistence.
