# Phase 4.9 — final validation report

Date: 2026-10-09. Verdict: **PHASE 4.9 CLOSED**.

## Opening references

| Repository | Branch | Opening commit |
|---|---|---|
| transient | `refactor/mapping` | `a7624bd7c894c49fb43c720ca6b7526acc217431` |
| server-runtime | `main` | `295592c70d47d9eef3b5cfeb8ced72943ee71488` |
| system-mfs | `main` | `53101c4a995ffca9118f795ab5d4c7c731200a2f` |
| finder | `main` | `b811d78dd9740e5b081190f7241bdebac3d062d4` |
| window-manager | `main` | `e294979dfcb59f73af19975e40f890a0b366cd8c` |
| ui-runtime | `main` | `5366d904356b414e87848a0bc8870b612e6c748a` |

Work was kept on the checked-out branches. This validation created no commit,
push or npm publication.

## Corrective review findings

All five review findings were confirmed on the reviewed commits.

| Finding | Confirmation and correction |
|---|---|
| Hub readiness ignored descriptor `requires` | Confirmed. Descriptor and service requirements are now merged with permission capabilities, deduplicated and checked on every authorized Hub before platform providers and Worker construction. |
| Empty MFS `requires` bypassed the default | Confirmed. Every MFS service now adds `system-mfs`; absent, empty and non-empty declarations are covered, including independent source/destination readiness. |
| WebSocket authorization defaulted to allow | Confirmed. A delivery transport now requires an authorizer. The official authorizer reloads the recipient session, checks current Hub and node read rights, projects unauthorized resources, and fails closed on errors. |
| Undo used the post-await navigation location | Confirmed. The source and inverse DTO are snapshotted before the first await; failed moves add no entry and denied inverses remain retryable. |
| No browser-to-real-backend proof | Confirmed. A new Chromium test uses authenticated HTTP, runtime WebSocket, the official Hub lifecycle, provisioned system-mfs and MariaDB shards. |

The new end-to-end path also exposed two fixture-hidden integration defects:
Finder copy used `nodes` while the canonical service DTO requires `sources`,
and persistent transfer endpoints lacked an owner-bound resource resolver for
runtime ACL. Both are corrected and covered. Transfer identifiers now resolve
resources only after matching the authenticated owner.

## Canonical command and results

```bash
scripts/test-env/kernel/phase4.9-validation.sh
```

Result: PASS. The command ran the Phase 4.8B gate, Phase 4.8 Finder gate,
standalone suites and package audits:

| Evidence | Result |
|---|---:|
| Hub lifecycle contract | 10/10 |
| runtime Hub authorization | 6/6 |
| live MariaDB Hub/MFS/restart scenario | 1/1 |
| focused Finder/backend/browser/sync | 55/55 |
| real Nginx HTTP/media/upload | 4/4 |
| Chromium → authenticated HTTP/WebSocket → runtime → MariaDB | 1/1 |
| standalone system-mfs | 9/9 |
| standalone server-runtime | 48/48 |
| standalone Finder | 23/23 |
| standalone Window Manager | 6/6 |
| package dry-runs and immutable `sources/**` audit | PASS |

The canonical 4.8B command was rerun first and passed with creator ownership,
canonical read/write/delete/admin/owner distinctions, MariaDB restart on the
same durable volume and recovery from a second checkout. The complete 4.9
command then passed with the new browser-to-backend scenario included.

Evidence is classified by level. Unit/in-memory fixtures retain deterministic
interaction, timing and projection tests. Direct integration exercises the
dispatcher, KernelSession, Hub resolver and MariaDB. The new full path drives
the standalone Finder clients in Chromium over authenticated HTTP and the real
runtime WebSocket against lifecycle-created, automatically provisioned A/B
shards. It proves simultaneous windows, listing/navigation/mkdir, move, copy,
ACL denial, chunk upload and byte retrieval, authorized synchronization,
post-revocation suppression and absence of MariaDB locators in browser
exchanges.

## Failure, concurrency and recovery evidence

The retained 4.8B evidence covers concurrent idempotent creation, interruption
during shard allocation/registration, partial module installation, handler
success before status recording, immutable in-flight plans, ownership
collision rejection and paginated upgrade resume. Retry preserves the Hub and
shard and skips recorded successful steps. Phase 4.9 adds real restart on the
same volumes and reinstallation from a second checkout without changing any
association or data.

## Packaging and limits

Dry-run artifacts contain no fixtures, historical sources, credentials or
development checkout paths. The system-mfs artifact contains only the
canonical `server/schemas/SCHEMA_MANIFEST.json`. Corrected server-runtime and
Finder artifacts are prepared as `0.1.0-alpha.3`; system-mfs remains
`0.1.0-alpha.2`. None is published.

Finder's bounded context-menu contract delegates rendering to the host. Undo
is deliberately limited to session-local same-Hub moves. Rich conflict UI,
trash/restore, sharing, Hub administration and Oxymotion are not claimed.
These limits do not weaken the delivered Hub-authorized Finder, MFS transfer,
synchronization or persistence contracts.

The phase closes because the Finder is reproducibly consumable, authorizes
every Hub context through the official lifecycle, preserves MFS node ACL,
survives MariaDB restart, passes runtime/Nginx/Chromium integration and packs
cleanly from standalone boundaries. Oxymotion end-to-end validation remains
the next, separate step.
