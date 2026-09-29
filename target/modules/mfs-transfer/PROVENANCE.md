# Phase 4.8 mfs-transfer provenance

Behavioral references are `drumee/ui-team` at
`17d1d4a03a135c33b44bbb22054fa2d140bbc1a6` (`media/chunked.js`) and
`drumee/server-team` at `7fb16c449ed09258c501e88e3c87a4d71c51a941`
(`service/lib/chunked-upload.js`, `service/lib/archive.js`, and
`offline/media/download.js`).

This module owns temporary transfer state and archive jobs only. Final MFS
metadata/content is committed through mfs-service and system-mfs.
