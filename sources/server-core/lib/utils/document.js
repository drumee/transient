

const { existsSync, rmSync} = require('fs');
const { readFileSync, writeFileSync } = require('jsonfile');
const { trim } = require('lodash');
const { Attr, sysEnv } = require("@drumee/server-essentials");

const { resolve, join, normalize } = require('path');
const { remove_dir } = require('./mfs');
const { server_home } = sysEnv();

/**
 * Tmp files already processed and moved to storage. 
 * Clean tmp files
 */
function clearCache(node, info) {
  if (info.tmp_pdf && existsSync(info.tmp_pdf)) {
    if (existsSync(info.fastdir)) {
      let file = resolve(node.mfs_root, node.id, `info.json`);
      remove_dir(info.fastdir, 1);
      delete info.fastdir;
      delete info.tmp_pdf;
      info.locationType = node.ext == 'pdf' ? 'orig' : 'preview';
      writeFileSync(file, info);
    }
  }
}

/**
 * 
 * @param {*} node 
 */
function buildIndex(node) {

  let cmd = resolve(server_home, 'offline', 'media', 'seo.js');
  cleanData(node);
  let args = JSON.stringify(node);
  console.log(`Creating document index for ${node.filepath}`);
  console.log(`Creating document index with\n ${cmd} '${args}'`);
  const Spawn = require('child_process').spawn;
  Spawn(cmd, [args,], { detached: true });
}


/**
 * 
 * @param {*} n 
 */
function cleanData(n) {
  delete n.view_count;
  delete n.metadata;
  delete n.geometry;
  n.filename = decodeURI(encodeURI(n.filename));
  n.filepath = n.filepath || n.ownpath
  if (n.filepath) {
    n.filepath = decodeURI(encodeURI(normalize(n.filepath)));
    n.file_path = n.filepath;
  }
  if (n.filepath) {
    n.parent_path = decodeURI(encodeURI(normalize(n.parent_path)))
  }
  delete n.remit;
  return n;
}

/**
 * 
 * @param {*} pdf 
 * @returns 
 */
function getInfo(node) {
  if (!node.mfs_root) {
    if (/__storage__/.test(node.home_dir)) {
      node.mfs_root = node.home_dir
    } else {
      node.mfs_root = resolve(node.home_dir, '__storage__');
    }
  }
  const mfs_dir = normalize(resolve(node.mfs_root, node.id));
  const info = resolve(mfs_dir, `info.json`);
  if (existsSync(info)) {
    return readFileSync(info);
  } else {
    let pdf = getPdfPath(node);
    if (pdf) {
      let json = getPdfInfo(pdf);
      writeFileSync(info, json);
    }
    return { error: 'FILE_NOT_FOUND' };
  }
}



/**
 * 
 * @param {*} pdf 
 * @returns 
 */
function getPdfInfo(pdf) {
  if (!existsSync(pdf)) return { error: 'FILE_NOT_FOUND' };
  let json = {};
  const { exec } = require('shelljs');
  const { stdout } = exec(`/usr/bin/pdfinfo ${pdf}`, { silent: 1 });
  const lines = stdout.split(/\n/);
  for (let line of lines) {
    const a = line.split(':');
    let key = a[0].toLowerCase();
    if (!key) continue;
    json[key] = trim(a[1]);
  }
  json.pdf = pdf;
  if (json.pages) json.pages = parseInt(json.pages);
  return json;
}

/**
 * 
 * @param {*} node 
 * @returns 
 */
function getPdfPath(node) {
  const mfs_dir = resolve(node.mfs_root, node.id);
  let filepath = null;
  if (node.ext == Attr.pdf) {
    filepath = resolve(mfs_dir, 'orig.pdf');
  } else {
    filepath = resolve(mfs_dir, 'pdfout', 'orig.pdf');
  }
  if (existsSync(filepath)) return filepath;
  return null;
}


/**
 * 
 * @param {*} node 
 * @returns 
 */
function rebuildInfo(node, uid, socket_id) {
  const mfs_dir = resolve(node.mfs_root, node.id);
  const info = resolve(mfs_dir, `info.json`);
  //console.log(`INFO`, info);
  let pdf = null;
  let orig = resolve(mfs_dir, `orig.${node.ext}`);
  let json = {};
  if (existsSync(info)) {
    json = readFileSync(info);
  } else if (!existsSync(orig)) {
    return null;
  }

  const update = (p) => {
    json = getPdfInfo(p);
    json.pdf = p;
    json.buildState = Attr.ok;
    writeFileSync(info, json);
    return { ...json, path: p };
  }

  pdf = resolve(mfs_dir, 'orig.pdf');
  if (existsSync(pdf)) return update(pdf); /** Original is a pdf. No need to rebuild preview */

  pdf = resolve(mfs_dir, 'preview.pdf');  
  /** Remove existing preview to force rebuilding preview,  */
  if (existsSync(pdf)){
    rmSync(pdf);
  } 
  // Legacy logic
  pdf = resolve(mfs_dir, 'pdfout', 'orig.pdf');
  if (existsSync(pdf)){
    rmSync(pdf);
  } 

  let fastdir = json.fastdir;
  let args = { node, uid, socket_id };
  let cmd = resolve(server_home, 'offline', 'media', 'to-pdf.js');
  const Spawn = require('child_process').spawn;
  if (fastdir && existsSync(fastdir)) {
    let tmpfile = join(fastdir, `orig.${node.ext}`);
    if (existsSync(tmpfile)) {
      let docInfo = { fastdir, buildState: "rebuild", tmpfile };
      writeFileSync(info, docInfo);
      console.log(`Using : fastdir : Converting to pdf with\n ${cmd} '${JSON.stringify(args)}'`);
      Spawn(cmd, [JSON.stringify(args)], { detached: true });
      return docInfo;
    }
  }
  if (existsSync(orig)) {
    let docInfo = { fastdir, buildState: "rebuild" };
    writeFileSync(info, docInfo);
    console.log(`Using Orig : Converting to pdf with\n ${cmd} '${JSON.stringify(args)}'`);
    Spawn(cmd, [JSON.stringify(args)], { detached: true });
    return docInfo;
  }
}

module.exports = {
  clearCache,
  buildIndex,
  cleanData,
  getInfo,
  getPdfInfo,
  getPdfPath,
  rebuildInfo,

}