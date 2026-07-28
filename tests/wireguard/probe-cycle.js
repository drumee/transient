'use strict';
/**
 * Second real-kernel test: the borrow/return cycle must be repeatable, and it
 * must stand down while a rendezvous is in flight.
 *
 * Timeline (probe interval is 25s, negotiation window 30s):
 *   t=0    agent starts -> probe #1
 *   t=10s  fake coordinator sends peer-info -> programPeer() stamps the window
 *   t=25s  probe #2 due, 15s into the window -> MUST be skipped
 *   t=50s  probe #3 due, 40s after programming, no handshake -> MUST run again
 */
const dgram = require('dgram');
const http = require('http');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');

const LISTEN_PORT = 51820;
const REFLECTOR_PORT = 51821;
const WS_PORT = 18444;
const CONF = '/tmp/wg-cycle.json';
const PEER_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0=';

fs.writeFileSync(CONF, JSON.stringify({
  enabled: true,
  coordinator_host: `127.0.0.1:${WS_PORT}`,
  coordinator_url: `ws://127.0.0.1:${WS_PORT}/`,
  reflector_host: '127.0.0.1',
  reflector_port: REFLECTOR_PORT,
  listen_port: LISTEN_PORT,
}));

const observed = [];
const refl = dgram.createSocket('udp4');
refl.on('message', (msg, rinfo) => {
  let p; try { p = JSON.parse(msg.toString('utf8')); } catch { return; }
  observed.push({ port: rinfo.port, at: Date.now() });
  refl.send(JSON.stringify({
    type: 'observed-endpoint', address: rinfo.address, port: rinfo.port, nonce: p.nonce,
  }), rinfo.port, rinfo.address);
});
refl.bind(REFLECTOR_PORT, '127.0.0.1');

// Server -> client text frame (no masking required in that direction).
function wsFrame(obj) {
  const body = Buffer.from(JSON.stringify(obj));
  const head = body.length < 126
    ? Buffer.from([0x81, body.length])
    : Buffer.concat([Buffer.from([0x81, 126]), (() => {
      const b = Buffer.alloc(2); b.writeUInt16BE(body.length); return b;
    })()]);
  return Buffer.concat([head, body]);
}

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
http.createServer().on('upgrade', (req, socket) => {
  const accept = crypto.createHash('sha1')
    .update(req.headers['sec-websocket-key'] + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\n'
    + 'Upgrade: websocket\r\nConnection: Upgrade\r\n'
    + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.on('data', () => {});
  setTimeout(() => {
    console.log('[ws] sending peer-info (starts the negotiation window)');
    socket.write(wsFrame({
      type: 'peer-info',
      peerPubkey: PEER_KEY,
      endpoint: { address: '127.0.0.1', port: 9 },
      allowedIps: '10.90.0.2/32',
      fireAt: Date.now(),
      nonce: 'cycle-test',
    }));
  }, 10_000);
}).listen(WS_PORT, '127.0.0.1');

const wgPort = () => execFileSync('wg', ['show', 'wg0', 'listen-port']).toString().trim();

(async () => {
  execFileSync('/usr/local/lib/drumee/wireguard/bootstrap.sh',
    [], { env: { ...process.env, DRUMEE_WG_CONF: CONF }, stdio: 'inherit' });

  const out = [];
  const agent = spawn('node', ['/usr/local/lib/drumee/wireguard/agent.js'],
    { env: { ...process.env, DRUMEE_WG_CONF: CONF } });
  const t0 = Date.now();
  const tag = (d) => d.toString().split('\n').filter(Boolean)
    .map((l) => `[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${l}`).join('\n');
  agent.stdout.on('data', (d) => { out.push(d.toString()); console.log(tag(d)); });
  agent.stderr.on('data', (d) => { out.push(d.toString()); console.error(tag(d)); });

  await new Promise((r) => setTimeout(r, 54_000));
  agent.kill();
  await new Promise((r) => setTimeout(r, 500));

  const log = out.join('');
  const skips = (log.match(/probe skipped/g) || []).length;
  const checks = [
    [`probed more than once (${observed.length} probes)`, observed.length >= 2],
    [`every probe came from ${LISTEN_PORT}`,
      observed.length > 0 && observed.every((o) => o.port === LISTEN_PORT)],
    [`wg0 still on ${LISTEN_PORT} at the end (is ${wgPort()})`, wgPort() === String(LISTEN_PORT)],
    [`stood down during the rendezvous (${skips} skip(s))`, skips >= 1],
    ['skip reason names the rendezvous', /probe skipped — a rendezvous is in flight/.test(log)],
    ['peer was programmed on the real interface',
      execFileSync('wg', ['show', 'wg0', 'peers']).toString().includes(PEER_KEY)],
    ['no ephemeral fallback / bind failure',
      !/falling back to ephemeral|cannot bind udp/.test(log)],
    ['never lost the port', !/is NOT listening on/.test(log)],
  ];
  console.log('\n=== results ===');
  let fail = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) fail++;
  }
  process.exit(fail ? 1 : 0);
})();
