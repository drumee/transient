#!/usr/bin/env node
const Minimist = require('minimist');
const argv = Minimist(process.argv.slice(2));
const { Mariadb, RedisStore } = require("@drumee/server-essentials");
const yp = new Mariadb({ name: 'yp', user: process.env.USER, idleTimeout: 60 });
const Organization = require("../lib/organization");
const { exit } = process;
let data = {};
try {
  data = JSON.parse(argv._[0]);
} catch (e) {
  console.error("Argument parse error", e)
  exit(1)
}

let res = new RedisStore();
res.init().then(async () => {
  const org = new Organization({ yp, socket_id: data.socket_id });
  console.log("AAA:18", data)
  if (data.id) {
    await org.remove(data);
  }
  exit(0)
})

