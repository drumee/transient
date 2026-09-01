# Module Contract

## CURRENT

Backend modules use ACL JSON with service/scope/permission declarations and `modules.private/public` implementation paths (`sources/loby/acl/signup.json`). `server-team/router/rest/index.js::loadPlugins` reads configured ACL directories and registers them. The runtime owns generic registration, dispatch and evaluation; each module owns its service-specific policy declarations. Loby adds package identity/scripts, services and schemas, but runtime loading does not install schemas.

Frontend modules use a separate `index.json` entry resolved by `server-team/service/bootstrap.js::plugin`. `ui-core/letc/kind/index.js::loadPlugin` loads that JS; signin's seeds map kind IDs to imports and its entry calls `Kind.registerAddons`. Locales/assets/build are package-specific.

Deployment supplies a third lifecycle: `sources/debian/bin/drumee-plugin` installs source from Git/local/archive, runs npm install, lists/removes and toggles `.disabled`. It does not prove UI/schema integration, compatibility checks, transactional upgrade or rollback. `sources/cli` has no module commands.

## STANDARDIZE — initial kernel

Preserve, document and test the two existing discovery contracts before attempting to normalize metadata:

```text
backend:  acl/*.json → registered descriptor → module.method dispatch
frontend: index.json → bootstrap.plugin → { path } → bundle → Kind.registerAddons
```

The generic backend side is `sources/server-team/router/rest/index.js::{loadPlugins,getModule,run}`: ACL descriptors are registered at startup, then a request selects public/private implementation, lazy-loads/caches its worker and executes only after authorization. The generic frontend side is `sources/ui-core/letc/kind/index.js::{loadPlugin,registerAddons}` paired with `sources/server-team/service/bootstrap.js::plugin`: an installed plugin's `index.json` entry resolves to a bundle URL, whose execution registers addons.

The first standard shared vocabulary is only logical identity, artifact location and independently declared compatibility. It must not replace either on-disk descriptor in the first `server-runtime`/`ui-runtime` iteration. Runtime, provisioner, deployment and later control plane may use separate adapters.

Module ACL entries declare policy to the host but do not become OS policy. Secure-share policy remains unclassified; billing/over-limit policy belongs to Team or a separately approved policy module.

## ADD — after `hello` proves the vertical slice

Investigate integrity/provenance, dependency/conflict/order rules, installed vs enabled state, endpoint/tenant scope, idempotent schema ownership, permissions/capabilities, health hooks, rollback metadata and explicit install/upgrade/enable/disable/remove data-retention semantics. A future shared descriptor may contain those concepts, but it is not designed or introduced before `hello` validates the current backend/frontend handshake.

## DEPRECATE — only after adapters and evidence exist

Only after adapters exist: mutable installs without integrity, `.disabled` as the sole state, implicit schema ownership and package scripts as lifecycle contracts. Do not deprecate the separate ACL JSON and frontend `index.json` contracts merely to make them look uniform.

Future CLI lifecycle is `INVESTIGATE`. The command/resource/backend seam can present it, but no functioning API backend or stable lifecycle API exists. The stable implementation should be authenticated, audited and transactional—not direct DB writes.

## Reference implementation analysis

### `sandbox-server`

This is a loadable backend plugin by current convention: `package.json` supplies `register-plugin`/`remove-plugin`; `acl/sandbox.json` maps five hub-scoped, public-api services to `service/index`; the implementation extends `server-core::Entity`. It therefore validates ACL-driven dispatch and runtime base-class injection.

It is not a safe canonical lifecycle example. `sandbox.create` can allocate a domain and multiple accounts/hubs through `service/lib/organization.js` and `drumate.js`; `service/lib/mfs.js` downloads/imports content and creates cross-hub links; `sandbox.remove` delegates destructive cleanup and emits Redis/WebSocket progress. All five ACL entries accept `anyone` with public-api fast checks. Its SQL is application-owned but heterogeneous: `schemas/tables/**` and `procedures/**` define a `sandbox` database contract, while `schemas/avatar.sql` is a combined dump/seed file. Existing scripts do not declare schema installation, version compatibility, upgrade, enabled state or cleanup policy.

Standardize: ACL/service co-location, explicit service identity and application-owned schemas. Do not standardize: public provisioning authority, duplicated entity/MFS orchestration, combined dump files, or package scripts as the lifecycle contract. Classification: sandbox feature `INVESTIGATE`; the generic mechanisms it exercises retain their independent classifications.

### `sandbox-ui`

`index.html` loads `/-/svc/bootstrap.js` and a standalone hashed application bundle. `app/bootstrap.js` waits for `drumee:router:ready`, registers `sandbox_user`, registers the top-level `sandbox` kind and feeds it into `uiRouter`'s body. `app/index.js` calls `sandbox.create/get_env/subscribe_me/remove`, stores demo state in localStorage and consumes `sandbox.progress` WebSocket events. Locale, skeleton and skin trees are local; webpack produces the standalone entry from environment-derived paths.

This is evidence for a hosted standalone Drumee application, not evidence for the deployed `Kind.loadPlugin`/UI `index.json` contract: no UI plugin manifest or install/remove scripts exist. It relies on host globals (`Kind`, `uiRouter`, `LOCALE`, `Visitor`, `Butler`, `Drumee`) without declaring compatible host versions. Standardize the notion of a frontend entry, kinds, locales/assets and readiness requirement; add explicit host compatibility and service dependencies. Classification: demo application `INVESTIGATE`.

### `loby`

Seven ACL documents independently map service families: anonymous Apple/Google initiation/callback; anonymous OAuth OTP; owner-only invite acceptance; anonymous signup and onboarding; owner-only plan upgrade. Private/public module paths are explicit except `invite`, which is private only. Service classes use `Entity` directly or the shared `service/lib/loby.js::Account` base.

