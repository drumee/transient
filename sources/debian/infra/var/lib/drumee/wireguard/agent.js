'use strict';

/**
 * Drumee WireGuard agent.
 *
 * Runs as a long-lived service on each Drumee node (Raspberry Pi box or
 * server). It is the client counterpart of the coordination server described
 * in docs/wireguard.md.
 *
 * Sequence:
 *   1. Borrow wg0's fixed port for a moment and probe the coordination server's
 *      reflector from it. The reply carries our public IP:port as observed from
 *      outside — the only way to learn the NAT mapping.
 *   2. Register over WSS with our WireGuard public key. The server replies
 *      with the tunnel address it has allocated to us; we apply it to wg0.
 *   3. On `peer-info`, program the peer and fire the handshake at the agreed
 *      instant so both sides punch their NAT simultaneously.
 *   4. Confirm the handshake so the server cancels its relay fallback, or
 *      accept the relay when it says so.
 *
 * No npm dependency: uses the global WebSocket shipped with Node >= 22.
 */

const dgram = require('dgram');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const CONF_FILE = process.env.DRUMEE_WG_CONF || '/etc/drumee/conf.d/wireguard.json';
const CRED_DIR = '/etc/drumee/credential/wireguard';
const IFACE = 'wg0';

const PROBE_TIMEOUT_MS = 5000;
const PROBE_INTERVAL_MS = 25_000;
// A peer whose last handshake is this recent counts as live: WireGuard's own
// keepalives are then refreshing the NAT mapping, so there is nothing to learn
// and the port must not be taken away from it.
const HANDSHAKE_FRESH_MS = 180_000;
// Grace period after programming a peer but before any handshake exists — a
// rendezvous is in flight and every packet on the fixed port matters.
const NEGOTIATION_MS = 30_000;

// When we last programmed a peer; read by tunnelBusy() to keep the port with wg
// while a punch is in progress.
let lastPeerProgrammedAt = 0;
// Set while a probe holds the fixed port, so a rendezvous can wait for it.
let probeInFlight = null;

const conf = JSON.parse(fs.readFileSync(CONF_FILE, 'utf8'));
const PUBKEY = fs.readFileSync(`${CRED_DIR}/public.key`, 'utf8').trim();

const log = (...a) => console.log('[drumee-wg]', ...a);
const err = (...a) => console.error('[drumee-wg]', ...a);

if (typeof WebSocket === 'undefined') {
  err('this agent needs the global WebSocket API (Node >= 22). Current:', process.version);
  process.exit(1);
}

// --------------------------------------------------------------- wg helpers
async function wg(...args) {
  const { stderr } = await execFileAsync('wg', [...args]);
  if (stderr && stderr.trim()) err('wg:', stderr.trim());
}

async function setTunnelAddress(cidr) {
  // Replace any previously assigned address; the server may reallocate.
  await execFileAsync('ip', ['address', 'flush', 'dev', IFACE]).catch(() => {});
  await execFileAsync('ip', ['address', 'add', cidr, 'dev', IFACE]);
  log('tunnel address set to', cidr);
}

async function programPeer(peerPubkey, endpoint, allowedIps) {
  lastPeerProgrammedAt = Date.now();
  await wg('set', IFACE,
    'peer', peerPubkey,
    'endpoint', `${endpoint.address}:${endpoint.port}`,
    'allowed-ips', allowedIps,
    'persistent-keepalive', '25');
}

/** Reads `wg show` and reports whether this peer has ever completed a handshake. */
async function hasHandshake(peerPubkey) {
  const { stdout } = await execFileAsync('wg', ['show', IFACE, 'latest-handshakes']);
  for (const line of stdout.split('\n')) {
    const [key, ts] = line.split('\t');
    if (key === peerPubkey) return Number(ts) > 0;
  }
  return false;
}

// ------------------------------------------------------------- UDP reflector
/**
 * The probe MUST leave from the port wg0 uses, because the reflector records
 * the mapping of whatever source address it observes (coord-server:
 * src/udpReflector.js -> onObservedEndpoint). A probe from any other port makes
 * the coordinator hand peers an endpoint that points nowhere.
 *
 * A userspace socket cannot share that port with kernel WireGuard: the wg socket
 * is created kernel-side without SO_REUSEPORT, so binding the same port from
 * userspace fails with EADDRINUSE no matter what options we set — measured, and
 * the reason the previous ephemeral-port fallback silently produced useless
 * mappings.
 *
 * So we borrow the port instead: hand wg an ephemeral one, bind ours, probe,
 * then give the fixed port straight back. Cone NAT keeps the external mapping
 * tied to the internal port, which is the same assumption the whole design
 * already rests on (symmetric NAT falls back to the relay either way).
 *
 * Borrowing is only safe while the port is idle, which is enforced three ways:
 * tunnelBusy() (no live peer, no rendezvous in flight), probeInFlight (one
 * borrow at a time), and the peer-info handler awaiting probeInFlight.
 */

