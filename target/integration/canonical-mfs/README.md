# Canonical MFS integration composition

This CommonJS host composition wires the existing MFS service, transfer,
media, filesystem, SQL store and server-runtime descriptor/authorization APIs.
It imports no application code. It is an integration boundary, not an MFS
implementation or a published package. P0-02R-B is its first consumer.

`createCanonicalMfs(options)` receives the actual `runtime`, `system_mfs`,
`database`, official `hub_store`, `session_manager`, canonical permission
constants/converter, manifest `system_mfs_schema_version`, absolute server-only
artifact/content/staging/incoming roots and optional native descriptor registry and
application capability providers. It returns the dispatcher, stores/services,
registry, `createServer(options)` and `destroy()`.

The caller provisions platform identities and hubs through their existing
control-plane owners before serving requests. Capability checks read the
official SQL `hub_capability` status and applied version, for every authorized
Hub context. A filesystem instance resolves only shards matching the runtime's
authorized context; physical input from the browser is not consulted.

Upload metadata is authorized before receiving bytes, then authorized again
by native dispatch. Transfer ownership, staging bounds and integrity remain
owned by MfsTransferService. FileIo returns an internal Nginx redirect; the
caller must mount the native artifact root in Nginx and keep that location
`internal`. Expose only the native service route through the trusted proxy.
The content resolver maps canonical content references inside that root;
transfer archives remain under its separate staging directory. Store content
and SQL outside the checkout; do not erase volumes at teardown.

The generic media/transfer Workers previously dropped the injected Hub context.
They now forward it, and MediaService passes it as the resolver's second
argument. Existing one-argument resolvers remain compatible. These changes are
covered by `node --test target/integration/canonical-mfs/context.test.js`.

No event transport is silently fabricated. With no push transport configured,
MfsEventPublisher uses its existing no-delivery path; this composition qualifies
explicit HTTP navigation only. A future live sync host must supply real push
transport and recipient reauthorization, not an in-memory Redis substitute.

Provenance: composition of `target/modules/{mfs-service,mfs-transfer,media-service,
host-filesystem}` at Transient `59985d4a78e142b64f5976cc7460a723cca29a79`;
standalone System MFS `53101c4a995ffca9118f795ab5d4c7c731200a2f`; injected
Server Runtime `0.1.0-alpha.3` from the Oxymotion lockfile. Hub Lifecycle stays
at consumer-pinned `5e3964d832951a55d92ed6a9c88c25a742ebc457`, not the moving
control-plane checkout. No schema, source import or runtime version is changed.
This adds neither binary snapshots nor a probatory revision contract.
