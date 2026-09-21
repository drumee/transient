# Phase 4.6A platform bootstrap

This private transitional control-plane component turns installed intrinsic
runtime schemas into a valid minimal Drumee platform. It is not a public
package or a final repository boundary.

The API deliberately separates `bootstrap()` (idempotent orchestration) from
`validate()` (read-only inspection). Bootstrap creates the default domain and
organisation registry row, the canonical nobody identity, and generated guest
and system identities. It neither creates user databases nor touches a
filesystem.

Callers provide either a `SqlPlatformStore` database adapter or an equivalent
store for tests. The database adapter must expose parameterized `await_query()`
or `query()` operations. Identity allocation uses the runtime-owned
`uniqueId()` SQL function; guest and system IDs are never constants.

The minimal persisted references are `sys_conf.nobody_id` and
`sys_conf.guest_id`. The system identity is uniquely resolved by
`drumate(username='system', domain_id=1)`. The legacy `public_id` alias is not
written because its only observed live consumer is Team room policy.
