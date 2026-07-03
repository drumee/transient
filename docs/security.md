# Security model & hardening

## Secrets

- **Generated, never shipped.** `database.password` / `redis.password` left `null`
  in `drumee.yaml` are filled with strong random values at render time
  (`config/render.mjs`, 24 bytes base64url). No package ships a default or null
  application secret.
- **Not in git.** `drumee.yaml` and rendered `out/` are git-ignored; the only
  committed credential files (`target/etc/drumee/credential/*.json`) are
  placeholders (`password: null`).
- **Tight perms.** The container entrypoint writes `/etc/drumee/credential/*.json`
  as `0600`. Native installs should match (setup-infra).
- **Reproducibility tradeoff.** Re-rendering regenerates unpinned secrets. For
  stable deploys, pin them in `drumee.yaml` (kept out of git) or source them from a
  secrets manager; back them up with `drumee-ctl backup`.

## Transport

- TLS is on by default (`tls.mode: acme`) via Caddy / acme.sh — automatic
  Let's Encrypt/ZeroSSL issuance and renewal. `self-signed` is for local dev only.
- The reverse proxy is the only service publishing ports (80/443); app and data
  services sit on an internal compose network.

## Surface / threat notes

- **MariaDB / Redis** are not exposed outside the internal network in the container
  channel. Native installs must ensure they bind to localhost / the data network.
- **ACL + MFS** enforcement is in the application (every request is ACL-checked
  before dispatch); the packaging layer must not bypass it (e.g. no raw filesystem
  mounts exposed through the proxy).
- **debconf preseed** (`install.conf`) may contain operational values but no
  generated app secrets; treat it as config, not a secret store.

## Hardening checklist (track to completion)

- [x] No default/null application secrets shipped; auto-generated at render.
- [x] Credential files `0600`; config + secrets git-ignored.
- [x] TLS on by default with automatic renewal.
- [ ] Bind MariaDB/Redis to the internal network only in **all** native templates.
- [ ] Add rate-limiting / `fail2ban` defaults for auth endpoints.
- [x] Sign artifacts: APT `Release` via GPG (`publish-apt.sh`, `GPG_PRIVATE_KEY` secret) and
      images via **keyless `cosign`** (GitHub OIDC) — both wired in `.github/workflows/release.yml`.
- [x] Publish an SBOM per release (`syft`/`anchore/sbom-action` in `release.yml`).
- [ ] Document a CVE/patch response process (ties into `drumee-patch`).
