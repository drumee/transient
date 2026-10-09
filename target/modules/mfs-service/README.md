# Phase 4.8 mfs-service

This private integration module owns semantic MFS validation and orchestration
after the runtime ACL has granted access, orchestration of the authoritative
standalone `system-mfs`, affected scopes, recipient-safe event projections and
invocation of an injected runtime push adapter. Its permission backend maps a
service input to source/destination logical nodes and supplies
`system-mfs.user_permission()` results. The generic runtime ACL alone compares
those effective permissions with the descriptor and owns final GRANTED/DENIED.

Trusted uid and Hub contexts come from runtime authorization before worker
construction. The permission backend never selects an identity or returns a
Hub authorization decision. Client uid, principal and physical shard locators
are ignored. Cross-Hub operations retain separately authorized source and
destination contexts. Event publication accepts a current-rights callback so
revoked recipients are filtered before projection. It owns neither filesystem
algorithms nor WebSocket/Redis connection routing.
`remove` is a hard filesystem deletion; trash and changelog are excluded.
