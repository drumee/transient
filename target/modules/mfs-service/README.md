# Phase 4.8 mfs-service

This private integration module owns semantic MFS validation and orchestration
after the runtime ACL has granted access, orchestration of the authoritative
standalone `system-mfs`, affected scopes, recipient-safe event projections and
invocation of an injected runtime push adapter. Its ACL adapter connects
declarative service permissions to `system-mfs` effective-permission
primitives; it does not define a second permission policy.

Trusted uid and current-hub context come only from Session. Client uid,
principal and physical shard locators are ignored. It owns neither filesystem
algorithms nor WebSocket/Redis connection routing.
`remove` is a hard filesystem deletion; trash and changelog are excluded.
