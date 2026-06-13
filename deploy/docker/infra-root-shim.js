// Preload shim for setup-infra's infra.js (run with `node -r`).
// Works around an upstream bug: infra.js:560/590 read `args.drumee_root`, but
// utils.js never sets it (no --drumee-root arg, no DRUMEE_ROOT mapping into args)
// → infra.js crashes on any public/private domain branch. We set it from the
// resolved env before infra.js's writeInfraConf runs.
// See /tmp/issue-setup-infra-drumee-root.md — remove once fixed upstream.
const path = require('path');
try {
  const u = require(path.join(process.env.SETUP_INFRA_DIR || '/opt/setup-infra', 'templates', 'utils.js'));
  if (u && u.args && !u.args.drumee_root) {
    u.args.drumee_root = process.env.DRUMEE_ROOT || '/srv/drumee';
  }
} catch (e) {
  console.error('[infra-root-shim] could not patch args.drumee_root:', e && e.message);
}
