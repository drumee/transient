# Phase 4.9 — final validation report

Date: 2026-10-09. Verdict: **PHASE 4.9 CLOSED**.

## Opening references

| Repository | Branch | Opening commit |
|---|---|---|
| transient | `refactor/mapping` | `da817a2c7de145a54b9905c116d1b6f0608325ad` |
| server-runtime | `main` | `d17ecee8c645f1d14a7e2ef45a2f3542a27c0763` |
| system-mfs | `main` | `a7f7395bdbc79560aed072219b87c0b81c004bce` |
| finder | `main` | `730aa309939f956d76f70beeed5d9e46846c0574` |
| window-manager | `main` | `e294979dfcb59f73af19975e40f890a0b366cd8c` |
| ui-runtime | `main` | `5366d904356b414e87848a0bc8870b612e6c748a` |

Work was kept on the checked-out branches. This validation created no commit,
push or npm publication.

## Canonical command and results

```bash
scripts/test-env/kernel/phase4.9-validation.sh
```

Result: PASS. The command ran the Phase 4.8B gate, Phase 4.8 Finder gate,
standalone suites and package audits:

| Evidence | Result |
|---|---:|
| Hub lifecycle contract | 10/10 |
| runtime Hub authorization | 5/5 |
| live MariaDB Hub/MFS/restart scenario | 1/1 |
| focused Finder/backend/browser/sync | 50/50 |
| real Nginx HTTP/media/upload | 4/4 |
| standalone system-mfs | 9/9 |
| standalone server-runtime | 46/46 |
| standalone Finder | 20/20 |
| standalone Window Manager | 6/6 |
| package dry-runs and immutable `sources/**` audit | PASS |

After the complete run, the session fixture was tightened to instantiate the
real `KernelSession`. The canonical 4.8B command was rerun and passed again,
including MariaDB restart/recovery.

Chromium proves independent A/B windows, navigation and interaction behavior.
The backend scenario separately uses the same public logical DTOs through the
real dispatcher, Hub resolver, MariaDB shards and KernelSession. Nginx proves
the actual bounded binary/media paths. This layered fixture deliberately does
not expose MariaDB locators to the browser.

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
canonical `server/schemas/SCHEMA_MANIFEST.json`. Prepared alpha.2 versions are
not published.

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
