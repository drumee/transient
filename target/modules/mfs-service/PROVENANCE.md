# Phase 4.8 mfs-service provenance

Behavioral references are `drumee/server-team` at
`7fb16c449ed09258c501e88e3c87a4d71c51a941`, particularly
`service/media.js`, `service/private/media.js` and `acl/media.json`.

The module intentionally retains semantic request orchestration after ACL
GRANTED, a narrow runtime permission backend, committed-mutation description
and recipient-safe event projection. The backend resolves logical source and
destination resources and exposes effective MFS privilege computed by the
shard's `user_permission()` function. Descriptor comparison and final
GRANTED/DENIED remain exclusively runtime-owned. Filesystem algorithms
belong to `@drumee/system-mfs`; connection lookup, Redis and WebSocket
transport belong to runtime adapters.
