# Schema Map

Inventory: about 269 files in `common`, 714 in `yellow_page`, 108 in `hub`, and 194 in `drumate`. Placement is not ownership proof.

| Family | Consumers / evidence | Proposed ownership |
|---|---|---|
| Entity/domain/vhost/shard registry | yp `entity`, `domain`, `vhost`, `drumate`, `hub`; `get_entity/get_db_name/get_user/get_hub` used by runtime/setup/CLI | Minimal OS |
| Authentication/session/ACL | yp auth/session; common permission + `acl_check` used by core | Minimal OS |
| MFS/media/version/permission/trash | `common/tables/{media,file_version,permission,trash_media}.sql`, `mfs_*.sql`; server-core/CLI | Minimal OS |
| Provisioning/templates/factory | yp entity/drumate creation, `templates/factory`, setup-schemas | OS contract + deployment; daemon details `INVESTIGATE` |
| Base membership | hub member/remove/show and drumate join/leave/show hubs | Minimal hosting subset; exact cut `INVESTIGATE` |
| Chat/channel/P2P | common channel, hub channel, drumate p2p tables/procedures | `TEAM_MODULE` |
| Tasks | `common/tables/task*.sql`, `common/procedures/task_*.sql` | `TEAM_MODULE`; misplaced in common |
| Meetings/rooms/conference | yp conference/meeting/room and hub meeting routines | `TEAM_MODULE` |
| Contacts/address book | yp contact and drumate contact/my_contact routines | `TEAM_MODULE` or `SYSTEM_MODULE`: `INVESTIGATE` |
| DMZ/secure sharing | yp secure_share/dmz plus hub dmz routines | OS subset vs module UI `INVESTIGATE` |
| Billing/subscription/rewards | yp payment/plan/subscription/Stripe/coupon/reward | Team/business module |
| SEO/fonts/labels/styles | common + yp | `SYSTEM_MODULE` or `INVESTIGATE` |
| Mailserver/licence | dedicated trees | `DEPLOYMENT` / `INVESTIGATE` |
| Custom/offline/deprecated | special trees | `INVESTIGATE`, not proven legacy |
| Patches | global/per-class patch trees | Same owner as changed object; ordering is critical |

`setup-schemas/lib/schema.js::create_entity` allocates a pooled entity, creates its database/storage/MFS root and marks it clean. `setup-schemas/lib/drumate.js::create` calls `drumate_create` and seeds folders; `createHub` calls the owner shard's `desk_create_hub` and parses mixed result sets. `organization.js` creates domain/system/admin/guest state. Qualified procedure names and result shapes must remain compatible while module-aware templates and migrations are introduced.
