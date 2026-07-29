'use strict';
/**
 * Third real-kernel test: a rendezvous that lands WHILE a probe holds the port.
 *
 * The probe borrows wg0's fixed port for a moment. If `peer-info` were acted on
 * during that window, WireGuard would fire the handshake from the temporary
 * ephemeral port — arriving at the peer from an address the coordinator never
 * advertised, i.e. a punch that cannot succeed. The agent must wait for the port
 * to come back first.
 *
 * Forced deterministically: the reflector sits on its reply for 3s, and the fake
 * coordinator sends peer-info 500ms into that window.
 */
const dgram = require('dgram');
const http = require('http');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');

const LISTEN_PORT = 51820;
const REFLECTOR_PORT = 51821;
const WS_PORT = 18445;
const REPLY_DELAY_MS = 3000;
const CONF = '/tmp/wg-race.json';
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
  observed.push(rinfo.port);
  setTimeout(() => refl.send(JSON.stringify({
    type: 'observed-endpoint', address: rinfo.address, port: rinfo.port, nonce: p.nonce,
  }), rinfo.port, rinfo.address), REPLY_DELAY_MS);
});
refl.bind(REFLECTOR_PORT, '127.0.0.1');

// Server -> client text frame, unmasked. Payloads of 126 bytes or more need the
// 16-bit extended length: stuffing the real length into the second byte would
// set 0x80 there, which the client reads as "masked" and rejects.
function wsFrame(obj) {
  const body = Buffer.from(JSON.stringify(obj));
  if (body.length < 126) return Buffer.concat([Buffer.from([0x81, body.length]), body]);
  const ext = Buffer.alloc(2);
  ext.writeUInt16BE(body.length);
  return Buffer.concat([Buffer.from([0x81, 126]), ext, body]);
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
    console.log('[ws] sending peer-info mid-probe');
    socket.write(wsFrame({
      type: 'peer-info',
      peerPubkey: PEER_KEY,
      endpoint: { address: '127.0.0.1', port: 9 },
      allowedIps: '10.90.0.2/32',
      fireAt: Date.now(),
      nonce: 'race-test',
    }));
  }, 500);
}).listen(WS_PORT, '127.0.0.1');

const wgPort = () => execFileSync('wg', ['show', 'wg0', 'listen-port']).toString().trim();

(async () => {
  execFileSync('/usr/local/lib/drumee/wireguard/bootstrap.sh',
    [], { env: { ...process.env, DRUMEE_WG_CONF: CONF }, stdio: 'inherit' });

  const out = [];
  const lines = [];                       // [{ at: ms since start, text }]
  const agent = spawn('node', ['/usr/local/lib/drumee/wireguard/agent.js'],
    { env: { ...process.env, DRUMEE_WG_CONF: CONF } });
  const t0 = Date.now();
  const record = (d, sink) => {
    out.push(d.toString());
    for (const l of d.toString().split('\n').filter(Boolean)) {
      const at = Date.now() - t0;
      lines.push({ at, text: l });
      sink(`[+${(at / 1000).toFixed(1)}s] ${l}`);
    }
  };
  agent.stdout.on('data', (d) => record(d, console.log));
  agent.stderr.on('data', (d) => record(d, console.error));

  await new Promise((r) => setTimeout(r, 9000));
  agent.kill();
  await new Promise((r) => setTimeout(r, 500));

  const log = out.join('');
  const at = (needle) => lines.find((l) => l.text.includes(needle))?.at;
  const tWait = at('waiting for the in-flight probe');
  const tFire = at('firing handshake');
  // peer-info was sent 500ms in, and the probe holds the port until the
  // reflector answers at REPLY_DELAY_MS. If the peer had been programmed
  // straight away the handshake would have fired at ~500ms; waiting for the
  // port pushes it out to ~REPLY_DELAY_MS. (Log ORDER cannot show this: both
  // continuations run in the same tick once the probe resolves.)
  const checks = [
    ['probe was in flight when peer-info arrived', tWait !== undefined],
    [`handshake held back until the port returned (fired at +${tFire}ms,`
      + ` peer-info at +500ms, probe held the port until +${REPLY_DELAY_MS}ms)`,
      tFire !== undefined && tWait !== undefined
        && tFire > tWait && tFire >= REPLY_DELAY_MS - 500],
    [`probe still came from ${LISTEN_PORT} (got ${observed.join(',') || 'none'})`,
      observed.length > 0 && observed.every((p) => p === LISTEN_PORT)],
    [`wg0 holds ${LISTEN_PORT} at the end (is ${wgPort()})`, wgPort() === String(LISTEN_PORT)],
    ['peer reached the real interface',
      execFileSync('wg', ['show', 'wg0', 'peers']).toString().includes(PEER_KEY)],
  ];
  console.log('\n=== results ===');
  let fail = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) fail++;
  }
  process.exit(fail ? 1 : 0);
})();
