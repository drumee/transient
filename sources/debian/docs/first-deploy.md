# First production deployment — runbook

A checklist-driven walk-through for standing up the **first** real Drumee instance
on a server with a real domain. Everything here is validated locally except the
three infra-gated steps (published images, ACME TLS, SMTP) — those are exercised
for real here for the first time, so each has a verification + troubleshooting note.

Scope: the **standard self-host** (web UI, hubs, file collaboration). Optional
services (Jitsi video, inbound mail, DNS) are a later step — see the end.

---

## 0. Pre-flight checklist

| # | Requirement | Check |
|---|---|---|
| 1 | A Linux host (2+ vCPU, 4GB+ RAM, 20GB+ disk) | `nproc`, `free -h`, `df -h` |
| 2 | Docker Engine + Compose v2 | `docker compose version` |
| 3 | A domain (e.g. `cloud.example.com`) | — |
| 4 | DNS **A** (and AAAA if IPv6) record → the host's public IP | `dig +short cloud.example.com` |
| 5 | Ports **80 and 443** reachable from the internet | `sudo ss -ltnp \| grep -E ':80\|:443'` free; firewall/security-group open |
| 6 | A container registry you can push to + `docker login` | `docker login ghcr.io` |
| 7 | An SMTP relay (host/port/user/pass) for outbound mail | provider dashboard |
| 8 | Access to the private `drumee` component repos (to build images) | `git clone` works |

> If DNS isn't propagated yet, ACME (step 4 below) will fail — confirm `dig` returns
> the host IP **before** bringing the proxy up.

---

## 1. Build & publish images (build machine, once per version)

On a machine with the component sources checked out and their deps installed
(`npm ci` in each `~/server-team`, `~/ui-team`, `~/schemas`, `~/setup-schemas`,
and optionally `~/setup-infra`, `~/static`):

```bash
docker login ghcr.io
REGISTRY=ghcr.io/<org> TAG=2.9.45 scripts/publish-images.sh
```

Pushes `server-pod`, `ui-build`, `schemas`, `schemas-populate` (and `static`,
`infra-init` if those sources are present), tagged `:2.9.45` + `:latest`.

**Hard rule first:** regenerate the schema starter kit before tagging a release —
see [release.md](release.md) (`bin/make-templates` on the reference host), else
newly created hubs are built from a stale schema.

**Verify:** `docker manifest inspect ghcr.io/<org>/server-pod:2.9.45` succeeds.

---

## 2. Configure the instance (on the server)

```bash
git clone <this-repo> drumee-deploy && cd drumee-deploy
cp config/drumee.example.yaml config/drumee.yaml
```

Edit `config/drumee.yaml`:

```yaml
instance:
  description: My Drumee
  domain: cloud.example.com         # the real domain (must resolve to this host)
  admin_email: admin@example.com
tls:
  mode: acme                        # automatic Let's Encrypt
  acme_email: ssl@example.com
email:
  host: smtp.example.com
  port: 587
  secure: false
  user: butler@example.com
  password: <smtp-password>
images:
  registry: ghcr.io/<org>           # where step 1 pushed
versions:
  server: 2.9.45
  ui: 3.3.1
  schemas: 2.6.99
database:
  host: mariadb
  password: <pin-a-strong-value>        # pin for stable re-renders
  root_password: <pin-a-strong-value>
redis:
  host: redis
```

> Pin `database.password`/`root_password` (and `redis.password` only if the
> upstream Redis-auth fix has landed). Unpinned secrets regenerate on every
> re-render, which breaks an existing data dir.

---

## 3. Render & launch

```bash
docker login ghcr.io                                  # so compose can pull
node config/render.mjs all --config config/drumee.yaml --out-dir ./run
cd run
# provision an admin login (printed in logs); omit ADMIN_PASSWORD to auto-generate
CREATE_ADMIN=1 ADMIN_PASSWORD='<choose-one>' docker compose --env-file .env up -d
```

