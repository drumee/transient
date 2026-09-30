# Phase 4.8 mfs-transfer

This private integration module owns temporary upload staging, resumable chunk
sessions, integrity checks, recursive archive jobs and requester-scoped
progress/cancel/retrieve/release operations.

Its only semantic filesystem dependency is `mfs-service`. Upload commits and
authorized download manifests pass through that service; it does not create final MFS
metadata, publish MFS mutation events or call `system-mfs` directly.

Input-owned upload tempfiles become transfer-owned only after successful
adoption into staging. Success, failure, cancellation and abandonment cleanup
remove transfer staging but never canonical committed content. `payload_ref`
is internal and is not returned by the public service or push contracts.
