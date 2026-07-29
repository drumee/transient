'use strict';
/**
 * Proves the probe leaves from wg0's OWN port against real kernel WireGuard.
 *
 * Runs inside the drumee/wireguard image (needs --cap-add NET_ADMIN and the
 * wireguard module). Stands up a fake reflector + a minimal WebSocket server on
 * loopback, runs the shipped agent, and asserts:
 *   1. the reflector observed source port == listen_port  (the whole point)
 *   2. wg0 is back on listen_port after the probe          (port returned)
 *   3. the agent never fell back to another port
 */
const dgram = require('dgram');
const http = require('http');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');

const LISTEN_PORT = 51820;
const REFLECTOR_PORT = 51821;
const WS_PORT = 18443;
const CONF = '/tmp/wg-test.json';

fs.writeFileSync(CONF, JSON.stringify({
  enabled: true,
  coordinator_host: `127.0.0.1:${WS_PORT}`,
  coordinator_url: `ws://127.0.0.1:${WS_PORT}/`,
  reflector_host: '127.0.0.1',
  reflector_port: REFLECTOR_PORT,
  listen_port: LISTEN_PORT,
}));

const observed = [];

// --- fake reflector: echo what it sees, exactly like coord-server does -------
const refl = dgram.createSocket('udp4');
refl.on('message', (msg, rinfo) => {
  let p; try { p = JSON.parse(msg.toString('utf8')); } catch { return; }
  observed.push(rinfo.port);
  console.log(`[reflector] probe from ${rinfo.address}:${rinfo.port}`);
  refl.send(JSON.stringify({
    type: 'observed-endpoint', address: rinfo.address, port: rinfo.port, nonce: p.nonce,
  }), rinfo.port, rinfo.address);
});
refl.bind(REFLECTOR_PORT, '127.0.0.1');

// --- minimal RFC6455 server: just enough for the agent's 'open' event --------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
http.createServer().on('upgrade', (req, socket) => {
  const accept = crypto.createHash('sha1')
    .update(req.headers['sec-websocket-key'] + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\n'
    + 'Upgrade: websocket\r\nConnection: Upgrade\r\n'
    + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.on('data', () => {});          // ignore the register frame
  console.log('[ws] agent connected');
}).listen(WS_PORT, '127.0.0.1');

const wgPort = () => execFileSync('wg', ['show', 'wg0', 'listen-port']).toString().trim();

(async () => {
  execFileSync('/usr/local/lib/drumee/wireguard/bootstrap.sh',
    [], { env: { ...process.env, DRUMEE_WG_CONF: CONF }, stdio: 'inherit' });
  console.log(`[test] wg0 before: listen-port ${wgPort()}`);

  const out = [];
  const agent = spawn('node', ['/usr/local/lib/drumee/wireguard/agent.js'],
    { env: { ...process.env, DRUMEE_WG_CONF: CONF } });
  agent.stdout.on('data', (d) => { out.push(d.toString()); process.stdout.write(d); });
  agent.stderr.on('data', (d) => { out.push(d.toString()); process.stderr.write(d); });

  await new Promise((r) => setTimeout(r, 9000));
  agent.kill();
  await new Promise((r) => setTimeout(r, 500));

  const after = wgPort();
  const log = out.join('');
  const checks = [
    ['reflector saw a probe', observed.length > 0],
    [`probe source port == ${LISTEN_PORT} (got ${observed.join(',') || 'none'})`,
      observed.length > 0 && observed.every((p) => p === LISTEN_PORT)],
    [`wg0 back on ${LISTEN_PORT} after probing (is ${after})`, after === String(LISTEN_PORT)],
    ['no ephemeral fallback', !/falling back to ephemeral/.test(log)],
    ['no bind failure', !/cannot bind udp/.test(log)],
    ['endpoint was logged', /observed endpoint 127\.0\.0\.1:51820/.test(log)],
  ];
  console.log('\n=== results ===');
  let fail = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) fail++;
  }
  process.exit(fail ? 1 : 0);
})();
