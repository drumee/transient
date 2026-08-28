#!/usr/bin/env node

const { readdir } = require("fs/promises");
const { readFileSync, writeFileSync } = require("jsonfile");
const { resolve } = require("path");
const { existsSync } = require('fs');
const { EOL } = require("os");


let services = {};
const argparse = require("argparse");

const parser = new argparse.ArgumentParser({
  description: "Drumee widget initializer",
  addHelp: true,
});

parser.add_argument("--ui-services-path", {
  type: String,
  required: true,
  help: "UI services directory.",
});

parser.add_argument("--server-path", {
  type: String,
  required: true,
  help: "Server src dir",
});

parser.add_argument("--plugins-path", {
  type: String,
  default: '/etc/drumee/conf.d/plugins/main.json',
  help: "Plugins file path",
});


const args = parser.parse_args();

console.log(args)
const target = resolve(args.ui_services_path, 'services.json');

async function loadModules(dirname) {
  const walk = async (dir) => {
    try {
      const files = await readdir(dir);
      for (const file of files) {
        if (!/\.json$/i.test(file)) continue;
        let path = resolve(dir, file);
        let content = readFileSync(path);
        let name = file.replace(/\.json$/, '');
        if (content.modules && content.services) {
          services[name] = {};
          for (let k in content.services) {
            services[name][k] = `${name}.${k}`;
          }
        }
      }
    } catch (err) {
      console.error(__dirname, err, process.env);
    }
  };
  await walk(dirname);
}
let src_dir = resolve(args.server_path, 'acl');
if (!existsSync(src_dir)) {
  console.error(`Services ACL directory not found ${src_dir}`);
  process.exit(1);
}
console.log(`Loading services ACL from ${src_dir}`);
loadModules(src_dir).then(async () => {
  console.log(`Services files generated into ${target}`);
  let plugin = args.plugins_path;
  if (existsSync(plugin)) {
    let { acl } = readFileSync(plugin);
    for (let dir of acl) {
      console.log("Reading ACL from", resolve(dir, 'acl'));
      await loadModules(resolve(dir, 'acl'));
    }
  }
  writeFileSync(target, services, { spaces: 2, EOL });
  process.exit(0);
}).catch((e) => {
  console.error("Failed to generate services map", e);
  process.exit(1);
})