# Project state

The authoritative phase definitions are in
[`docs/refactoring/23-kernel-roadmap.md`](docs/refactoring/23-kernel-roadmap.md).

```text
Project:
    Drumee Minimal Kernel Refactor

Current:
    Phase 4.5 CLOSED
    R0 CLOSED
    R1 CLOSED
    Phase 4.6 CLOSED / VALIDATED
    Phase 4.6A platform bootstrap IMPLEMENTED / VALIDATED
    Phase 4.6B system-mfs IMPLEMENTED / VALIDATED
    R2 standalone system-mfs extraction CLOSED / VALIDATED

Planned:
    Phase 4.7 Window Manager NEXT / NOT AUTHORIZED
    Phase 4.8 Finder implementation/integration PLANNED
    Phase 4.9 Finder real-use stabilization and standalone extraction PLANNED

External:
    Oxymot = separate future Marketing/business project

Local repositories:
    transient      ~/github/transient
    server-runtime ~/github/server-runtime
    ui-runtime     ~/github/ui-runtime
    system-mfs     ~/github/system-mfs

GitHub:
    drumee/transient
    drumee/server-runtime
    drumee/ui-runtime
    drumee/system-mfs

Canonical invariants:
    DEFAULT_ORG_ID = 1
    NOBODY_UID = ffffffffffffffff

Architecture:
    server-runtime = intrinsic backend runtime
    ui-runtime = intrinsic frontend runtime
    platform bootstrap = control-plane identity provisioning
    system-mfs = standalone system/kernel module
    Window Manager = generic UI capability independent from MFS
    Finder = substantial system application
    Marketing = externalized to the future Oxymot project

Next:
    Phase 4.7 Window Manager — NOT AUTHORIZED
    do not begin Phase 4.7 without explicit authorization
```

R0 validation:

```text
server-runtime:
    repo: drumee/server-runtime
    version: 0.1.0-alpha.1
    validated commit: 0d4e0fc967c3260d595372f1579dabd8d303bee3

ui-runtime:
    repo: drumee/ui-runtime
    version: 0.1.0-alpha.1
    validated commit: 26f3e599290f552712523d7d829190f9bf46b81f
```

Validated source lineage:

- `e17a714ad3bf2717d58f723af71ca77265f8498d` — Phase 4.5 exportability lock.
- `0e70b7cd685c4a122ce70e5cfff60b7b788789ae` — finalized exportability contract.
- `7401aeafb70a90ba1b581e93d3b763801c50535a` — portable source immutability gate.
- `e3f4468d3ea882baeee4c7fefbd956aca4128d28` — Phase 4.6 invariant documentation and R0 extraction source.
- `573df7b00998e811ed5650f2e896ecaab354a287` — Phase 4.6A platform bootstrap.
- `48d4254e8e98bc32485935a405005c173822e00b` — Phase 4.6B system-mfs.
- `5139e5aa34a0fc2f58e12fb112a6ba18e18f334a` — data naming correction.
- `078e71378a52acd06478d9df556a7cd5b4d6a223` — method naming correction and R2 extraction source.

R1 publication evidence:

```text
@drumee/server-runtime@0.1.0-alpha.1
    prepared commit: e582f708ad85579d7c1238d361a32b5e486c08be
    published:       2026-09-19T14:42:05.963Z
    shasum:          2bd53842ebfaad72e63897ee0682d9ed7aba0264
    integrity:       sha512-665KKd9/qoLWSZxYz3yCfMr+5gQTyDapFj2T9kgj9ET+Ftu6PA5hLAJesJEGm8P68zS3kfPfb170aEiJqKaOEg==

@drumee/ui-runtime@0.1.0-alpha.1
    prepared commit: 75a67fb2efbbc0db69db54b5d3c08c49a8fccc20
    published:       2026-09-19T14:42:16.575Z
    shasum:          1fd9308470aead70e3537a626bff2862cf525257
    integrity:       sha512-dACvcMrviBOSoyv9/qb9PIVX/XrC1j4ru1F2PB1yRy6zoZiYvwQh30utlRRumR7nNeOrVziKrKcrjwEsqRXC6Q==
```

The published runtime tarballs exactly match their prepared standalone
repository commits. R1 accepted npm's mandatory `latest` metadata alias and is
closed.

The generic capability resolver validated in Phase 4.6B exists only in the
transitional runtime today. A later runtime extraction/release milestone must
synchronize it into standalone `server-runtime`; this packaging debt does not
block R2.

R2 validation:

```text
repository:       ~/github/system-mfs
package:          @drumee/system-mfs@0.1.0-alpha.1
source boundary:  transient@078e71378a52acd06478d9df556a7cd5b4d6a223
standalone commit: cd87db7085bc8dd40614af7fa37cdd1a76ffc5a0
publication:      not performed
authority:        standalone repository
integration copy: target/modules/system-mfs (verified synchronized fixture)
```

The extraction and validation evidence is recorded in
[`docs/refactoring/24-r2-system-mfs-extraction.md`](docs/refactoring/24-r2-system-mfs-extraction.md).
