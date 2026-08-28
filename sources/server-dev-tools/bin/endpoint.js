#!/usr/bin/env node

const { readFileSync } = require(`jsonfile`);
const { join } = require("path");
const { sysEnv, Template } = require("@drumee/server-essentials");
const { writeConfigs, failed } = require("../lib");
const infra_dir = "/etc/drumee/infrastructure";
const confFile = join(infra_dir, "ecosystem.json");
const args = require('./args/endpoint');
const { action, endpoint, instances, baseDir } = args;

const {
  rmSync, existsSync
} = require("fs");

const routeFile = join(infra_dir, "routes", `${endpoint}.conf`);

let endpoints = readFileSync(confFile) || { acl: [] };
/**
 *
 * @param {*} data
 * @returns
 */
function worker(data, instances = 1) {
  let {
    script,
    pushPort,
    route,
    restPort,
    name,
    server_dir,
    ui_dir,
    base_dir,
    ui_home,
    server_home
  } = data;
  if (!base_dir) base_dir = baseDir || process.env.DRUMEE_RUNTIME_DIR;
  if (!server_dir) server_dir = join(base_dir, 'server');
  if (!ui_dir) ui_dir = join(base_dir, 'ui');
  ui_home = ui_home || `${ui_dir}/${route}`;
  server_home = server_home || `${server_dir}/${route}`;
  let exec_mode = 'fork_mode';
  if (instances > 1) {
    exec_mode = 'cluster_mode';
  }
  let opt = {
    name,
    script,
    cwd: server_home,
    args: `--pushPort=${pushPort} --restPort=${restPort}`,
    route,
    env: {
      cwd: server_home,
      route,
      server_home,
      ui_home
    },
    dependencies: [`pm2-logrotate`],
    exec_mode,
    instances
  };

  opt.watch = []
  if (args.watchDirs) {
    opt.watch = args.watchDirs.split(/,+/);
  } else if (args.watchDefault) {
    opt.watch = [ui_dir, server_dir];
  }
  if (opt.watch.length) {
    opt.watch_delay = args.watchDelay;
    if (args.watchSymLinks) {
      opt.watch_options = {
        followSymlinks: true
      }
    } else {
      opt.watch_options = {
        followSymlinks: false
      }
    }
    let ignored = args.watchIgnore.split(/,+/);
    if (ignored.length) {
      opt.ignore_watch = ignored;
    }
  }
  return opt;
}

/**
 * 
 * @returns 
 */
function getAvailablePushPort() {
  let res = [];

  for (let e of endpoints) {
    if (/pushPort/.test(e.args)) {
      let opt = e.args.replace(/\-+/g, '');
      let [pushPort] = opt.split(/ +/);
      res.push(parseInt(pushPort.replace(/^.+=/, '')));
    }
  }
  return Math.max(...res) + 1;
}

/**
 * 
 */
function endpointExist() {
  let exists = endpoints.filter(function (e) {
    return (e.route && e.route == endpoint);
  })
  return exists.length
}

/**
 * 
 */
function add() {
  if (endpointExist()) {
    failed(`Endpoint ${endpoint} already exists.`)
    return
  }

  let pushPort = getAvailablePushPort();
  let restPort = pushPort + 1000;
  const env = sysEnv();

  if (baseDir) {
    if (existsSync(baseDir)) {
      env.server_home = join(baseDir, 'server', endpoint);
      env.ui_home = join(baseDir, 'ui', endpoint);
      env.ui_plugins_home = join(baseDir, 'plugins', 'ui', endpoint);
      env.server_plugins_home = join(baseDir, 'plugins', 'server', endpoint);
    } else {
      failed(`App base dir ${baseDir} doesn't exist`)
      return
    }
  } else {
    failed(`App base dir ${baseDir} is required`)
  }

  let main = worker({
    ...env,
    route: endpoint,
    name: endpoint,
    restPort,
    pushPort,
    script: "./index.js"
  });
  let service = worker({
    ...env,
    route: endpoint,
    name: `${endpoint}/service`,
    restPort,
    pushPort,
    script: "./service.js"
  }, instances);
  endpoints.push(main);
  endpoints.push(service);
  writeConfigs(confFile, endpoints);
  let d = new Date();
  let date = d.toISOString().split('T')[0];
  const out = routeFile;
  const tpl = join(__dirname, "../templates/route.conf");
  Template.write({ ...env, restPort, pushPort, endpoint, date }, { out, tpl })
}

/**
 * 
 */
function remove() {
  if (!endpointExist()) {
    failed(`Endpoint ${endpoint} was not found.`)
  }
  endpoints = endpoints.filter(function (e) {
    return (!e.route || e.route != endpoint);
  })
  writeConfigs(confFile, endpoints);
  if (existsSync(routeFile)) {
    rmSync(routeFile, { force: true });
  }
}

/**
 * 
 */
function list() {
  console.log(endpoints);
}

const actions = {
  add,
  remove,
  list
}

const cmd = actions[action];
if (cmd) {
  cmd();
} else {
  console.log(`Invalid command ${action}\n`, `Usage : add|remove|list`);
}

