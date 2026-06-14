# Drumee configuration — single source of truth

One human-edited file, `drumee.yaml`, describes a Drumee deployment. A small
dependency-free renderer turns it into the inputs both install channels need:

```
config/drumee.yaml ──(render.mjs)──┬──▶ .env               container channel
   (you edit this)                 ├──▶ docker-compose.yml  container channel
                                    └──▶ install.conf        native channel (debconf preseed)
```

This is the linchpin of the two-channel (container + native) strategy: every
decision is made once, in `drumee.yaml`, and each channel is a thin renderer over
it — never a parallel reimplementation.

## Files

| File | Purpose |
|---|---|
| `drumee.schema.json` | Formal JSON Schema (draft 2020-12) — the contract. Usable by editors/CI (e.g. ajv). |
| `drumee.example.yaml` | Annotated starting point. Copy to `drumee.yaml`. |
| `render.mjs` | Parser + validator + renderers. No npm install required (Node ≥ 18). |
| `drumee.yaml` | Your actual config. **Git-ignored** — may contain pinned secrets. |

## Usage

```bash
cp config/drumee.example.yaml config/drumee.yaml   # then edit

node config/render.mjs validate                    # parse + validate, print normalized config
node config/render.mjs all --out-dir ./out         # emit .env, docker-compose.yml, install.conf
node config/render.mjs env                          # individual artifact to stdout
node config/render.mjs debconf --out ./install.conf
```

Default `--config` is `config/drumee.yaml`.

## Secrets

`database.password` / `redis.password` left `null` are filled with strong random
values at render time (a note is printed). Re-rendering regenerates them — for
reproducible deploys, **pin secrets in `drumee.yaml`** (or, later, let Phase 4
backup/restore persist them). The rendered `.env`/`install.conf` and `drumee.yaml`
are git-ignored for this reason.

## How each channel consumes the output

**Container channel** — `docker compose --env-file out/.env -f out/docker-compose.yml up -d`.
The `.env` variable names intentionally match what `setup-infra`'s wizard already
writes (`DRUMEE_DOMAIN_NAME`, `ADMIN_EMAIL`, `ACME_EMAIL_ACCOUNT`, `PUBLIC_IP4`, …),
so existing scripts consume them unchanged. `COMPOSE_PROFILES` enables the optional
Jitsi/Prosody/Coturn services.

**Native channel** — unattended install:

```bash
debconf-set-selections < out/install.conf
DEBIAN_FRONTEND=noninteractive apt-get install -y drumee-infra
```

The wizard (`setup/menu/install.sh`) reads its answers from debconf; with the
preseed in place and a noninteractive frontend, it runs without prompting.

> Follow-up (tracked for the external `setup` repo): make the wizard's input
> validation loops `break` under `DEBIAN_FRONTEND=noninteractive` so a malformed
> preseed fails fast instead of looping. The renderer validates before emitting
> `install.conf`, so this is defense-in-depth, not a blocker.

## Config format contract

The bundled parser supports a deliberately small YAML subset (so no dependency is
needed):

- 2-space indentation; sections nest one level (`section:` then `  key: value`).
- Scalars: strings, integers, `true`/`false`, `null` (or empty) for "generate/none".
- Inline lists only: `key: [a, b, c]`.
- `#` starts a comment (not inside an unquoted value).

Anything outside this subset should be added to `render.mjs` deliberately, with a
schema update, rather than relied upon implicitly.
