# Phase 4.8 media-service boundary

This private module keeps originals and derived representations distinct.
`media.orig` always resolves canonical stored content. `preview`, `thumb`,
`document` and `video` are explicit allowlisted representations with reusable
artifacts; clients cannot name a generator or physical path.

Long-form video may create HLS progressively through a finite tracked worker.
Node may read and rewrite the small master/stream playlists, while segments
and every other heavy artifact pass through FileIo and Nginx.