Loby crosses several ownership boundaries. `Account.create_account` calls yp `drumate_create` and session signin; OAuth uses provider credentials and yp OAuth/session tables; invite grants permission in both user and hub shard databases; plan upgrade creates domains/organizations. Onboarding obtains its application DB from `Cache.getSysConf('ob_conf')`, owns tables/procedures/migrations, updates yp user profiles and calls a separately configured reward database. Templates and Messenger provide email behavior. This supports splitting loby into entry/auth, onboarding, invitations and Team/policy capabilities rather than standardizing the repository as one module.

Schema lifecycle is partly represented by `schemas/patches/manifest.txt`, migrations and patch scripts, but package version is `0.0.0` and metadata points to `analytics-server`. There is no descriptor tying ACL, schemas, credentials, sysconf keys, reward dependency or frontend signin version together. Classification: signin/signup/OAuth candidate `SYSTEM_MODULE`; onboarding `SYSTEM_MODULE` or distribution policy `INVESTIGATE`; plan/organization upgrade `TEAM_MODULE`/policy; exact split requires compatibility tests.

### `signin`

Signin is a frontend-only package. `src/seeds.js` exports import promises for `signin_router`, `signin_form`, and `signin_guest`; `src/index.js` loads toolkit widgets and registers seeds immediately for a completed document or on `drumee:plugins:ready`/`drumee:router:ready`. The router handles sign-in, guest landing and Loby OAuth-MFA hash handoff (`src/widgets/router/index.js`). Locales, widgets, assets and styles are package-local.

The package's real host contract is implicit: it depends on global LETC classes, `Kind`, `Visitor`, `LOCALE`, routing/hash conventions and Loby/server service names, but `package.json` declares only ui-toolkit/ui-styles at runtime. Its setup script does identify build type `plugin` and name `signin`; webpack derives public/output paths from `UI_*`, endpoint and build-target environment. No generated `index.json` is present in source, so its producer and relationship to server bootstrap discovery remain `INVESTIGATE`. Classification: `SYSTEM_MODULE`.

### `marketplace`

The reachable contract comprises `acl/onlyoffice.json` and `acl/euroffice.json`, mapped to matching service classes. Both extend `server-core::Mfs`, render an editor host page, sign/verify JWTs from credential files, resolve node authorization, serve original content to a third-party editor callback, update MFS metadata/content and notify sockets. EurOffice additionally exposes preload/save-as/retitle and contains secure-share-specific handling. `docker-compose.yaml` is a local OnlyOffice deployment example with direct read-only MFS mounting, not module lifecycle metadata.

This is strong evidence that modules need declared external services, secrets, callbacks, public endpoints, MFS capabilities and host service dependencies. Anonymous callback/read ACL does not mean authorization is absent: service code validates JWT/HMAC and calls `mfs_access_node`. Those service-specific policies remain with the module, outside the generic ACL engine.

Identity is unreliable: `package.json` names the package `@drumee/loby`, describes onboarding and points to analytics-server. The source has no schemas directory. `service/lib/payment.js` requires Stripe, a configured payment DB and yp quota/profile procedures, but neither ACL maps to it and Stripe is absent from dependencies. It is therefore `INVESTIGATE`, not proven current marketplace behavior. Office integration is a `SYSTEM_MODULE` candidate; secure-share integration and deployment ownership require separate decisions.

### `onboarding-server`

This backend plugin maps `analytics` (read-scoped traffic/user/email operations) and anonymous public-api `onboarding` services. Analytics reads a filesystem traffic feed and a plugin database; onboarding takes its DB from `ob_conf`. However, `check_completion` and `mark_complete` call the literal shard `1_c1d86df0c1d86df7`, while other methods use `this.app_db`, proving a historical database-layout assumption.

It overlaps loby rather than providing an independent clean contract. Ten SQL filenames overlap: two are identical and eight have diverged. Loby's onboarding service adds signup info, industry/role/team-size/intent/challenges, profile update, referrals/invites and activation state, and replaces the hard-coded DB calls. `onboarding-server` package identity is `@drumee/analytics-server`, consistent with its repository metadata but broader than its onboarding role. It is classified `LEGACY`: loby is the confirmed successor. Its value in this mapping is compatibility, data-migration and schema-lineage evidence, not a target module implementation.

### `onboarding`

This repository is not a Drumee plugin. It serves static HTML and ES modules, loads layout partials and JSON data with browser `fetch`, compiles Sass and links to external Drumee signup routes. It has no ACL, runtime entry, service dependency or module lifecycle. The source tree includes newer `src/pages/new`, `src/js`, `src/data`, partials and page Sass, while `package.json` build scripts compile only the older `home.scss` and `features.scss`; the README describes directories that do exist deeper in the tree but the build does not cover them.

Treat it as a separate marketing/documentation/pricing web property, not as evidence for the runtime module loader. It is excluded from the target runtime, module catalog and distributions. The baseline copy must remain immutable even though no target counterpart is proposed.

## Cross-reference conclusions

The patterns worth standardizing are ACL-to-service declaration, frontend entry/kind declaration, local assets/locales, owned schema/migrations, host compatibility and explicit external requirements. Historical inconsistencies are stale/duplicate package identities, implicit host globals, hard-coded database names, overlapping schema forks and lifecycle scripts detached from schemas/UI. Missing capabilities are a unified identity, compatibility/dependency graph, artifact integrity, declared config/secrets/external services, schema target/lineage, enable state, upgrade/rollback and coordinated frontend/backend installation.
