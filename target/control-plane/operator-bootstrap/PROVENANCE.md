# KB-01 evidence provenance

All new probe code and documentation are AGPL-3.0-only. No historical source,
schema or copyright notice was copied into production code or changed.

| Input | Exact revision / artifact | Role |
|---|---|---|
| transient / refactor/mapping | `4f6919f8248dc733dff16ee355cdef5b93ebf252` | Approved starting checkout; existing platform bootstrap, Hub lifecycle, transitional runtime and IL-3 fixture |
| drumee/server-runtime / main | `fc7d9de3f3e63baea8258885e55efe8e242904d0` | Inspected canonical implementation; immutable npm alpha.3 consumed by the probe |
| @drumee/server-runtime | `0.1.0-alpha.3`, `sha512-lW7hwEB+ruJ+6k9H2Z3U+c65WbQfdKyDjLGaUbzucP+A+dH7qlLS2W7gC17YhgOu0E8s24QGPjpf9w1B6gIWzg==` | Actual SQL/session/authorization/dispatcher exports and schema manifest |
| drumee/server-core | `bf7c396b14614f247507f771f72e98184ed931b4` | Immutable `lib/acl.js::check_remit`, historical plateform scope |
| drumee/schemas | `cb838e255600a4ec3797dc7ac13659ad9d187421` | Immutable drumate.remit and directory/get_remit.sql evidence; not installed |
| drumee/server-essentials | `b9460ba442c9962471a592c49ce36b01e0327ff5` | Immutable remit/permission/constants distinction; test-only imports |
| MariaDB image | `mariadb@sha256:611a2fcc5fa7c6ceb8644c6f74b25ede004ff6c3a6b38c8f8c23d3bbf6c26430` | Existing IL-3 pinned engine, new disposable tmpfs instance |
| mariadb connector | `3.5.4`, SRI in package-lock.json | Dedicated-connection parameterized test adapter |

The integration probe installs only the actual runtime package's manifest SQL
and invokes the existing platform bootstrap. Test-only INSERTs create active
human counterexamples with domain words 63/127; they are deliberately not named
or returned as PLATFORM_ADMINISTRATOR enrollment. Real canonical login succeeds,
but platform dispatch fails closed. No authentication or privilege bypass was
implemented to turn that result into a pass.

Test checkpoint: `87a869eed880dbce656e04c592ffd09ad3c2d291`.
The implementation boundary and regression evidence are recorded in report 39.

## KB-01A canonical correction and integration

Starting transient revision: `53432be57421147a3b282b4258f48507edb34913`,
branch `refactor/mapping`. Integration checkpoint:
`6033269963323dbc1b6c4360d3bbe53f99b26784`.

| Input | Immutable revision / integrity | Role |
|---|---|---|
| drumee/server-runtime / main | `a6c4dbf24b036255ea0dbfe70dbe80a402c990b0` | Canonical correction; implementation commit `bfcbf66ecdef9d0ed1a3be054ed9c60329894b3c` |
| Corrected runtime source archive | `sha512-Yyasa5Wm7PNh+jgBn0lk7JCIlUMoSIERT+4z/anIKNYDH4HbSmJ0p0uYocHM7gbd1su4dkrtbyEXD+Q14ruP6w==` | Main development test dependency; same package metadata alpha.3, different explicit source artifact from registry |
| Legacy runtime alias | `npm:@drumee/server-runtime@0.1.0-alpha.3` | Preserves original KB-01 diagnostic, not the corrected integration |
| drumee/system-mfs | `53101c4a995ffca9118f795ab5d4c7c731200a2f` | Source archive pinned in lock; actual SQL/module provision and ACL backend |
| Existing transient bootstrap, hub-lifecycle, mfs-service | unchanged files from starting transient revision | Actual control-plane and MFS integration inputs, not alternate implementations |

The new test is an integration composition only. Human INSERTs and grant
changes are disposable SQL setup, not an enrollment API. Hub creation uses
normal authenticated sessions and a `can_create` policy invoking the canonical
PlatformAuthorizer. Cross-Hub denial is exercised through the real dispatcher,
Hub resolver, MFS permission backend and SQL. No permissive runtime fallback
or module/schema change was introduced. Report 40 records full test evidence.


## KB-01B canonical enrollment

Starting transient: `7c2e3b0a3ea5d75623c67faa123e48d6eb9b1052`.
Runtime: published `@drumee/server-runtime@0.1.0-alpha.4`, gitHead
`f961f6214432c2e6dbbcde2b926544c076935950`, integrity
`sha512-bOZ/v6/4mQ/FPa8iE21polPx2PjJWFYTKqTz+2duqxI2ljpviemNgOtpwkxF4j/1Xn/1aVIxdvVCc8Tch2ctEQ==`.
No local runtime implementation or older alpha fallback is used.

New enrollment/store/validation/credentials code and singleton schema are
focused AGPL-3.0-only control-plane implementations. Identity INSERT shape is
derived from existing platform bootstrap store and current intrinsic schema;
human identity uses personal/active, Domain privilege 1, separate remit 15.
Fingerprinting reuses unchanged session_signin SHA2(password,512) semantics.
Reserved identity semantics are not copied onto humans. All transaction DML
uses the same native MariaDB connection. Runtime, bootstrap, Hub and MFS
implementations remain unchanged; first Hub-probe owner now uses canonical
enrollment, additional counterexamples remain disposable SQL test setup.

Historical blocked evidence above remains provenance, not current module
status. See report 41 for fixture acquisition, commits and qualification.


Final enrollment source projected by the fixture:
`4424fde877eb12a719d6057449ba11aa245244fd`. This revision enforces immutable
durable providers and refuses credential regeneration when a completed SQL
marker exists but the private resource is missing. Qualification fixture:
`d15d70179a13064fcf50bcfa89152afed771a7bc`. The independent final clone passes
18 unit, 31 real-SQL TAP and real-PTY checks; full fixture passes 28 grouped
functional checks across fresh/restart/restore with three Chromium runs.
All existing applicable regressions are preserved (218 total TAP passes,
zero failures/skips). See report 41 and its sanitized validation JSON.
