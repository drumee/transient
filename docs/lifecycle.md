# Lifecycle operations — `drumee-ctl`

`bin/drumee-ctl` is the channel-aware operator tool for day-2 operations. It
auto-detects whether it's driving a **container** deployment (a docker compose
project) or a **native** host install (`/etc/drumee/drumee.sh` + pm2), and does the
right thing for each.

> The existing `drumee` command (from `drumee-server-pod`) stays the pm2 process
> wrapper (`start`/`stop`/`restart`/`log`). `drumee-ctl` adds the higher-level
> lifecycle verbs. In the container channel it can be installed simply as `drumee`.

| Command | What it does |
|---|---|
| `drumee-ctl status` | Service/process summary (compose ps or pm2 list) |
| `drumee-ctl doctor` | Checks: daemon/.env, services running, MariaDB + Redis answering, TLS cert expiry, disk usage |
| `drumee-ctl backup [label]` | Timestamped DB dump + data dir + config → `BACKUP_LOCATION` |
| `drumee-ctl restore <file>` | Restore DB (+ data) from a backup archive |
| `drumee-ctl upgrade [tag]` | Pre-upgrade backup, then `compose pull && up -d` (container) or `apt upgrade` + restart (native) |
| `drumee-ctl rollback` | Restore the most recent `preupgrade` backup |

## Examples

```bash
# Container (from the compose dir, or set DRUMEE_DIR)
DRUMEE_DIR=./drumee drumee-ctl doctor
DRUMEE_DIR=./drumee drumee-ctl backup nightly

# Native host
sudo drumee-ctl status
sudo drumee-ctl upgrade          # backs up, apt-upgrades, restarts
sudo drumee-ctl rollback         # restores last pre-upgrade snapshot
```

## Notes / TODO

- `BACKUP_LOCATION` comes from the rendered `.env` (container) or `drumee.sh`
  (native); defaults to `/srv/backup`.
- `backup`/`restore` use logical dumps (`mariadb-dump`). For large instances,
  wire in `mariabackup` physical backups (ties into `schemas/make-seed.sh`).
- `rollback` restores **data**; image/package version revert is not yet automatic
  (tracked) — pin the previous tag in `drumee.yaml` / apt and re-run `upgrade`.
- The container channel backs up the DB via `compose exec mariadb mariadb-dump`;
  ensure the `mariadb` service name matches your compose project.
