#!/usr/bin/env node

const {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync
} = require('fs');
const RECURVISE = { recursive: true };

const { camelCase, template } = require('lodash');
const { resolve, dirname } = require('path');
const { exit, env } = process;
const args = require("./args")
const tpl_base = new RegExp(`^${__dirname}/template/`)

/**
 * 
 * @param {*} a 
 */
function fatal(a) {
  console.log(`[Fatal error]: ${a}`);
  exit(1);
}


function render(target, tpl_file) {
  if (!/\.tpl$/.test(tpl_file)) {
    return
  }

  if (!existsSync(tpl_file)) {
    fatal(`[Template not found]: ${tpl_file}`);
  }

  let filename = tpl_file.replace(tpl_base, '').replace(/\.tpl$/, '')
  let dest_file = resolve(target, filename);
  let fig = args.fig.split(/[.-_\/]/);
  let group = fig.shift();
  let name = camelCase(fig.join('_'));
  let family = `${group}_${name}`;
  let data = {
    group,
    name,
    family,
    filename: dest_file.replace(resolve(__dirname, '..'), ''),
    parent: args.parent || 'LetcBox',
    service: "trigger-my-service",
    dest: args.dest,
    date: new Date().toISOString()
  };
  let templateFile = readFileSync(tpl_file, 'utf-8');
  let content = String(templateFile).trim().toString();
  const renderer = template(content);
  const dir = dirname(dest_file);
  if (!existsSync(dir)) {
    mkdirSync(dir, RECURVISE);
  }
  content = renderer(data).replace(/\#\{/g, '${');
  writeFileSync(dest_file, content, 'utf-8');

}

// -----------------------------------------------------------------
function targetDir() {
  let target;
  if (/^\//.test(args.dest)) {
    target = args.dest;
  } else {
    target = resolve(env.PWD, args.dest)
  }

  if (existsSync(target)) {
    fatal(`Destination ${target} already exist!`);
    return
  }
  mkdirSync(target, RECURVISE);
  return target
}

/**
 * 
 * @param {*} target 
 */
function build(target) {
  const tpl_base = resolve(__dirname, 'template');
  const folders = [
    tpl_base,
    resolve(tpl_base, 'skeleton'),
    resolve(tpl_base, 'skin')
  ];
  for (let dir of folders) {
    readdirSync(dir).forEach(function (f) {
      let full_path = resolve(dir, f);
      let stat = statSync(full_path);
      if (stat.isDirectory()) {
        let dest = resolve(target, f);
        mkdirSync(dest, RECURVISE);
      } else if (stat.isFile()) {
        render(target, resolve(dir, f));
      }
    });
  }
}

const tartget = targetDir();
build(tartget);
console.log(`The new Drumee Widget was created and placed a ${tartget}`);
