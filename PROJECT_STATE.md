# Project state

```text
Project:
    Drumee Minimal Kernel Refactor

Current:
    Phase 4.5 CLOSED
    R0 IN PROGRESS
    R1 AFTER R0
    Phase 4.6 AFTER R1

Local repositories:
    transient      ~/github/transient
    server-runtime ~/github/server-runtime
    ui-runtime     ~/github/ui-runtime

GitHub:
    drumee/transient
    drumee/server-runtime
    drumee/ui-runtime

Canonical invariants:
    DEFAULT_ORG_ID = 1
    NOBODY_UID = ffffffffffffffff

Architecture:
    server-runtime = intrinsic backend runtime
    ui-runtime = intrinsic frontend runtime
    system-mfs = first system/kernel module
    Finder = system application
    Marketing = first business application

Next:
    R1 npm publication
    Phase 4.6 platform bootstrap + system-mfs
```

Validated source lineage:

- `e17a714ad3bf2717d58f723af71ca77265f8498d` — Phase 4.5 exportability lock.
- `0e70b7cd685c4a122ce70e5cfff60b7b788789ae` — finalized exportability contract.
- `7401aeafb70a90ba1b581e93d3b763801c50535a` — portable source immutability gate.
- `e3f4468d3ea882baeee4c7fefbd956aca4128d28` — Phase 4.6 invariant documentation and R0 extraction source.

R0 does not publish npm packages and does not authorize Phase 4.6.
