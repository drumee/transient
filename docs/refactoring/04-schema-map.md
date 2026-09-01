# Schema Map

Inventory: about 269 files in `common`, 714 in `yellow_page`, 108 in `hub`, and 194 in `drumate`. Placement is not ownership proof.

The proposed-ownership column classifies schema responsibilities and data contracts, not whole directories or current SQL files. Mixed files and procedure families require finer-grained dependency analysis before any extraction.

| Family | Consumers / evidence | Proposed ownership |
|---|---|---|
| Entity/domain/vhost/shard registry | yp `entity`, `domain`, `vhost`, `drumate`, `hub`; `get_entity/get_db_name/get_user/get_hub` used by runtime/setup/CLI | `KEEP_OS` responsibility; exact objects `INVESTIGATE` |
| Authentication/session/generic ACL evaluation | yp auth/session; common permission + `acl_check` used by core | `KEEP_OS` responsibility; exact engine objects `INVESTIGATE`; service policies stay with services |
| MFS/media/version/permission/trash | `common/tables/{media,file_version,permission,trash_media}.sql`, `mfs_*.sql`; server-core/CLI | `KEEP_OS` responsibility; exact objects `INVESTIGATE` |
| Provisioning/templates/factory | yp entity/drumate creation, `templates/factory`, setup-schemas | OS contract + deployment; daemon details `INVESTIGATE` |
| Base membership | hub member/remove/show and drumate join/leave/show hubs | Minimal hosting subset; exact cut `INVESTIGATE` |
| Chat/channel/P2P | common channel, hub channel, drumate p2p tables/procedures | `TEAM_MODULE` |
| Tasks | `common/tables/task*.sql`, `common/procedures/task_*.sql` | `TEAM_MODULE`; misplaced in common |
| Meetings/rooms/conference | yp conference/meeting/room and hub meeting routines | `TEAM_MODULE` |
| Contacts/address book | yp contact and drumate contact/my_contact routines | `TEAM_MODULE` or `SYSTEM_MODULE`: `INVESTIGATE` |
| DMZ/secure sharing | yp secure_share/dmz plus hub dmz routines | Secure-share policy and exact engine/policy split are `INVESTIGATE` |
| Billing/over-limit policy data | yp quota/subscription/billing objects and Team runtime consumers | `TEAM_MODULE` or separately approved policy module; not generic ACL/dispatcher |
| Billing/subscription/rewards | yp payment/plan/subscription/Stripe/coupon/reward | Team/business module |
| SEO/fonts/labels/styles | common + yp | `SYSTEM_MODULE` or `INVESTIGATE` |
| Mailserver/licence | dedicated trees | `DEPLOYMENT` / `INVESTIGATE` |
| Custom/offline/deprecated | special trees | `INVESTIGATE`, not proven legacy |
| Patches | global/per-class patch trees | Same owner as changed object; ordering is critical |
| Sandbox application schema | `sandbox-server/schemas`: token/email/avatar/domain-pool procedures and seed dump | Owned by sandbox capability; target DB/install scope must be declared |
| Loby application schema | signup/onboarding tables, procedures, migrations and patch manifest under `loby/schemas` | Owned by split loby service modules; current shared application DB and migration order must be made explicit |
| Onboarding-server schema | legacy onboarding tables/procedures overlapping loby | `LEGACY`; retain as migration-lineage evidence, with loby owning the successor schema |
| Marketplace schema | No `sources/marketplace/schemas` directory despite payment code using a configured payment DB | `INVESTIGATE`; office integration itself relies on OS MFS schemas |

`setup-schemas/lib/schema.js::create_entity` allocates a pooled entity, creates its database/storage/MFS root and marks it clean. `setup-schemas/lib/drumate.js::create` calls `drumate_create` and seeds folders; `createHub` calls the owner shard's `desk_create_hub` and parses mixed result sets. `organization.js` creates domain/system/admin/guest state. Qualified procedure names and result shapes must remain compatible while module-aware templates and migrations are introduced.

The reference implementations prove why schema identity/versioning is mandatory. Loby and onboarding-server share ten filenames: `countries.sql` and `get_countries.sql` are byte-identical, while the other eight differ. Loby additionally owns newer signup and onboarding step procedures/migrations. Sandbox calls procedures as `sandbox.*`, whereas loby/onboarding derive an application database from `ob_conf`; marketplace payment code opens a configured DB but ships no mapped schema. When a later schema/lifecycle descriptor is designed, it must name database class/instance, install order and migration lineage rather than merely listing a `schemas/` directory; no universal module descriptor is introduced before `hello` validates the separate current plugin contracts.
