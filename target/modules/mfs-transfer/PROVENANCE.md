# Phase 4.8 mfs-transfer provenance

Behavioral references are `drumee/ui-team` at
`17d1d4a03a135c33b44bbb22054fa2d140bbc1a6` (`media/chunked.js`) and
`drumee/server-team` at `7fb16c449ed09258c501e88e3c87a4d71c51a941`
(`service/lib/chunked-upload.js`, `service/lib/archive.js`, and
`offline/media/download.js`).

This module owns bounded temporary transfer state and offline archive jobs
only. Final MFS metadata/content is committed through mfs-service and
system-mfs. The historical offline worker and FileIo/Nginx split is preserved:
the HTTP worker retains metadata and worker handles, never whole archive data.
