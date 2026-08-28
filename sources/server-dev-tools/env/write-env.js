const {
  mkdirSync, writeSync, openSync, close, readFileSync
} = require("fs");
const { env } = process;
const { template, isEmpty } = require("lodash");

const { resolve, join, dirname } = require("path");
const { args } = require('./args')


/**
 * 
 * @param {*} err 
 */
function __error(err) {
  if (err) throw err;
};


/**
 * 
 */
function render() {
  let tpl = resolve(__dirname, "templates", `${args.type}.tpl.sh`);
  let str = readFileSync(tpl);
  args.endpoint = args.endpoint || args.user;
  try {
    let res = template(String(str).toString())(args);
    return res;
  } catch (e) {
    console.error(`Failed to render from template ${tpl}`);
    console.error("------------\n", e);
  }
};

/**
 *
 */
function write() {
  let base_dir = resolve(args.base_dir, ".dev-tools.rc");
  let filename = resolve(base_dir, `${args.output}.sh`);
  mkdirSync(base_dir, { recursive: true });
  if(args.type === "plugin") {
    if(isEmpty(args.plugin)) {
      console.error("----------------------------------------\n");
      console.error("Plugin name is required for plugin type");
      console.error("----------------------------------------\n");
      process.exit(1);
    }
  }
  console.log(`Writing environment variables to ${filename}`);
  let fd = openSync(filename, "w+");
  writeSync(fd, render());
  close(fd, __error);
}

write();
