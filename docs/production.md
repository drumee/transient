# Production self-host (container channel)

> For a step-by-step first real-server deployment (with verification + troubleshooting), see [first-deploy.md](first-deploy.md).

How to run Drumee for real users — with published images, automatic HTTPS, and
working email. The code/CI is in this repo; you provide the **registry, domain, and
SMTP relay**.

## What you provide

| Thing | Why |
|---|---|
| A Linux host with Docker + Compose v2 | runs the stack |
| A **domain** (e.g. `cloud.example.com`) with DNS A/AAAA → the host | TLS + the app's base URL |
| Ports **80 and 443** open to the host | ACME challenge + HTTPS |
| A **container registry** (GHCR, Docker Hub, …) | publish/pull the Drumee images |
| An **SMTP relay** (host/user/pass) | welcome + password-reset emails |
| Access to the private `drumee` component repos | to build the images |

## 1. Build & publish the images

On a build machine with the component sources checked out (and their deps
installed — `npm ci` in each, which needs registry auth):

```bash
docker login <your-registry>           # e.g. ghcr.io
REGISTRY=ghcr.io/<org> TAG=2.9.45 scripts/publish-images.sh
```

Pushes `server-pod`, `ui-build`, `schemas`, `schemas-populate`, and (if `~/static`
is present) `static`, tagged `:2.9.45` and `:latest`. `MEDIA_DEPS=1` (default)
includes LibreOffice/ffmpeg/etc. in `server-pod`. CI does this automatically on a
`v*` tag — see `.github/workflows/release.yml` (needs the `DRUMEE_SSH_KEY`,
`REGISTRY_TOKEN` secrets).

## 2. Configure the instance

`config/drumee.yaml`:

```yaml
instance:
  description: My Drumee
  domain: cloud.example.com        # real domain, NOT localhost
  admin_email: admin@example.com
tls:
  mode: acme                       # automatic HTTPS via Let's Encrypt/ZeroSSL
  acme_email: ssl@example.com
email:                             # SMTP relay -> welcome/reset emails
  host: smtp.example.com
  port: 587
  secure: false
  user: butler@example.com
  password: <smtp-password>        # or leave null + pin in a secret store
images:
  registry: ghcr.io/<org>          # where step 1 pushed
versions:                          # the tags you published in step 1
  server: 2.9.45
  ui: 3.3.1
  schemas: 2.6.99
  static: 1.0.3
database: { host: mariadb }
redis:    { host: redis }
```

Set `images.registry` to where step 1 pushed (e.g. `ghcr.io/<org>`) — the compose
then pulls `<registry>/<name>:<tag>` directly. Pin `database.password` /
`database.root_password` for stable re-renders (the rendered `.env` is written
mode 0600 — it contains the DB root credentials).

## 3. Render and launch

```bash
node config/render.mjs all --config config/drumee.yaml --out-dir ./drumee
cd drumee
docker compose --env-file .env up -d
```

`render.mjs` produces `.env`, `docker-compose.yml`, the **Caddyfile** (ACME for your
domain — Caddy obtains/renews the cert automatically), and `install.conf`. First
boot runs `schemas-init` → `ui-build` → `schemas-populate` (creates the admin; set
`CREATE_ADMIN=1` + optionally `ADMIN_PASSWORD`, else the password is printed in
`docker compose logs schemas-populate`).

Visit `https://cloud.example.com`.

## TLS

`tls.mode` drives the rendered Caddyfile:
- `acme` — automatic HTTPS (needs the domain resolving to the host + ports 80/443).
- `self-signed` — Caddy's internal CA (testing).
- `own` — your wildcard certs at `tls.own_cert_path` (`cert.pem`/`key.pem`).
- `localhost`/`local_mode` — plain HTTP (dev only).

## Email / SMTP

The `email.*` config is written to `/etc/drumee/credential/email.json` in the
**nodemailer shape** (`{host, port, secure, auth:{user,pass}}`) that the server
expects (`server-essentials/messenger.js`). With a valid relay, welcome and
password-reset emails are delivered; without it, the admin password is printed at
install time instead.

## Day-2

```bash
DRUMEE_DIR=./drumee bin/drumee-ctl status     # health
DRUMEE_DIR=./drumee bin/drumee-ctl backup     # DB + data + config -> BACKUP_LOCATION
DRUMEE_DIR=./drumee bin/drumee-ctl upgrade    # pre-backup, pull new tags, restart
                                              # (schemas-init re-runs and applies any
                                              #  schema patches shipped in the new image)
DRUMEE_DIR=./drumee bin/drumee-ctl rollback   # restore last pre-upgrade backup
```

Optional services (Jitsi/Prosody/Coturn, and `static`) are enabled via
`COMPOSE_PROFILES` (e.g. `COMPOSE_PROFILES=static,jitsi`).

## Still open (tracked)

- Redis defaults to no-auth on the internal network (the app has a secondary Redis
  client that doesn't authenticate yet — fix upstream, then set `redis.password`).
- The native (`apt`) channel needs a hosted APT repo + project GPG key (see
  `docs/native-channel.md`, `docs/release.md`).
