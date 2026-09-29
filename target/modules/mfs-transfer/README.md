# Phase 4.8 mfs-transfer

This private integration module owns temporary upload staging, resumable chunk
sessions, integrity checks, recursive archive jobs and requester-scoped
progress/cancel/retrieve/release operations.

Its only semantic filesystem dependency is `mfs-service`. Upload commits and
download authorization pass through that service; it does not create final MFS
metadata, publish MFS mutation events or call `system-mfs` directly.
