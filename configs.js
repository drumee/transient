
const { sysEnv, loadSysEnv } = require("@drumee/server-essentials");
const { exit } = require('process');
const { existsSync } = require('fs');
const { join } = require('path');
const { readFileSync } = require("jsonfile");
let APP_CONF_DIR = '/etc/drumee/conf.d';

const argparse = require("argparse");
const parser = new argparse.ArgumentParser({
  description: "Drumee Server Essentials Args Parser",
  add_help: true,
});


parser.add_argument("--http-port", {
  type: "int",
  default: 80,
  help: "If set, write minimal configs, no jitsi, no bind",
});

parser.add_argument("--https-port", {
  type: "int",
  default: 443,
  help: "If set, write minimal configs, no jitsi, no bind",
});

parser.add_argument("--restPort", {
  type: "int",
  default: 24000,
  help: "Micro server posrt",
});

parser.add_argument("--pushPort", {
  type: "int",
  default: 23000,
  help: "Page server port + websocket",
});

parser.add_argument("--conf-path", {
  type: String,
  default: null,
  help: "Path to application conf dir",
});

const args = parser.parse_args();

module.exports = args;

if (args.conf_path) {
  loadSysEnv(join(args.conf_path, 'etc'))
  APP_CONF_DIR = join(args.conf_path, 'etc', 'drumee', 'conf.d')
}

const { version } = require('./package.json');
const { endpoint: endpointRoute, endpoint_name } = sysEnv();

global.VERSION = version;
let myDrumee = null;


/**
 * 
 * @param {*} reload 
 * @returns 
 */
function load(reload = 0) {
  const APP_CONF_FILE = join(APP_CONF_DIR, 'drumee.json');
  const JITSI_FILE = join(APP_CONF_DIR, 'conference.json');
  const JITSI_VERSIONS = '/etc/jitsi/versions.js';
  if (myDrumee && !reload) {
    return myDrumee;
  }
  let globalConf = {};
  let myConf;
  if (existsSync(APP_CONF_FILE)) {
    globalConf = readFileSync(APP_CONF_FILE);
  } else {
    console.log(`Could not find default config file ${APP_CONF_FILE}, APP_CONF_DIR=${APP_CONF_DIR}`);
    exit(1);
  }


  let MY_CONF = join(APP_CONF_DIR, endpoint_name, 'myDrumee.json');
  if (existsSync(MY_CONF)) {
    myConf = readFileSync(MY_CONF);
  } else {
    MY_CONF = join(APP_CONF_DIR, 'myDrumee.json');
    if (existsSync(MY_CONF)) {
      myConf = readFileSync(MY_CONF);
    }
  }

  myDrumee = { ...globalConf, ...myConf };
  if (existsSync(JITSI_FILE)) {
    myDrumee.conference = require(JITSI_FILE);
  }
  if (existsSync(JITSI_VERSIONS)) {
    myDrumee.conference.versions = require(JITSI_VERSIONS);
  }
  global.debug_dest = null;
  global.myDrumee = myDrumee;
  global.debug = myDrumee.debug || {};
  global.verbosity = myDrumee.verbosity || process.env.verbosity || 2;
  global.myQuota = { ...myDrumee.quota };
  if (global.verbosity > 3) {
    console.log(`***************************************************`);
    console.log(myDrumee);
    console.log(`***************************************************`);
  }
  return myDrumee;

}

/**
 * 
 * @param {*} response 
 * @param {*} msg 
 * @returns 
 */
const error = function (response, msg = 'SERVER FAULT') {
  console.warn(`_____________ ERROR RAISED ${msg} _____________`);
  if (response.headersSent) {
    return;
  }
  const opt = { 'Content-Type': 'text/html' };
  response.statusCode = 'error';
  response.writeHead(500, opt);
  response.write(msg);
  response.end();
}

/**
 * 
 * @returns 
 */
function getAddress() {
  const os = require('os');

  const networkInterfaces = os.networkInterfaces();

  // To get IPv4 addresses:
  let a = []
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(interface => {
      if (interface.family === 'IPv4' && !interface.internal) {
        a.push(interface.address)
      }
    });
  });
  return a[0]
}

/**
 * 
 * @returns 
 */
function env() {
  //const Db = require('./core/db/mariadb');
  const restPort = args.restPort || 24000;
  const pushPort = args.pushPort || 23000;
  const { Mariadb } = require('@drumee/server-essentials/lib');
  const address = getAddress();
  const endpointAddress = `${address}:${pushPort}`;
  const restServer = `${address}:${restPort}`;

  let limit = parseInt(process.env.db_pool_size, 10) || 5;
  const yp = new Mariadb({ limit });
  const r = {
    yp,
    instance: restServer,
    port: restPort,
    location: process.env.location,
    restServer,
    endpointAddress,
    endpointRoute,
    restPort,
    pushPort,
    error,
  }
  global.endpointAddress = endpointAddress;
  global.wsPeer = pushPort;

  return r;
}

/**
 * 
 */
function handleSignals(cb) {
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGHUP', () => {
    console.log("Reloading settings");
    load(1);
    if (cb) {
      cb()
    }
  });
}

module.exports = { load, env, handleSignals };