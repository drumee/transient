// service/lib/stripe.js
// Single source for the Stripe client. Reads secrets from sys_conf; NEVER logs them.
const { Cache } = require('@drumee/server-essentials');
const Stripe = require('stripe');

// Pin to the apiVersion the installed SDK bundles (stripe 22.x default).
const API_VERSION = '2026-05-27.dahlia';

let _client = null;

function stripeMode() {
  return Cache.getSysConf('stripe_mode') || 'test'; // 'test' | 'live'
}

function stripeClient() {
  if (_client) return _client;
  const skey = Cache.getSysConf('stripe_skey');
  if (!skey) throw new Error('STRIPE_KEY_MISSING'); // do NOT log skey
  _client = new Stripe(skey, { apiVersion: API_VERSION });
  return _client;
}

function endpointSecret() {
  return Cache.getSysConf('stripe_endpointSecret'); // returned, never logged
}

module.exports = { stripeClient, endpointSecret, stripeMode, API_VERSION };
