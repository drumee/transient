# Hello kernel validation module

`hello` is the sole Phase 3 synthetic module. It proves that the extracted
Drumee kernel can dynamically load an independent plugin and dispatch an
anonymous service without Team, MFS, schemas or a database.

- Backend method: `hello.ping`
- ACL: `permission: { src: "anonymous", fast_check: "public-api" }`
- Frontend kind: `"hello"`
- Plugin flow: `Kind.loadPlugin` → `bootstrap.plugin` → `index.json` → bundle
  → `Kind.registerAddons`
- UI: real `LetcBox` Widget using `Skeletons.Note`

The integration build is run by `scripts/test-env/kernel/test.sh`; the complete
browser proof is `node --test tests/integration/kernel/hello-browser-e2e.test.js`.

Non-goals: MFS, MariaDB, schemas, provisioning, Finder, Window Manager, Team
runtime behavior, application lifecycle design and marketing functionality.
