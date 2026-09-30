# Phase 4.8 mfs-service provenance

Behavioral references are `drumee/server-team` at
`7fb16c449ed09258c501e88e3c87a4d71c51a941`, particularly
`service/media.js`, `service/private/media.js` and `acl/media.json`.

The module intentionally retains semantic request orchestration after ACL
GRANTED, a narrow runtime ACL adapter, committed-mutation description and
recipient-safe event projection. The adapter uses declarative source and
destination permissions and trusted Session uid; effective MFS privilege is
computed by the shard's `user_permission()` function. Filesystem algorithms
belong to `@drumee/system-mfs`; connection lookup, Redis and WebSocket
transport belong to runtime adapters.
