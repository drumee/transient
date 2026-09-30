# Phase 4.8 host-filesystem boundary

This private integration module is the only Phase 4.8 boundary that maps an
opaque MFS content reference or a known derived representation to a confined
physical artifact. Public callers retain only `{hub_id,nid}`. Paths are
root-confined, safety locks are honored, and cross-filesystem moves use an
explicit copy/remove fallback.

`FileIo` validates the artifact and emits delivery metadata including
`X-Accel-Redirect`, content length/type/disposition and range support. It does
not read or return the payload; Nginx is the heavy-byte data plane.
