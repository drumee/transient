# Phase 2 UI runtime extraction

This private CommonJS workspace is the smallest browser/runtime seam needed for
the next independent module slice. It is neither a public package nor a final
repository boundary.

The runtime owns the non-MFS LETC bootstrap, static Skeleton/Widget catalog,
Kind/addon coordination, logical plugin loading, and the genuine historical
Backbone/Marionette Widget ancestry required before a plugin loads. It retains
only the data/identity boundary of Host, Visitor and Organization. Generic
transport and script-loading facilities remain injectable; this workspace does
not declare `@drumee/ui-essentials` because it currently consumes no Essentials
export. No Team globals, MFS, Finder, Desktop, Window Manager or media kinds
are imported.

## Phase 4.5 export boundary

The private `npm pack` artifact contains `src/` (including the CommonJS
browser entry and retained SCSS), this README and provenance. It deliberately
excludes tests, monorepo sources, Team code, generated bundles and temporary
artifacts. Webpack build behavior remains owned by the separate transitional
`ui-build` workspace; this package does not turn build metadata into a runtime
manifest.

Its name and boundary remain transitional. This is not a public package API or
a publication commitment.