/** Point wg0 at a port. 0 makes it pick a random one, freeing the fixed port. */
async function setListenPort(port) {
  await wg('set', IFACE, 'listen-port', String(port));
}

/**
 * Give the fixed port back to wg0. Failing here leaves the node listening
 * somewhere the coordinator will not advertise, i.e. unreachable — so retry
 * before giving up, and make the log unambiguous if we do.
 */
async function reclaimListenPort() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await setListenPort(conf.listen_port);
      return;
    } catch (e) {
      err(`cannot return udp/${conf.listen_port} to ${IFACE} (attempt ${attempt}):`, e.message);
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  err(`${IFACE} is NOT listening on udp/${conf.listen_port} — peers cannot reach this node`);
}

function bindProbeSocket(port) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket({ type: 'udp4' });
    const onError = (e) => { try { sock.close(); } catch { /* already closed */ } reject(e); };
    sock.once('error', onError);
    sock.bind(port, () => { sock.removeListener('error', onError); resolve(sock); });
  });
}

/**
 * close() only *starts* the teardown, and the port stays taken until 'close'
 * fires. Handing it back to wg before that loses a race with the kernel and
 * `wg set listen-port` fails with EADDRINUSE, so wait for it.
 */
function closeSocket(sock) {
  return new Promise((resolve) => {
    sock.once('close', resolve);
    try { sock.close(); } catch { resolve(); }   // already closing
  });
}

/**
 * Whether wg0 is doing something that the port must not be taken away from.
 * Returns a human-readable reason, or null when it is safe to probe.
 */
async function tunnelBusy() {
  if (Date.now() - lastPeerProgrammedAt < NEGOTIATION_MS) return 'a rendezvous is in flight';
  const { stdout } = await execFileAsync('wg', ['show', IFACE, 'latest-handshakes']);
  const nowSec = Date.now() / 1000;
  for (const line of stdout.split('\n')) {
    const [key, ts] = line.split('\t');
    if (!key || !ts) continue;
    if (Number(ts) > 0 && (nowSec - Number(ts)) * 1000 < HANDSHAKE_FRESH_MS) {
      return `peer ${key.slice(0, 8)}… is live`;
    }
  }
  return null;
}

/** Borrows wg0's fixed port, probes the reflector from it, hands the port back. */
function probeFromWgPort() {
  const run = (async () => {
    await setListenPort(0);            // wg keeps running, on a random port
    let sock = null;
    try {
      try {
        sock = await bindProbeSocket(conf.listen_port);
      } catch (e) {
        // Never fall back to another port: a probe from the wrong source would
        // poison the coordinator's record for this pubkey.
        throw new Error(`cannot bind udp/${conf.listen_port} for the probe (${e.message})`);
      }
      return await probeReflector(sock);
    } finally {
      if (sock) await closeSocket(sock);
      await reclaimListenPort();
    }
  })();
  // Barrier for peer-info: resolves when the port is back, never rejects.
  probeInFlight = run.then(() => {}, () => {});
  return run.finally(() => { probeInFlight = null; });
}

function probeReflector(sock) {
  return new Promise((resolve, reject) => {
    const nonce = Math.random().toString(36).slice(2);
    const payload = JSON.stringify({ pubkey: PUBKEY, nonce });

    const timer = setTimeout(() => {
      sock.removeListener('message', onMessage);
      reject(new Error('reflector probe timed out'));
    }, PROBE_TIMEOUT_MS);

    function onMessage(msg) {
      let reply;
      try { reply = JSON.parse(msg.toString('utf8')); } catch { return; }
      if (reply.type !== 'observed-endpoint' || reply.nonce !== nonce) return;
      clearTimeout(timer);
      sock.removeListener('message', onMessage);
      resolve({ address: reply.address, port: reply.port });
    }

    sock.on('message', onMessage);
    // The reflector is a distinct UDP endpoint from the WS coordinator: its
    // host is coordinator_host WITHOUT any port suffix (coordinator_url may
    // carry host:port for the WS side, but that must never reach the UDP
    // probe as a hostname). reflector_host lets a test override it explicitly.
    const reflectorHost = conf.reflector_host
      || conf.coordinator_host.replace(/:\d+$/, '');
    sock.send(payload, conf.reflector_port, reflectorHost, (e) => {
      if (e) { clearTimeout(timer); reject(e); }
    });
  });
}

