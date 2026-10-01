# Phase 4.8 mfs-transfer

This private integration module owns temporary upload staging, resumable chunk
sessions, integrity checks, recursive archive jobs and requester-scoped
progress/cancel/retrieve/release operations. Archive preparation always runs
in a finite child process using filesystem references; neither source files nor
the completed ZIP are accumulated as a Node Buffer in the HTTP process.

Its only semantic filesystem dependency is `mfs-service`. Upload commits and
authorized download manifests pass through that service; it does not create final MFS
metadata, publish MFS mutation events or call `system-mfs` directly.

The completed archive is an internal filesystem artifact. `download_retrieve`
passes it to FileIo, which emits `X-Accel-Redirect`; Nginx owns byte delivery.
Transfer maps have a fixed capacity and TTL, and cancellation, failure,
release, expiry and service destruction terminate workers and clean staging.

Input-owned upload tempfiles become transfer-owned only after successful
adoption into staging. The server chooses chunk geometry, creates one sparse
payload file and streams each tempfile into `index * chunk_size`; out-of-order
and repeated indexes therefore replace only their own bounded range. Completion
checks every index and size, hashes the staged file sequentially, and hands an
internal `payload_ref` to mfs-service/system-mfs without an assembly pass.
Success, failure, cancellation and abandonment cleanup remove transfer staging
but never canonical committed content. Physical paths and `payload_ref` are
never returned by public service or push contracts.
