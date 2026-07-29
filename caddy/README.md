# drumee-caddy

A Caddy binary compiled with the `caddy-dns` provider modules, packaged for
Drumee's native channel.

## Why it is built rather than installed from Debian

Drumee needs a **wildcard** certificate (`example.com` *and* `*.example.com`,
plus the jitsi names). Wildcards can only be validated by the ACME **DNS-01**
challenge, and Caddy can only answer DNS-01 if the provider module is *compiled
into the binary*. Debian's `caddy` has none, so it is limited to HTTP-01 — which
cannot issue a wildcard and needs inbound port 80.

Building it here also makes it work **behind NAT**: the DNS API is reached
outbound, so no port forwarding is needed at all.

## Build

```bash
caddy/build.sh
```

No flags. Version and maintainer come from `debian/changelog`, as in every other
builder. Unlike the others this one needs a Go toolchain and picks whatever is
available — a local `xcaddy`, a local `go`, or a Docker `golang` image.

Two things it checks for you, both learned the hard way:

- **Go must be ≥ 1.21**, not merely installed. `xcaddy`'s `go.mod` carries a
  `toolchain` directive that older toolchains reject outright, and Debian
  bookworm ships 1.19 — so a too-old local Go is skipped in favour of Docker.
- **Caddy is not pinned by default, on purpose.** Each `caddy-dns` module declares
  a minimum `caddy/v2`, and they move independently, so any pin shipped here is
  wrong the moment one module passes it — `go get` fails outright rather than
  degrading (`ovh` wanted `v2.10.0`, then `desec` wanted `v2.10.2`). Taking the
  latest Caddy is the only version that satisfies every module at once. Pin
  explicitly when you need a reproducible build (`CADDY_VERSION=v2.10.2`); either
  way the version actually built is recorded in
  `/usr/share/drumee-caddy/caddy-version`.
- **`GOTOOLCHAIN=auto`** is forced on the Docker path. The official `golang`
  images pin it to `local`, while provider modules raise their minimum Go version
  independently of the image tag (`caddy-dns/ovh` already wants 1.24). With `auto`
  Go fetches whatever toolchain a module asks for instead of failing.

| Env | Default | Effect |
|---|---|---|
| `CADDY_VERSION` | *unset* (latest) | Pin a Caddy tag; see the coupling note below |
| `CADDY_DNS_MODULES` | `cloudflare ovh gandi desec duckdns digitalocean hetzner route53` | Providers compiled in |
| `CADDY_BUILD` | `auto` | Force `xcaddy`, `go` or `docker` |
| `GO_IMAGE` | `golang:1.24-bookworm` | Image for the docker path |
| `DEB_BUILD_TARGET` | — | Copy the `.deb` there |

The package is **`Architecture: any`** (the only Drumee package that is not
`all`), so the Go build targets the same architecture `dpkg` packages for —
`amd64`, `arm64`, `armhf` and `i386` are mapped. Output lands in
`caddy/build/<version>/` as `drumee-caddy_<version>_<arch>.deb`.

The module list is shipped as `/usr/share/drumee-caddy/dns-modules`; the postinst
checks the configured provider against it, so a provider that was not compiled in
is reported at install time instead of failing obscurely when Caddy starts.

## What the package installs

| Path | Role |
|---|---|
| `/usr/sbin/drumee-caddy` | The binary |
| `/usr/sbin/drumee-caddy-config` | Renders the Caddyfile from `conf.d/caddy.json` |
| `/usr/sbin/drumee-caddy-export-certs` | Publishes the certificate for nginx/prosody/jitsi |
| `drumee-caddy.service` | The proxy: runs as `caddy`, binds 80/443 via `CAP_NET_BIND_SERVICE` |
| `drumee-caddy-export-certs.{service,timer}` | Root oneshot + 12h timer for the export |

## Contract with drumee-infra

`drumee-infra`'s `postinst` writes both halves of the configuration when
`tls_method=caddy` is selected:

- `/etc/drumee/conf.d/caddy.json` (0644) — domain, `dns_provider`, `acme_email`,
  `certs_dir`, and the internal nginx ports to proxy to.
- `/etc/drumee/credential/caddy-dns.env` (**0600**) —
  `DRUMEE_CADDY_DNS_PROVIDER` and `DRUMEE_CADDY_DNS_TOKEN`.

In return this package **publishes every issued and renewed certificate** to
`<certs_dir>/<domain>_ecc/<domain>.cer` and `.key` — the acme.sh layout nginx,
prosody and jitsi already read — so nothing else in the stack changes. One
certificate covers all the names, since the Caddyfile lists them in a single site
block and Caddy issues one cert with all of them as SANs.

`drumee-infra` also moves nginx to `8080`/`8443` when this method is selected,
because Caddy has to own 80/443, and sets `OWN_SSL` so acme.sh does not race
Caddy for the same certificates.

**Install this package before selecting the method.** Without the binary present
`drumee-infra` refuses `tls_method=caddy` and leaves nginx on 80/443 — moving
nginx off those ports with nothing there to take them would leave the box serving
nothing at all.

## Providers needing more than one credential

Most modules take a single token, which is what
`DRUMEE_CADDY_DNS_TOKEN` carries. OVH (endpoint + application key + secret +
consumer key) cannot be expressed that way, so define the whole directive body in
the credentials file instead and the generator uses it verbatim:

```bash
# /etc/drumee/credential/caddy-dns.env  (0600)
export DRUMEE_CADDY_DNS_PROVIDER=ovh
export DRUMEE_CADDY_DNS_BLOCK='dns ovh {
	endpoint ovh-eu
	application_key APP_KEY
	application_secret APP_SECRET
	consumer_key CONSUMER_KEY
}'
```

Then `systemctl restart drumee-caddy`.

## Operating

```bash
systemctl status drumee-caddy
journalctl -u drumee-caddy -f
drumee-caddy-config                    # re-render the Caddyfile
drumee-caddy-export-certs              # publish certs now (idempotent)
cat /usr/share/drumee-caddy/dns-modules
```

After `dpkg-reconfigure drumee-infra`, restart the service: the Caddyfile is
regenerated on every start.
