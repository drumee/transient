# Phase 4.8 mfs-service provenance

Behavioral references are `drumee/server-team` at
`7fb16c449ed09258c501e88e3c87a4d71c51a941`, particularly
`service/media.js`, `service/private/media.js` and `acl/media.json`.

The module intentionally retains only semantic request orchestration,
operation authorization, committed-mutation description and recipient-safe
event projection. Filesystem algorithms belong to `@drumee/system-mfs`;
connection lookup, Redis and WebSocket transport belong to runtime adapters.
