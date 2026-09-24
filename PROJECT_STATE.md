# Project state

```text
Project:
    Drumee Minimal Kernel Refactor

Current:
    Phase 4.5 CLOSED
    R0 CLOSED
    R1 CLOSED
    Phase 4.6 CLOSED
    Phase 4.6A platform bootstrap IMPLEMENTED / VALIDATED
    Phase 4.6B system-mfs IMPLEMENTED / VALIDATED

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
    explicit authorization for Phase 5 Marketing
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

R0 does not publish npm packages and does not authorize Phase 4.6.

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

The published tarballs exactly match `npm pack --dry-run` at the prepared
standalone commits. Both standalone test suites pass and fresh registry
consumers load the expected server API and UI plugin handshake with
`NODE_PATH` disabled.

Both packages expose the intended `next` alias. npm also requires every package
to have `latest` metadata; because each runtime has only one published version,
`latest` resolves to the same `0.1.0-alpha.1` artifact. Authenticated deletion
was rejected by the registry with HTTP 400. R1 accepts this registry constraint
rather than publishing an artificial stable version solely to move the alias.

R1 and Phase 4.6 are closed. Phase 5 Marketing requires explicit
authorization.
