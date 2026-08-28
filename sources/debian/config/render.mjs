#!/usr/bin/env node
// Drumee config renderer — single source of truth -> channel artifacts.
//
//   node config/render.mjs <command> [--config FILE] [--out FILE] [--out-dir DIR]
//
// commands:
//   validate   parse + validate the config, print a normalized summary
//   env        emit the container-channel .env
//   compose    emit docker-compose.yml (optional-service profiles toggled by config)
//   debconf    emit the native-channel debconf preseed (install.conf)
//   all        emit .env, docker-compose.yml and install.conf into --out-dir
//
// Dependency-free: a constrained YAML reader covers the documented config subset.
// The formal contract lives in config/drumee.schema.json.

import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';

// ---------------------------------------------------------------- arg parsing
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { config: 'config/drumee.yaml', out: null, outDir: 'out' };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--config') opts.config = rest[++i];
    else if (a === '--out') opts.out = rest[++i];
    else if (a === '--out-dir') opts.outDir = rest[++i];
    else die(`unknown argument: ${a}`);
  }
  return { command, opts };
}

function die(msg) {
  console.error(`render: ${msg}`);
  process.exit(1);
}

// ----------------------------------------------------------- minimal YAML read
// Supports: 2-space indentation (any depth), `key:` sections, `key: scalar`,
// inline lists `[a, b]`, comments, and scalar types string/int/bool/null.
function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, container: root }];
  const lines = text.split('\n');
  for (let n = 0; n < lines.length; n++) {
    const raw = lines[n];
    if (/^\s*$/.test(raw) || /^\s*#/.test(raw)) continue;
    if (raw.includes('\t')) die(`line ${n + 1}: tabs are not allowed, use spaces`);
    const indent = raw.length - raw.trimStart().length;
    const trimmed = raw.trimStart();

    // -------- sequence item:  "- scalar"  or  "- key: value" (mapping item)
    if (trimmed === '-' || trimmed.startsWith('- ')) {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      if (!stack.length) die(`line ${n + 1}: indentation error`);
      const frame = stack[stack.length - 1];
      let arr = frame.container;
      if (!Array.isArray(arr)) {
        // the parent key was created as an object placeholder — make it a list
        if (frame.key === undefined) die(`line ${n + 1}: unexpected list item`);
        arr = []; frame.parent[frame.key] = arr; frame.container = arr;
      }
      const itemStr = trimmed === '-' ? '' : trimmed.slice(2);
      const mm = itemStr.match(/^([\w-]+):\s*(.*)$/);
      if (mm) {                                   // "- key: value" → mapping item
        const itemObj = {}; arr.push(itemObj);
        stack.push({ indent, container: itemObj }); // continuation keys attach here
        const [, k, rhs] = mm;
        if (rhs === '') {
          const obj = {}; itemObj[k] = obj;
          stack.push({ indent: indent + 1, container: obj, key: k, parent: itemObj });
        } else itemObj[k] = parseScalar(rhs, n + 1);
      } else if (itemStr === '') {                // bare "-" → nested mapping follows
        const itemObj = {}; arr.push(itemObj);
        stack.push({ indent, container: itemObj });
      } else arr.push(parseScalar(itemStr, n + 1)); // "- scalar"
      continue;
    }

    // -------- mapping entry:  "key: value"  or  "key:" (nested block)
    const m = trimmed.match(/^([\w-]+):\s*(.*)$/);
    if (!m) die(`line ${n + 1}: expected "key: value", got: ${raw.trim()}`);
    const [, key, rhs] = m;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (!stack.length) die(`line ${n + 1}: indentation error`);
    const parent = stack[stack.length - 1].container;
    if (Array.isArray(parent)) die(`line ${n + 1}: mapping key in a sequence`);
    if (rhs === '') {
      const obj = {};
      parent[key] = obj;
      stack.push({ indent, container: obj, key, parent });
    } else {
      parent[key] = parseScalar(rhs, n + 1);
    }
  }
  return root;
}