// ------------------------------------------------------------------ main loop
let ws = null;
let reconnectDelay = 1000;

async function connect() {
  // Production talks WSS to the coordinator (TLS terminated by nginx). A test
  // harness can point at a plain ws:// coordinator via conf.coordinator_url,
  // avoiding certificate setup in throwaway namespaces. Never set in shipped
  // config, so real deployments keep wss:// unconditionally.
  const url = conf.coordinator_url || `wss://${conf.coordinator_host}/`;
  log('connecting to', url);
  ws = new WebSocket(url);

  ws.addEventListener('open', async () => {
    reconnectDelay = 1000;
    ws.send(JSON.stringify({ type: 'register', pubkey: PUBKEY }));

    // Re-probe periodically: NAT mappings expire and ISP prefixes change. Each
    // probe also refreshes the mapping, which matters most while the node sits
    // idle waiting for a client — there is no other traffic on the port then.
    const reprobe = async () => {
      try {
        // Two overlapping borrows would fight over the port: one cycle's reclaim
        // retry lands while the next has already released it. A reconnect
        // re-triggers this, so serialize rather than assume the timer spacing.
        if (probeInFlight) {
          log('probe already in flight — skipping this tick');
          return;
        }
        const busy = await tunnelBusy().catch(() => null);
        if (busy) {
          log(`probe skipped — ${busy}; wg keepalives hold the mapping open`);
          return;
        }
        const ep = await probeFromWgPort();
        log('observed endpoint', `${ep.address}:${ep.port}`);
      } catch (e) {
        err('probe failed:', e.message);
      }
    };
    await reprobe();
    const probeTimer = setInterval(reprobe, PROBE_INTERVAL_MS);
    ws.addEventListener('close', () => clearInterval(probeTimer));
  });

  ws.addEventListener('message', async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    switch (msg.type) {
      case 'registered':
        log('registered with coordinator');
        if (msg.tunnelAddress) {
          await setTunnelAddress(msg.tunnelAddress).catch((e) =>
            err('cannot set tunnel address:', e.message));
        }
        break;

      case 'peer-info': {
        // A probe may be holding the fixed port right now. The handshake has to
        // leave from that port — otherwise it arrives at the peer from an
        // address the coordinator never advertised — so wait for it to come back.
        if (probeInFlight) {
          log('waiting for the in-flight probe to return the port');
          await probeInFlight;
        }
        const wait = Math.max(0, msg.fireAt - Date.now());
        log(`peer ${msg.peerPubkey.slice(0, 8)}… -> firing handshake in ${wait}ms`);
        await programPeer(msg.peerPubkey, msg.endpoint, msg.allowedIps || '0.0.0.0/0')
          .catch((e) => err('programPeer failed:', e.message));

        setTimeout(async () => {
          // Programming the peer is enough for WireGuard to initiate as soon
          // as traffic is routed; a keepalive forces it immediately.
          await wg('set', IFACE, 'peer', msg.peerPubkey, 'persistent-keepalive', '1')
            .catch(() => {});
          setTimeout(async () => {
            if (await hasHandshake(msg.peerPubkey).catch(() => false)) {
              log('direct tunnel established');
              ws.send(JSON.stringify({ type: 'handshake-confirmed', nonce: msg.nonce }));
            }
            await wg('set', IFACE, 'peer', msg.peerPubkey, 'persistent-keepalive', '25')
              .catch(() => {});
          }, 2000);
        }, wait);
        break;
      }

      case 'fallback-relay':
        log('direct path failed — relaying through coordinator');
        if (msg.relay) {
          await programPeer(msg.relay.pubkey, msg.relay.endpoint, msg.relay.allowedIps)
            .catch((e) => err('relay setup failed:', e.message));
        }
        break;

      case 'connect-failed':
        err('connect failed:', msg.reason);
        break;

      default:
        break;
    }
  });

  ws.addEventListener('close', () => {
    err(`disconnected — retrying in ${reconnectDelay}ms`);
    setTimeout(() => connect(), reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
  });

  ws.addEventListener('error', (e) => err('socket error:', e.message || e.type));
}

(async () => {
  if (!conf.enabled) {
    log('disabled in config — exiting');
    process.exit(0);
  }
  // A random port would make every observed mapping meaningless (see the
  // reflector comment above), so refuse to run without a fixed one.
  if (!Number.isInteger(conf.listen_port) || conf.listen_port < 1 || conf.listen_port > 65535) {
    err('listen_port must be a fixed port between 1 and 65535, got:', conf.listen_port);
    process.exit(1);
  }
  log('node public key', PUBKEY);
  await connect();
})();
