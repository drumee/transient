# Phase 2 UI build extraction

This is a private, transitional CommonJS Webpack configuration and build
metadata workspace. It is not a final public package or repository boundary.

It retains the selected Drumee build contract: CommonJS resolution, SCSS/CSS,
assets, hashed bundles, and `index.json` build metadata. It does not copy
historical application aliases, app-specific sync/deploy scripts, or rsync
behaviour. The separate application `manifest.json` remains a server runtime
input and is intentionally not produced or merged here.
