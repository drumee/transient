# Phase 2 UI runtime extraction

This private CommonJS workspace is the smallest browser/runtime seam needed for
the next independent module slice. It is neither a public package nor a final
repository boundary.

The runtime owns only Kind/addon coordination, logical plugin loading, a
minimal render host, and data-only Host/Visitor/Organization context. Generic
transport and script-loading facilities are injected from the host (normally
`@drumee/ui-essentials`); no Team globals, MFS, Finder, Desktop, Window Manager
or media kinds are imported.
