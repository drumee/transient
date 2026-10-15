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
