# Phase 4.8 mfs-service

This private integration module owns semantic MFS operations, principal and
operation authorization, orchestration of the authoritative standalone
`system-mfs`, affected scopes, recipient-safe event projections and invocation
of an injected runtime push adapter.

It owns neither filesystem algorithms nor WebSocket/Redis connection routing.
`remove` is a hard filesystem deletion; trash and changelog are excluded.
