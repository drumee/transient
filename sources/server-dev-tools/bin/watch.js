#!/usr/bin/env node
const { resolve, join } = require("path");
const { existsSync, readFileSync, watch } = require("fs");
const { SRC_PATH } = process.env;
const { exit } = process;
const { exec } = require('shelljs');
const p = require('yargs/yargs')(process.argv.slice(2));
const argv = p.parse();

if (!argv.dir) {
  if (SRC_PATH) {
    argv.dir = SRC_PATH;
  } else {
    argv.dir = resolve(__dirname, '../../../..');
  }
}

if (!existsSync(argv.dir)) {
  console.log(`Could not watch ${argv.dir}, directory not found`);
  exit(1);
}
const ignoreFile = join(argv.dir, '.dev-tools.rc/ignored.txt')
let content = readFileSync(ignoreFile, 'utf8');
content = content.replace(/[ \t]+/, '')

let ignored = content.split('\n').map((e) => {
  if (!e.length) return null;
  let r = e.replace('*', '.*', 'g')
  return new RegExp(r)
})
console.log(`Watching changes on ${argv.dir}`, ignored);
let timer = null;
watch(argv.dir, {
  encoding: 'utf8', recursive: true
}, (e, filename) => {
  for (let re of ignored) {
    if (re && re.test(filename)) {
      return
    }
  }
  if (timer) return;
  timer = setTimeout(() => {
    let cmd = join(__dirname, "handler")
    console.log(`${cmd}`);
    exec(`${cmd} ${argv.onChange}`);
    timer = null;
  }, 500)
});


