# setup-infra analysis → infra-init container design

Analysis of `github.com/drumee/setup-infra` (main @ a12ac67) and a **validated
feasibility test** of running its config renderer in a container. This is the path
to full parity for the optional services: Jitsi (prosody/jicofo/jvb/turn), the
mail server (postfix/opendkim), and DNS (bind).

## What setup-infra is

The canonical generator for *every* host config. `infra.js` (+ `jitsi.js`) read
**env vars + CLI args**, auto-detect addresses, and render 69 lodash templates
(`templates/etc/...` mirroring the target filesystem) into place. Key properties:

- **`--chroot <dir>`** prefixes all output paths — i.e. it can render into a
  volume instead of the host. Explicitly container-friendly.
- Env contract = the wizard variable names: `PUBLIC_DOMAIN` (bin/install bridges
  `DRUMEE_DOMAIN_NAME`), `ADMIN_EMAIL`, `DRUMEE_ROOT`, `DRUMEE_DATA_DIR`,
  `DRUMEE_DB_DIR`, `PUBLIC_IP4/6`, `PRIVATE_*`, `OWN_CERTS_DIR`, … — these are
  already what our rendered `.env` carries.
- **Generates random credentials on every run** (DB, postfix, email, XMPP).
- An existing `<chroot>/etc/drumee/drumee.json` makes it a no-op unless
  `--force-install`.

## Feasibility: PROVEN

From this machine (no host mutation), `infra.js --chroot=/tmp/infra-out` with the
env contract above rendered the **complete native config tree — 39 files**: BIND
zones (`var/lib/bind/*`), postfix (`main.cf`, `master.cf`, virtual maps),
opendkim, nginx sites, MariaDB tuning, `conf.d/*`, credentials, `drumee.sh`, cron.
Two prerequisites surfaced:

1. **DKIM keys must exist first** — natively `bin/init-mail` runs
   `opendkim-genkey` before `infra.js`; the renderer reads
   `etc/opendkim/keys/<domain>/dkim.txt` (crashes otherwise). The infra-init
   container must run keygen (or `bin/init-mail`) first.
2. **Upstream bug: `args.drumee_root` is never set** — there is no
   `--drumee-root` CLI arg and no env mapping into `args`; `infra.js:560/590`
   do `join(args.drumee_root, 'cache', domain)` → `infra.js` **crashes whenever a
   public or private domain branch is taken**. (`configs.drumee_root` gets a
   default at infra.js:369, but 560/590 read `args`.) Worked around in the test
   with a preload shim; needs a 1-line upstream fix.

Also found: **template/code drift** — `conf.d/exchange.json.tpl` writes
`exportFolder`/`importFolder`, but `server-essentials/sysEnv.js` reads
`export_dir`/`import_dir`. The canonical template's keys are silently ignored
(our hand-written exchange.json uses the keys the app actually reads).

## Integration design (decided)

**Keep the split: `drumee.yaml` owns the core; setup-infra owns service configs.**

Do NOT replace our core credential/conf.d writing with setup-infra's renderer:
- it regenerates random DB/SMTP/XMPP passwords **per run** (breaks container
  idempotency and our pinned-secret model),
- it assumes `host: localhost` for the DB (native socket topology, not our
  TCP service names),
- its nginx outputs overlap our Caddy proxy (TLS + static + routing already
  solved container-side).

Instead, an **`infra-init` run-once service** (profile-gated, like `static`):

```
image: built FROM node-slim + setup-infra repo + opendkim-tools
1. opendkim-genkey for $DRUMEE_DOMAIN_NAME        (unless keys volume has them)
2. node infra.js  --chroot=/render --only-infra=1  (env from our .env)
3. node jitsi.js  --chroot=/render                 (when jitsi profile on)
4. adapter: copy ONLY the service configs into per-service volumes
   - conference.json + prosody/jicofo/jvb/turn -> jitsi profile services
   - postfix/main.cf master.cf virtual-maps + opendkim -> mail profile
   - bind named.conf + var/lib/bind zones -> dns profile
   (core conf.d/credentials stay ours; nginx outputs unused — Caddy keeps
   TLS/static/routing)
```

This honors single-source-of-truth per concern: instance config + core creds from
`drumee.yaml`; service config shapes from setup-infra's canonical templates.

## Status / follow-ups

- [x] Feasibility validated (39-file render under `--chroot`, no host writes).
- [x] **`infra-init` image + adapter built and validated.** `Dockerfile.infra-init`
      (FROM server-pod + setup-infra + opendkim-tools + @assetval/ip; `NODE_PATH`
      resolves @drumee deps; `infra-root-shim.js` works around the upstream crash).
      Run-once entrypoint: DKIM keygen → `infra.js`/`jitsi.js --chroot=/render` →
      adapter publishes per-part subtrees into `infra_{jitsi,mail,dns}` volumes.
      Verified: mail (postfix main.cf w/ domain + TLS, generated DKIM key, virtual
      maps), dns (named.conf + forward/reverse zones), jitsi (conference.json +
      prosody.cfg.lua + jicofo/jvb/web). `jitsi.js` rendered fine under `--chroot`.
      Wired profile-gated into compose + build/publish scripts.
- [ ] **Next (infra-gated):** the consuming service containers —
      prosody/jicofo/jvb/coturn (jitsi), postfix/opendkim (mail), bind (dns).
      Each needs the upstream image's config mount paths confirmed + a real
      domain/IP/DNS to validate serving. infra-init already produces their configs.
- [ ] Upstream: fix `args.drumee_root` (1-line) — issue draft in
      `/tmp/issue-setup-infra-drumee-root.md`.
- [ ] Upstream nit: `exchange.json.tpl` key drift vs `sysEnv` (`exportFolder` →
      `export_dir`).