First boot order (automatic, via healthchecks): `mariadb (healthy)` →
`schemas-init` → `ui-build` + `schemas-populate` → `factory` + `server-pod` →
`proxy`. Allow 1–3 min on first run.

---

## 4. Verify (in order — each catches a specific infra-gated unknown)

```bash
docker compose -p run ps                              # all run-once = exited 0; long-running = healthy
DRUMEE_DIR=. ../bin/drumee-ctl doctor                 # DB/redis/disk/services
```

1. **Run-once jobs exited 0** — if `schemas-populate` failed, check
   `docker compose logs schemas-populate` (DB reachable? pool stocked?).
2. **server-pod healthy** — `docker compose logs server-pod` should show
   `START WEBSOCKET SERVER` and module loading, no crash loop.
3. **TLS issued** — `curl -I https://cloud.example.com/` returns 200 with a valid
   cert. `docker compose logs proxy | grep -i certificate`.
4. **Admin login** — open `https://cloud.example.com/`, log in with the
   credentials from `docker compose logs schemas-populate | grep -A3 'ADMIN LOGIN'`.
5. **Email** — trigger a password reset; confirm delivery (check the relay / spam).

---

## 5. Troubleshooting the three first-time unknowns

**ACME TLS won't issue**
- DNS must resolve to this host *before* the proxy starts: `dig +short <domain>`.
- Ports 80 + 443 must be open end-to-end (cloud security group + host firewall).
- Rate-limited while testing? Add `acme_ca https://acme-staging-v02.api.letsencrypt.org/directory`
  to the Caddyfile global block, or temporarily use `tls.mode: self-signed`.
- Logs: `docker compose logs proxy | grep -iE 'error|challenge|certificate'`.

**Images won't pull**
- `docker login` to the registry on the server too (compose pulls there).
- Private packages (GHCR): the token needs `read:packages`; package visibility set.

**SMTP not delivering**
- `docker compose exec server-pod cat /etc/drumee/credential/email.json` — confirm
  nested `auth:{user,pass}` and the right host/port.
- Relay may require the `From` (`butler@<domain>`) to be an authorized sender.
- No relay yet? The admin password is printed in the populate logs, so you can
  still log in without email.

**"Warming Up" never finishes** (UI shell loads, app doesn't)
- A bundle/asset returns HTML instead of its content → check the proxy is serving
  `/-/app/*` from the `ui_assets` volume (`curl -I https://<domain>/-/app/manifest.json`
  → `application/json`). `ui-build` must have completed (exit 0).

**`EMPTY_FACTORY` when users sign up**
- The `factory` service should be running and topping the pool up. Check
  `docker compose logs factory` and `POOL_WATERMARK`.

---

## 6. Day-2

```bash
DRUMEE_DIR=./run ../bin/drumee-ctl backup            # before changes
DRUMEE_DIR=./run ../bin/drumee-ctl upgrade           # pre-backup, pull new tags,
                                                     # apply schema patches, restart
DRUMEE_DIR=./run ../bin/drumee-ctl rollback          # restore last pre-upgrade backup
DRUMEE_DIR=./run ../bin/drumee-ctl doctor            # health
```

Back up `config/drumee.yaml` (it holds your pinned secrets) and `BACKUP_LOCATION`
off-box.

---

## 7. Optional services (later, infra-gated)

Jitsi (video), inbound mail, and DNS need the consuming service containers wired
and a real domain/public DNS to validate. `infra-init` already renders their
configs into the `infra_{jitsi,mail,dns}` volumes; enable per profile once the
service containers are added:

```bash
COMPOSE_PROFILES=static,jitsi docker compose --env-file .env up -d
```

See [infra-init.md](infra-init.md) for the remaining work.

---

## First-deploy report

After the first deployment, capture anything that differed from this runbook
(env quirks, ACME timing, registry auth, SMTP relay specifics) back into this
file — the first real run is the best time to harden it.
