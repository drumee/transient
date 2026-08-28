#!/usr/bin/env node

const { readFileSync } = require(`jsonfile`);
const { join, basename, resolve } = require("path");
const { existsSync, mkdirSync } = require("fs");
const args = require('./args/plugin');
const { action, endpoint } = args;
let { plugin_dir } = args;

const { writeConfigs, failed } = require("../lib");

if (!/^\//.test(plugin_dir)) {
  plugin_dir = resolve(__dirname, '../../../..', plugin_dir)
}
let confDir = "/etc/drumee/conf.d";
if (!existsSync(confDir)) {
  failed(`
    This plugin requires Drumee Server Runtime Environment
    Looks like the is no Drumee Server installed on this server
    No plugin was installed for endpoint ${endpoint}
    Please visite documentation page at https://github.com/drumee
    `
  );
  return;
}

confDir = join(confDir, 'plugins');
mkdirSync(confDir, { recursive: true });

let plugins = { acl: [] };
let confFile = join(confDir, `${endpoint}.json`);
if (existsSync(confFile)) {
  plugins = readFileSync(confFile);
}
const actions = {
  add: function () {
    console.log(`Trying to register plugin from ${plugin_dir}`);
    if (plugins.acl.includes(plugin_dir)) {
      console.warn(`plugin_dir ${plugin_dir} already exists.`);
    } else {
      if (!existsSync(plugin_dir)) {
        failed(`Plugin ${plugin_dir} was not found`);
        return;
      }
      plugins.acl.push(plugin_dir);
      const acl = join(plugin_dir, `acl`);
      const service = join(plugin_dir, `service`);
      if (!existsSync(acl)) {
        failed(`No directory "acl" was found under ${plugin_dir}`);
        return;
      }
      if (!existsSync(service)) {
        failed(`No directory "service" was found under ${plugin_dir}`);
        return;
      }
      writeConfigs(confFile, plugins);
    }
  },
  remove: function () {
    console.log(`Trying to remove plugin ${plugin_dir}`);
    plugins.acl = plugins.acl.filter(function (e) {
      return e != plugin_dir;
    })
    writeConfigs(confFile, plugins);
  },
  list: function () {
    console.log(plugins.acl);
  }
}

const cmd = actions[action];
if (cmd) {
  cmd();
} else {
  console.log(`Invalid command ${action}\n`, `Usage : ${basename(args.$0)} add|remove|list`);
}

