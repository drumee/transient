# Phase 4.8 host-filesystem provenance

Architectural references are the pinned `server-core` `lib/utils/mfs.js` and
`lib/file-io.js` implementations and pinned setup-infra internal Nginx routes.
This extraction intentionally exposes a smaller adapter: opaque canonical
content lookup, explicit representation locations, confined artifact
operations and FileIo headers. Physical paths never enter public MFS DTOs.
