#!/usr/bin/env node
// Entity-pool replenisher daemon — the container equivalent of server-team's
// offline/factory. drumate_create/createHub draw pre-built databases from the
// pool (entity WHERE area='pool' AND pool_state='clean'); without a replenisher
// the pool drains as users sign up and creation fails with EMPTY_FACTORY.
//
// Reuses the proven offline/factory Schema (entity_create -> load genesis
// template -> MFS root -> pool_state='clean'), one entity per tick per type,
// keeping each type's pool at POOL_WATERMARK. Runs in the schemas-populate
// image via populate-entrypoint (which provides db.json, drumee.json, ~/.my.cnf
// for the mariadb CLI over TCP, and USER=drumee-app).
//
// Env: POOL_WATERMARK (default 10), POOL_INTERVAL seconds (default 30),
//      SERVER_MAIN, GENESIS_DIR (same as container-populate).
const path = require('path');

const SERVER_MAIN = process.env.SERVER_MAIN || '/srv/drumee/runtime/server/main';
const GENESIS_DIR = process.env.GENESIS_DIR || '/factory';
const WATERMARK = parseInt(process.env.POOL_WATERMARK || '10', 10);
const INTERVAL = parseInt(process.env.POOL_INTERVAL || '30', 10) * 1000;

const { Mariadb, Cache } = require('@drumee/server-essentials');
const Schema = require(path.join(SERVER_MAIN, 'offline', 'factory', 'schema'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function replenish(yp, type) {
  const free = Number(await yp.await_func('pool_free', type));  // driver returns a string
  if (free >= WATERMARK) return free;
  const script = path.join(GENESIS_DIR, `${type}.sql`);
  const s = new Schema({ type, script, folders: [], lang: 'en', verbose: 0, yp });
  await s.create_entity();
  s.destroy();
  console.log(`[factory] ${type}: ${free} -> ${free + 1} (watermark ${WATERMARK})`);
  return free + 1;
}

async function main() {
  new Cache();
  await Cache.load();
  const yp = new Mariadb({ name: 'yp' });
  console.log(`[factory] replenisher up — watermark=${WATERMARK}, interval=${INTERVAL / 1000}s`);
  for (;;) {
    for (const type of ['drumate', 'hub']) {
      try {
        await replenish(yp, type);
      } catch (e) {
        // transient (db restart, etc.) — log and keep the daemon alive
        console.error(`[factory] ${type} replenish failed:`, e && e.message || e);
      }
    }
    await sleep(INTERVAL);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
