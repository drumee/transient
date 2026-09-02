# Phase 2 UI runtime extraction

This private CommonJS workspace is the smallest browser/runtime seam needed for
the next independent module slice. It is neither a public package nor a final
repository boundary.

The runtime owns the non-MFS LETC bootstrap, static Skeleton/Widget catalog,
Kind/addon coordination, logical plugin loading, a class-based render host,
and data-only Host/Visitor/Organization context. Generic transport and
script-loading facilities remain injectable; this workspace does not declare
`@drumee/ui-essentials` because it currently consumes no Essentials export.
No Team globals, MFS, Finder, Desktop, Window Manager or media kinds are
imported.
