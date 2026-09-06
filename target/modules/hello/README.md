# Hello kernel validation module

`hello` is the sole Phase 3 synthetic module. It proves that the extracted
Drumee kernel can dynamically load an independent plugin and dispatch both an
anonymous service and one Domain-scoped private service without Team, MFS,
Hub shards or provisioning.

- Backend method: `hello.ping`
- ACL: `permission: { src: "anonymous", fast_check: "public-api" }`
- Private backend method: `hello.private`
- Private ACL: `scope: "domain"`, `permission: { src: "read" }`; it requires
  a real Yellow Page `regsid` session and `domain_permission` grant.
- Frontend kind: `"hello"`
- Plugin flow: `Kind.loadPlugin` → `bootstrap.plugin` → `index.json` → bundle
  → `Kind.registerAddons`
- UI: real `LetcBox` Widget using `Skeletons.Note`

The integration build is run by `scripts/test-env/kernel/test.sh`; the public
browser proof is `node --test tests/integration/kernel/hello-browser-e2e.test.js`.
The private authentication/ACL proof is
`node --test tests/integration/kernel/phase4-authenticated-private.test.js`.

`hello` remains a validation module, not a product. Non-goals: Hub/MFS,
Finder, Window Manager, provisioning, Team runtime behavior, application
lifecycle design and marketing functionality.
