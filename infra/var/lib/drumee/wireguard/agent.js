'use strict';

/**
 * Drumee WireGuard agent.
 *
 * Runs as a long-lived service on each Drumee node (Raspberry Pi box or
 * server). It is the client counterpart of the coordination server described
 * in docs/wireguard.md.
 *
 * Sequence:
 *   1. Open a UDP socket bound to the SAME port wg0 listens on, and probe the
 *      coordination server's reflector. The reply carries our public IP:port
 *      as observed from outside — the only way to learn the NAT mapping.
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
 * Bound to conf.listen_port — the same port wg0 uses. Two sockets cannot share
 * a port, so we bind with SO_REUSEADDR and only use this socket for probing;
 * the kernel WireGuard implementation owns the port for real traffic. On Linux
 * this works because the wg interface socket is kernel-side, not a userspace
 * bind. If the bind ever fails we fall back to an ephemeral port and log it —
 * the mapping will be less reliable but the agent stays up.
 */
function createProbeSocket() {
  return new Promise((resolve) => {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sock.once('error', (e) => {
      err('probe socket bind failed, falling back to ephemeral port:', e.message);
      const fallback = dgram.createSocket({ type: 'udp4' });
      fallback.bind(0, () => resolve(fallback));
    });
    sock.bind(conf.listen_port, () => resolve(sock));
  });
}

function probeReflector(sock) {
  return new Promise((resolve, reject) => {
    const nonce = Math.random().toString(36).slice(2);
    const payload = JSON.stringify({ pubkey: PUBKEY, nonce });

    const timer = setTimeout(() => {
      sock.removeListener('message', onMessage);
      reject(new Error('reflector probe timed out'));
    }, 5000);

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

async function connect(probeSock) {
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

    // Re-probe periodically: NAT mappings expire and ISP prefixes change.
    const reprobe = async () => {
      try {
        const ep = await probeReflector(probeSock);
        log('observed endpoint', `${ep.address}:${ep.port}`);
      } catch (e) {
        err('probe failed:', e.message);
      }
    };
    await reprobe();
    const probeTimer = setInterval(reprobe, 25_000);
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
    setTimeout(() => connect(probeSock), reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
  });

  ws.addEventListener('error', (e) => err('socket error:', e.message || e.type));
}

(async () => {
  if (!conf.enabled) {
    log('disabled in config — exiting');
    process.exit(0);
  }
  const probeSock = await createProbeSocket();
  log('node public key', PUBKEY);
  await connect(probeSock);
})();
