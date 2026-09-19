# R1 — first npm runtime release

French audit report: [`22-r1-runtime-release-report.fr.md`](22-r1-runtime-release-report.fr.md).

R1 publishes the standalone R0 runtime repositories as public CommonJS
prereleases. It is a release milestone, not a feature phase, and does not add
platform bootstrap, MFS or application behavior.

## Release artifacts

| Package | Version | Prepared repository commit | Published (UTC) |
| --- | --- | --- | --- |
| `@drumee/server-runtime` | `0.1.0-alpha.1` | `e582f708ad85579d7c1238d361a32b5e486c08be` | `2026-09-19T14:42:05.963Z` |
| `@drumee/ui-runtime` | `0.1.0-alpha.1` | `75a67fb2efbbc0db69db54b5d3c08c49a8fccc20` | `2026-09-19T14:42:16.575Z` |

Both standalone repositories were clean and synchronized with `origin/main`
when validated. Their manifests declare public npm access and the `next`
prerelease tag. The release retains the R0/Phase 4.5 boundary and AGPL-3.0-only
license; neither package claims a stable API.

## Artifact identity

The registry metadata and a new local `npm pack --dry-run --json` at each
prepared commit report identical sizes, file counts, SHA-1 sums and SHA-512
integrities:

| Package | Files | Unpacked bytes | SHA-1 | SHA-512 integrity |
| --- | ---: | ---: | --- | --- |
| server runtime | 25 | 130197 | `2bd53842ebfaad72e63897ee0682d9ed7aba0264` | `sha512-665KKd9/qoLWSZxYz3yCfMr+5gQTyDapFj2T9kgj9ET+Ftu6PA5hLAJesJEGm8P68zS3kfPfb170aEiJqKaOEg==` |
| UI runtime | 21 | 129246 | `1fd9308470aead70e3537a626bff2862cf525257` | `sha512-dACvcMrviBOSoyv9/qb9PIVX/XrC1j4ru1F2PB1yRy6zoZiYvwQh30utlRRumR7nNeOrVziKrKcrjwEsqRXC6Q==` |

This proves that the public artifacts are the prepared repository contents,
not an unrecorded local variant.

## Validation evidence

The following checks passed on 2026-09-19:

| Check | Result |
| --- | --- |
| standalone `server-runtime` `npm test` | 34/34 pass, including packed clean-consumer and intrinsic-schema checks |
| standalone `ui-runtime` `npm test` | 22/22 pass, including packed clean-consumer and genuine Kind plugin handshake |
| clean registry install of `@drumee/server-runtime@0.1.0-alpha.1` | PASS with `NODE_PATH` disabled; required server exports load |
| clean registry install of `@drumee/ui-runtime@0.1.0-alpha.1` | PASS with `NODE_PATH` disabled; `Kind.loadPlugin` resolves a registered addon |
| `git diff -- sources/` in `transient` | empty |

The server install emits the transitive `yaeti@0.0.6` deprecation warning from
the pinned `websocket@1.0.35` dependency. That warning does not change the
validated artifact or authorize a dependency migration within R1.

## Registry tag constraint

Registry inspection currently reports both of these aliases for each package:

```text
latest: 0.1.0-alpha.1
next:   0.1.0-alpha.1
```

The intended prerelease alias is `next`, and it is present on both packages.
npm also models `latest` as mandatory package metadata. Because the alpha is
the sole published version of each new package, `latest` resolves to that same
artifact. Authenticated `npm dist-tag rm ... latest` requests were rejected by
the registry with HTTP 400; this is a registry constraint rather than a 2FA or
token failure.

Publishing a fabricated stable version solely to move `latest` would create a
false compatibility claim and is outside R1. Consumers must select the explicit
version or `next` while the API remains prerelease:

```bash
npm install @drumee/server-runtime@next
npm install @drumee/ui-runtime@next
```

R1 accepts and records the registry constraint and is closed. R1 closure still
does not itself authorize Phase 4.6 implementation.