function parseScalar(s, line) {
  s = s.trim();
  if (s[0] === '"' || s[0] === "'") {
    const q = s[0];
    const end = s.indexOf(q, 1);
    if (end === -1) die(`line ${line}: unterminated quote`);
    return s.slice(1, end);
  }
  s = s.split(/\s+#/)[0].trim(); // strip inline comment
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((x) => parseScalar(x, line));
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~' || s === '') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  return s;
}

// --------------------------------------------------------- defaults + validate
const SCHEMA = JSON.parse(
  readFileSync(new URL('./drumee.schema.json', import.meta.url), 'utf8'),
);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function applyDefaults(cfg) {
  const out = {};
  for (const [section, spec] of Object.entries(SCHEMA.properties)) {
    const given = cfg[section] ?? {};
    if (typeof given !== 'object' || Array.isArray(given)) {
      die(`section "${section}" must be a mapping`);
    }
    out[section] = {};
    for (const [key, kspec] of Object.entries(spec.properties ?? {})) {
      out[section][key] = key in given ? given[key]
        : 'default' in kspec ? structuredClone(kspec.default)
        : undefined;
    }
    for (const key of Object.keys(given)) {
      if (!(key in (spec.properties ?? {}))) die(`unknown key "${section}.${key}"`);
    }
  }
  // `plugins` is a top-level list (not a section mapping) — carry it through so it
  // can be installed with `drumee[-ctl] plugin apply`. Validated lightly here.
  if ('plugins' in cfg) {
    if (!Array.isArray(cfg.plugins)) die('"plugins" must be a list');
    for (const p of cfg.plugins) {
      if (!p || typeof p !== 'object' || !p.source) die('each plugin needs at least a "source"');
    }
    out.plugins = cfg.plugins;
  }
  for (const section of Object.keys(cfg)) {
    if (section === 'plugins') continue;
    if (!(section in SCHEMA.properties)) die(`unknown section "${section}"`);
  }
  return out;
}

function validate(cfg) {
  const errs = [];
  const i = cfg.instance;
  if (!i.description) errs.push('instance.description is required');
  if (!i.domain) errs.push('instance.domain is required');
  if (!i.admin_email || !EMAIL_RE.test(i.admin_email))
    errs.push('instance.admin_email must be a valid email');

  const mode = cfg.tls.mode;
  if (!['acme', 'own', 'self-signed'].includes(mode))
    errs.push(`tls.mode must be one of acme|own|self-signed (got ${mode})`);
  if (mode === 'acme' && (!cfg.tls.acme_email || !EMAIL_RE.test(cfg.tls.acme_email)))
    errs.push('tls.acme_email must be a valid email when tls.mode=acme');
  if (mode === 'own' && !cfg.tls.own_cert_path)
    errs.push('tls.own_cert_path is required when tls.mode=own');
  // Native-channel DNS-01 detail. setup-infra issues a wildcard, so there is no
  // HTTP-01 path at all; the only choice is how the DNS record gets written.
  if (!['nsupdate', 'api'].includes(cfg.tls.dns_challenge))
    errs.push(`tls.dns_challenge must be nsupdate or api (got ${cfg.tls.dns_challenge})`);
  if (cfg.tls.dns_challenge === 'api') {
    if (mode !== 'acme') errs.push('tls.dns_challenge=api only applies when tls.mode=acme');
    else if (!cfg.tls.acme_env_file)
      errs.push('tls.acme_env_file is required when tls.dns_challenge=api');
  }
  if (!['nginx', 'caddy'].includes(cfg.tls.terminator))
    errs.push(`tls.terminator must be nginx or caddy (got ${cfg.tls.terminator})`);
  if (cfg.tls.terminator === 'caddy') {
    // Caddy does its own ACME with a compiled-in DNS module, so it needs the
    // provider name — and the acme.sh knobs describe a mechanism it replaces.
    if (mode !== 'acme') errs.push('tls.terminator=caddy requires tls.mode=acme');
    if (!cfg.tls.dns_provider) errs.push('tls.dns_provider is required when tls.terminator=caddy');
    if (cfg.tls.dns_challenge === 'api' || cfg.tls.acme_env_file)
      errs.push('tls.dns_challenge/acme_env_file configure acme.sh — omit them with tls.terminator=caddy');
  } else if (cfg.tls.dns_provider) {
    errs.push('tls.dns_provider only applies when tls.terminator=caddy');
  }

  for (const [s, k] of [['database', 'port'], ['redis', 'port'], ['email', 'port']])
    if (cfg[s][k] != null && !Number.isInteger(cfg[s][k]))
      errs.push(`${s}.${k} must be an integer`);

  const wg = cfg.wireguard;
  for (const k of ['listen_port', 'reflector_port']) {
    if (!Number.isInteger(wg[k]) || wg[k] < 1 || wg[k] > 65535)
      errs.push(`wireguard.${k} must be an integer between 1 and 65535`);
  }
  if (wg.enabled) {
    if (!wg.coordinator) errs.push('wireguard.coordinator is required when wireguard.enabled');
    // Coordination exists to traverse NAT from the public Internet; on a
    // LAN-only instance it can never pair with anything.
    if (i.local_mode) errs.push('wireguard.enabled cannot be combined with instance.local_mode');
  }

  if (errs.length) die('config invalid:\n  - ' + errs.join('\n  - '));
}

function genSecret() {
  return randomBytes(24).toString('base64url');
}

// Fill generated secrets; returns list of which were generated (for warnings).
function fillSecrets(cfg) {
  const generated = [];
  // Redis runs on the internal compose network only; we do NOT auto-generate a
  // password because the app currently has a secondary Redis client that doesn't
  // authenticate (NOAUTH). Set redis.password explicitly once that's fixed upstream.
  for (const path of ['database.password', 'database.root_password']) {
    const [s, k] = path.split('.');
    if (cfg[s][k] == null) { cfg[s][k] = genSecret(); generated.push(path); }
  }
  return generated;
}

// --------------------------------------------------------------- env rendering
function envValue(v) {
  if (v == null) return '';
  const str = String(v);
  return /[\s"'#$]/.test(str) ? `"${str.replace(/"/g, '\\"')}"` : str;
}

function renderEnv(cfg) {
  const profiles = Object.entries(cfg.optional_services)
    .filter(([, on]) => on).map(([name]) => name);
  // WireGuard is not in optional_services (it is its own config section, shared
  // with the native channel) but it gates a compose service the same way.
  if (cfg.wireguard.enabled) profiles.push('wireguard');
  // Variable names intentionally match what setup-infra's wizard already writes,
  // so existing scripts consume this file unchanged.
  const pairs = {
    DRUMEE_DESCRIPTION: cfg.instance.description,
    DRUMEE_DOMAIN_NAME: cfg.instance.domain,
    LOCAL_MODE: cfg.instance.local_mode,
    ADMIN_EMAIL: cfg.instance.admin_email,
    PUBLIC_IP4: cfg.network.ip4,
    PUBLIC_IP6: cfg.network.ip6,
    SERVICES: cfg.network.services.join(','),
    TLS_MODE: cfg.tls.mode,
    ACME_EMAIL_ACCOUNT: cfg.tls.acme_email ?? '',
    OWN_SSL: cfg.tls.mode === 'own',
    OWN_SSL_PATH: cfg.tls.own_cert_path ?? '',
    DRUMEE_DATA_DIR: cfg.storage.data_dir,
    DRUMEE_DB_DIR: cfg.storage.db_dir,
    BACKUP_LOCATION: cfg.storage.backup_location ?? '',
    EXCHANGE_LOCATION: cfg.storage.exchange_location,
    DB_HOST: cfg.database.host,
    DB_PORT: cfg.database.port,
    DB_NAME: cfg.database.name,
    DB_USER: cfg.database.user,
    DB_PASSWORD: cfg.database.password,
    DB_ROOT_PASSWORD: cfg.database.root_password,
    REDIS_HOST: cfg.redis.host,
    REDIS_PORT: cfg.redis.port,
    REDIS_PASSWORD: cfg.redis.password ?? '',
    SMTP_HOST: cfg.email.host ?? '',
    SMTP_PORT: cfg.email.port,
    SMTP_SECURE: cfg.email.secure,
    SMTP_USER: cfg.email.user ?? '',
    SMTP_PASSWORD: cfg.email.password ?? '',
    API_PORT: cfg.ports.api,
    UI_PORT: cfg.ports.ui,
    // Consumed by the wireguard service's entrypoint, which renders the same
    // conf.d/wireguard.json the native postinst writes.
    WIREGUARD_ENABLED: cfg.wireguard.enabled,
    WIREGUARD_COORDINATOR: cfg.wireguard.coordinator ?? '',
    WIREGUARD_LISTEN_PORT: cfg.wireguard.listen_port,
    WIREGUARD_REFLECTOR_PORT: cfg.wireguard.reflector_port,
    IMAGE_REGISTRY: cfg.images.registry,
    SERVER_TAG: cfg.versions.server ?? cfg.versions.product,
    UI_TAG: cfg.versions.ui ?? cfg.versions.product,
    SCHEMAS_TAG: cfg.versions.schemas ?? cfg.versions.product,
    STATIC_TAG: cfg.versions.static ?? cfg.versions.product,
    COMPOSE_PROFILES: profiles.join(','),
  };
  const header = '# Generated by config/render.mjs — do not edit by hand.\n'
    + '# Edit config/drumee.yaml and re-render.\n';
  return header + Object.entries(pairs)
    .map(([k, v]) => `${k}=${envValue(v)}`).join('\n') + '\n';
}

// --------------------------------------------------------- debconf preseed
function dc(key, type, value) {
  return `drumee-infra\tdrumee-infra/${key}\t${type}\t${value ?? ''}`;
}

// The debconf choice matching this config. Mirrors drumee-infra/tls_method:
// acme-dns-server (BIND9 here) | acme-dns-api (provider API) | own | self-signed.
function tlsMethod(cfg) {
  if (cfg.tls.mode === 'own') return 'own';
  if (cfg.tls.mode === 'self-signed') return 'self-signed';
  if (cfg.tls.terminator === 'caddy') return 'caddy';
  return cfg.tls.dns_challenge === 'api' ? 'acme-dns-api' : 'acme-dns-server';
}

function renderDebconf(cfg) {
  const lines = [
    '# Generated by config/render.mjs — feed to: debconf-set-selections < install.conf',
    dc('description', 'string', cfg.instance.description),
    dc('domain', 'string', cfg.instance.domain),
    dc('local_mode', 'boolean', cfg.instance.local_mode),
    dc('service', 'string', cfg.network.services.join(',')),
    dc('admin_email', 'string', cfg.instance.admin_email),
    dc('acme_email', 'string', cfg.tls.acme_email ?? ''),
    dc('db_dir', 'string', cfg.storage.db_dir),
    dc('data_dir', 'string', cfg.storage.data_dir),
    dc('backup_location', 'string', cfg.storage.backup_location ?? ''),
    dc('exchange_location', 'string', cfg.storage.exchange_location),
    // TLS. tls_method is the question the operator sees; own_ssl is kept in the
    // preseed so a package predating tls_method still selects the same path.
    dc('tls_method', 'select', tlsMethod(cfg)),
    dc('own_ssl', 'boolean', cfg.tls.mode === 'own'),
    dc('own_ssl_path', 'string', cfg.tls.own_cert_path ?? ''),
    dc('acme_env_file', 'string', cfg.tls.acme_env_file ?? ''),
    // Caddy path. The DNS API token is deliberately absent: it is a secret, so it
    // is asked by debconf (password type) or preseeded separately by the operator
    // — never written into a rendered artifact.
    dc('caddy_domain', 'string', cfg.tls.terminator === 'caddy' ? cfg.instance.domain : ''),
    dc('caddy_dns_provider', 'string', cfg.tls.dns_provider ?? ''),
    // WireGuard peer coordination. Always preseeded, so an unattended install
    // never stops on the question. (The container channel reads the same values
    // from .env — see WIREGUARD_* in renderEnv.)
    dc('wireguard_enabled', 'boolean', cfg.wireguard.enabled),
    dc('wireguard_coordinator', 'string', cfg.wireguard.coordinator),
    dc('wireguard_listen_port', 'string', cfg.wireguard.listen_port),
    dc('wireguard_reflector_port', 'string', cfg.wireguard.reflector_port),
  ];
  // Only preseed an explicit IP; 'auto' leaves detection to the installer.
  if (cfg.network.ip4 && cfg.network.ip4 !== 'auto') {
    lines.push(dc('ip4', 'select', 'other'));
    lines.push(dc('public_ip4', 'string', cfg.network.ip4));
  }
  if (cfg.network.ip6 && cfg.network.ip6 !== 'auto') {
    lines.push(dc('ip6', 'select', 'other'));
    lines.push(dc('public_ip6', 'string', cfg.network.ip6));
  }
  return lines.join('\n') + '\n';
}

// --------------------------------------------------------- caddyfile
// Rendered from tls.mode + domain so dev (localhost -> HTTP) and prod (real
// domain -> automatic HTTPS) share one source. Routing is identical across modes:
// static bundles/assets from disk, /-/svc -> REST, everything else -> pages.
function renderCaddyfile(cfg) {
  const dom = cfg.instance.domain;
  const local = cfg.instance.local_mode || dom === 'localhost' || dom === 'local';
  const body =
`	handle_path /-/app/* {
		root * /srv/ui/main/app
		file_server
	}
	handle_path /-/static/* {
		root * /srv/static
		file_server
	}
	handle_path /-/images/* {
		root * /srv/static/images
		file_server
	}
	handle /-/svc/* {
		reverse_proxy server-pod:{$API_PORT:24000}
	}
	reverse_proxy server-pod:{$UI_PORT:23000}
`;
  // Security headers for real deployments (skipped on local HTTP where HSTS
  // would poison the browser for localhost).
  const secHeaders =
`	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "SAMEORIGIN"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
`;
  let header = '';
  let site = dom;
  let tls = '';
  if (local) {
    site = ':80';                                  // plain HTTP for local dev
  } else if (cfg.tls.mode === 'acme') {
    header = `{\n\temail ${cfg.tls.acme_email || ''}\n}\n\n`;   // auto HTTPS
  } else if (cfg.tls.mode === 'self-signed') {
    tls = '\ttls internal\n';                      // Caddy local CA
  } else if (cfg.tls.mode === 'own') {
    const p = cfg.tls.own_cert_path;
    tls = `\ttls ${p}/cert.pem ${p}/key.pem\n`;     // bring-your-own certs
  }
  return `# Generated by config/render.mjs from drumee.yaml — do not edit by hand.\n`
    + `${header}${site} {\n${tls}${local ? '' : secHeaders}${body}}\n`;
}

// --------------------------------------------------------- compose
// Source-accurate topology (confirmed against server-team/ui-team):
//   - server-pod runs index.js (pages + WebSocket) and service.js (REST) via pm2
//   - the UI is a build artifact, not a service: ui-build runs once, publishes
//     assets into a shared volume that server-pod serves from $DRUMEE_UI_HOME
//   - the proxy routes everything to server-pod (/-/* = REST, else = pages)
function renderCompose(cfg) {
  const redisCmd = cfg.redis.password
    ? `command: ["redis-server", "--requirepass", "$\{REDIS_PASSWORD}"]` : 'command: ["redis-server"]';
  return `# Generated by config/render.mjs from drumee.yaml — do not edit by hand.
# Reads values from the sibling .env. Bring up with:
#   docker compose --env-file .env up -d
# Optional services are gated by COMPOSE_PROFILES in .env.
networks:
  drumee: {}

volumes:
  caddy_data: {}
  caddy_config: {}
  ui_assets: {}
  static_assets: {}
  drumee_cred: {}
  infra_jitsi: {}
  infra_mail: {}
  infra_dns: {}

services:
  mariadb:
    image: mariadb:11
    restart: unless-stopped
    networks: [drumee]
    # Known root password so schemas-init can create DBs + grant the app user.
    # The app user (drumee-app) and the yp/utils/mailserver/template/trash DBs are
    # created by schemas-init, NOT here — Drumee is multi-DB with runtime CREATE
    # DATABASE, so the scoped MARIADB_USER/MARIADB_DATABASE model does not fit.
    environment:
      MARIADB_ROOT_PASSWORD: \${DB_ROOT_PASSWORD}
    volumes:
      - \${DRUMEE_DB_DIR}:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7
    restart: unless-stopped
    networks: [drumee]
    ${redisCmd}

  # Run-once: restore the database schema, then exit.
  schemas-init:
    image: \${IMAGE_REGISTRY}/schemas:\${SCHEMAS_TAG}
    networks: [drumee]
    depends_on:
      mariadb:
        condition: service_healthy
    env_file: [.env]
    restart: "no"

  # Run-once: publish the webpack-built UI assets into the shared volume.
  ui-build:
    image: \${IMAGE_REGISTRY}/ui-build:\${UI_TAG}
    volumes:
      - ui_assets:/ui-assets
    restart: "no"

  # Run-once: publish static assets (splash CSS, fonts, logo) into the shared
  # volume the proxy serves at /-/static and /-/images. Opt-in (needs the static
  # image built from the 'static' source repo): enable via COMPOSE_PROFILES=static.
  static:
    profiles: ["static"]
    image: \${IMAGE_REGISTRY}/static:\${STATIC_TAG}
    volumes:
      - static_assets:/static-assets
    restart: "no"

  # Run-once: stock the entity pool + create system accounts (nobody/guest/system)
  # + the RSA keypair (into the shared credential volume). Runs after the schema
  # is loaded and Redis is up.
  schemas-populate:
    image: \${IMAGE_REGISTRY}/schemas-populate:\${SERVER_TAG}
    networks: [drumee]
    depends_on:
      mariadb:
        condition: service_healthy
      redis:
        condition: service_started
      schemas-init:
        condition: service_completed_successfully
    env_file: [.env]
    # CREATE_ADMIN=1 also provisions the admin account + a password-reset link
    # (printed in this service's logs). Default off — first-run can use the wizard.
    environment:
      CREATE_ADMIN: "\${CREATE_ADMIN:-0}"
      POOL_COUNT: "\${POOL_COUNT:-10}"
      ADMIN_PASSWORD: "\${ADMIN_PASSWORD:-}"
    volumes:
      - \${DRUMEE_DATA_DIR}:/data
      - drumee_cred:/etc/drumee/credential
    restart: "no"

  # Pool replenisher daemon: keeps the hub/drumate entity pool at a watermark so
  # signups/hub creation never hit EMPTY_FACTORY (upstream runs offline/factory
  # natively). Same image as schemas-populate; the entrypoint provides DB config.
  factory:
    image: \${IMAGE_REGISTRY}/schemas-populate:\${SERVER_TAG}
    command: ["node", "/srv/drumee/runtime/server/main/container-factory.js"]
    restart: unless-stopped
    networks: [drumee]
    depends_on:
      schemas-populate:
        condition: service_completed_successfully
    env_file: [.env]
    environment:
      POOL_WATERMARK: "\${POOL_WATERMARK:-10}"
      POOL_INTERVAL: "\${POOL_INTERVAL:-30}"
    volumes:
      - \${DRUMEE_DATA_DIR}:/data
      - drumee_cred:/etc/drumee/credential
    # Override the HTTP healthcheck inherited from the server-pod base image:
    # the factory is a headless daemon with no listening port, so probe that the
    # daemon process is alive instead (node:20-slim has no pgrep — scan /proc).
    healthcheck:
      test: ["CMD-SHELL", "grep -slae container-factory /proc/[0-9]*/cmdline >/dev/null 2>&1 || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

  server-pod:
    image: \${IMAGE_REGISTRY}/server-pod:\${SERVER_TAG}
    restart: unless-stopped
    networks: [drumee]
    depends_on:
      mariadb:
        condition: service_healthy
      redis:
        condition: service_started
      schemas-init:
        condition: service_completed_successfully
      schemas-populate:
        condition: service_completed_successfully
      ui-build:
        condition: service_completed_successfully
    env_file: [.env]
    volumes:
      - \${DRUMEE_DATA_DIR}:/data
      - ui_assets:/srv/drumee/runtime/ui:ro
      - drumee_cred:/etc/drumee/credential
      # Server plugins — host-mounted so they persist across image upgrades and
      # are managed with: drumee-ctl plugin add|list|remove
      - ./plugins:/srv/drumee/runtime/plugins/server

  proxy:
    image: caddy:2
    restart: unless-stopped
    networks: [drumee]
    depends_on:
      server-pod:
        condition: service_started
    ports:
      - "80:80"
      - "443:443"
    env_file: [.env]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      # UI bundles served as static files by the proxy (like nginx in prod),
      # NOT proxied to node. Published by ui-build into this shared volume.
      - ui_assets:/srv/ui:ro
      # Static assets (splash/fonts/logo); empty unless the 'static' profile ran.
      - static_assets:/srv/static:ro

  # WireGuard peer coordination — lets this instance be reached without opening a
  # port on the router. Gated by the 'wireguard' profile, which .env enables from
  # wireguard.enabled. Runs the SAME bootstrap.sh + agent.js the native package
  # ships (see deploy/docker/Dockerfile.wireguard).
  wireguard:
    profiles: ["wireguard"]
    image: \${IMAGE_REGISTRY}/wireguard:\${SERVER_TAG}
    restart: unless-stopped
    # wg0 has to be created in the HOST network namespace: the tunnel must reach
    # the ports the proxy publishes there, and the NAT mapping the agent probes
    # must be the host's own. network_mode and 'networks:' are mutually exclusive,
    # hence no drumee network here — the agent talks only to the coordinator.
    network_mode: host
    cap_add: [NET_ADMIN]
    # Requires the wireguard kernel module on the HOST: sudo modprobe wireguard.
    # Deliberately no depends_on: coordination is how the box becomes reachable
    # at all, so it should come up even when the app stack is still starting.
    env_file: [.env]
    volumes:
      # Persists the node keypair (generated on first start, never leaves here).
      - drumee_cred:/etc/drumee/credential

  # Run-once: render the canonical optional-service configs (Jitsi/Prosody/Coturn,
  # Postfix/OpenDKIM, BIND) with setup-infra's own engine into the infra_* volumes
  # the service containers below consume. Runs if any optional profile is active.
  infra-init:
    profiles: ["jitsi", "mail", "dns"]
    image: \${IMAGE_REGISTRY}/infra-init:\${SERVER_TAG}
    networks: [drumee]
    env_file: [.env]
    environment:
      INFRA_PARTS: "jitsi mail dns"
      WITH_JITSI: "1"
    volumes:
      - infra_jitsi:/out/jitsi
      - infra_mail:/out/mail
      - infra_dns:/out/dns
    restart: "no"

  jitsi:
    profiles: ["jitsi"]
    image: jitsi/web:stable
    restart: unless-stopped
    networks: [drumee]
    depends_on:
      infra-init:
        condition: service_completed_successfully
    # consumes infra_jitsi (conference.json + prosody/jicofo/jvb/web configs);
    # mount paths depend on the upstream image layout — see docs/infra-init.md TODO.
    volumes:
      - infra_jitsi:/drumee-infra:ro

  prosody:
    profiles: ["prosody"]
    image: prosody/prosody:latest
    restart: unless-stopped
    networks: [drumee]

  coturn:
    profiles: ["coturn"]
    image: coturn/coturn:latest
    restart: unless-stopped
    networks: [drumee]
`;
}

// ------------------------------------------------------------------------ main
function load(opts) {
  let text;
  try { text = readFileSync(opts.config, 'utf8'); }
  catch { die(`cannot read config: ${opts.config}`); }
  const cfg = applyDefaults(parseYaml(text));
  validate(cfg);
  return cfg;
}

function emit(content, out) {
  if (out) {
    mkdirSync(dirname(out) || '.', { recursive: true });
    writeFileSync(out, content);
    console.error(`wrote ${out}`);
  } else {
    process.stdout.write(content);
  }
}

const { command, opts } = parseArgs(process.argv.slice(2));

switch (command) {
  case 'validate': {
    const cfg = load(opts);
    console.error('config OK');
    console.log(JSON.stringify(cfg, null, 2));
    break;
  }
  case 'env': { emit(renderEnv(withSecrets(load(opts))), opts.out); break; }
  case 'compose': { emit(renderCompose(load(opts)), opts.out); break; }
  case 'caddyfile': { emit(renderCaddyfile(load(opts)), opts.out); break; }
  case 'debconf': { emit(renderDebconf(load(opts)), opts.out); break; }
  case 'all': {
    const cfg = withSecrets(load(opts));
    emit(renderEnv(cfg), join(opts.outDir, '.env'));
    chmodSync(join(opts.outDir, '.env'), 0o600);  // holds DB root credentials
    emit(renderCompose(cfg), join(opts.outDir, 'docker-compose.yml'));
    emit(renderCaddyfile(cfg), join(opts.outDir, 'Caddyfile'));
    emit(renderDebconf(cfg), join(opts.outDir, 'install.conf'));
    if (Array.isArray(cfg.plugins) && cfg.plugins.length) {
      // operator/installer applies it: drumee[-ctl] plugin apply plugins.json
      emit(JSON.stringify(cfg.plugins, null, 2) + '\n', join(opts.outDir, 'plugins.json'));
    }
    break;
  }
  default:
    die(`unknown command: ${command ?? '(none)'}\n` +
        'usage: render.mjs validate|env|compose|caddyfile|debconf|all [--config FILE] [--out FILE] [--out-dir DIR]');
}

function withSecrets(cfg) {
  const generated = fillSecrets(cfg);
  if (generated.length) {
    console.error(`note: generated random secrets for: ${generated.join(', ')}`);
    console.error('      pin them in drumee.yaml for reproducible re-renders.');
  }
  return cfg;
}
