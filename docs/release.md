# Release engineering

## Coherent versioning

`release-manifest.yaml` is the authoritative version of every package in a release
set. `scripts/check-versions.sh` fails CI if any `debian/changelog` drifts from it.

```bash
# bump versions in release-manifest.yaml, then:
scripts/check-versions.sh --sync     # rewrite changelog top lines to match
scripts/check-versions.sh            # verify (also runs in CI)
```

## Pipelines

- **`.github/workflows/ci.yml`** (PR/push) — runs with no secrets: shell syntax +
  ShellCheck, `render.mjs` validation, generated `docker compose config`, and the
  version drift guard.
- **`.github/workflows/release.yml`** (tag `v*`) — builds container images and
  `.deb`s, signs and publishes the APT repo, and runs the container smoke test.
  Jobs needing private source / signing keys / registry creds are gated on the
  corresponding secrets and no-op when absent (so forks run the buildable parts).

## Secrets required for a full release

| Secret | Used for |
|---|---|
| `DRUMEE_SSH_KEY` | read access to component repos (image + deb builds) |
| `GPG_PRIVATE_KEY` / `GPG_PASSPHRASE` | signing `.deb`s and the APT `Release` |
| `REGISTRY_TOKEN` | pushing images to the container registry |
| `APT_DEPLOY_*` | publishing `apt-repo/` to the hosting URL |

## Still needs a decision (see docs/reproducible-builds.md)

- Public source strategy (mirror / tarball / container-only) so non-insiders build.
- Signed artifacts: also consider `cosign` for images and an SBOM step.
