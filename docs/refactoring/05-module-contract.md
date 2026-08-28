# Module Contract

## CURRENT

Backend modules use ACL JSON with service/scope/permission declarations and `modules.private/public` implementation paths (`sources/loby/acl/signup.json`). `server-team/router/rest/index.js::loadPlugins` reads configured ACL directories and registers them. Loby adds package identity/scripts, services and schemas, but runtime loading does not install schemas.

Frontend modules use a separate `index.json` entry resolved by `server-team/service/bootstrap.js::plugin`. `ui-core/letc/kind/index.js::loadPlugin` loads that JS; signin's seeds map kind IDs to imports and its entry calls `Kind.registerAddons`. Locales/assets/build are package-specific.

Deployment supplies a third lifecycle: `sources/debian/bin/drumee-plugin` installs source from Git/local/archive, runs npm install, lists/removes and toggles `.disabled`. It does not prove UI/schema integration, compatibility checks, transactional upgrade or rollback. `sources/cli` has no module commands.

## STANDARDIZE

Normalize existing concepts into one descriptor, retaining adapters for ACL, UI index, seeds and Debian layouts:

```yaml
identity: stable-id
name: display-name
version: semver
compatibility: { runtime: range, contracts: range }
dependencies: []
backend: { acl: [], services: [] }
schemas: { databaseClasses: {}, install: [], migrations: [] }
frontend: { entry: path, kinds: [], windows: [], locales: [], assets: [] }
lifecycle: { install: declarative-step, upgrade: declarative-step }
```

The smallest shared contract is metadata, artifact locations, compatibility, dependencies and state. Runtime, schema provisioner, distribution builder, CLI and deployment may use separate adapters.

## ADD

Add integrity/provenance, dependency/conflict/order rules, installed vs enabled state, endpoint/tenant scope, idempotent schema ownership, permissions/capabilities, health hooks, rollback metadata and explicit install/upgrade/enable/disable/remove data-retention semantics.

## DEPRECATE

Only after adapters exist: split backend/UI discovery, mutable installs without integrity, `.disabled` as the sole state, implicit schema ownership and package scripts as lifecycle contracts.

Future CLI lifecycle is `INVESTIGATE`. The command/resource/backend seam can present it, but no functioning API backend or stable lifecycle API exists. The stable implementation should be authenticated, audited and transactional—not direct DB writes.
