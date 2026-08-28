const { Constants, Script, toArray } = require("@drumee/server-essentials");
const {
  INTERNAL_ERROR,
  PDFINFO,
  FOLDER,
  ORIGINAL,
  SAFETY_LOCK,
  DIRECTORY_IS_LOCKED,
} = Constants;

const {
  existsSync, createReadStream, rmSync, mkdirSync,
  statSync, renameSync, cpSync
} = require("fs");
const { readdir } = require('fs/promises');

const { resolve, join, normalize, dirname } = require("path");
const { spawn: Spawn } = require("child_process");
const { isEmpty, isString, keys } = require("lodash");

/**
 *
 * @param {*} path
 * @returns
 */
function check_safety(path) {
  const lock = join(path, SAFETY_LOCK);
  if (existsSync(lock)) {
    console.log({ error: "500", message: DIRECTORY_IS_LOCKED });
    throw DIRECTORY_IS_LOCKED;
  }
  return 1;
}

/**
 *
 * @param {*} dir
 */
function rmdir(dir) {
  dir = normalize(dir);
  check_safety(dir);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
}

/**
 *
 * @param {*} file
 */
function rmfile(file) {
  file = normalize(file);
  check_safety(file);
  if (existsSync(file)) {
    rmSync(file);
  }
}

/**
 *
 * @param {*} dirname
 */
function mkdir(dirname) {
  return mkdirSync(dirname, { recursive: true });
}

/**
 *
 * @param {*} opt
 * @param {*} src
 * @param {*} dest
 */
function cp(opt = {}, src, dest) {
  cpSync(src, dest, { ...opt, recursive: true });
}

/**
 *
 * @param {*} filepath
 * @returns
 */
function pdfPagesCount(filepath) {
  const { exec } = require("shelljs");
  let { stdout } = exec(`${PDFINFO} ${filepath}`, { silent: true });
  stdout = stdout.replace(/\n/g, "");
  stdout = stdout.replace(/^.+Pages: +/, "");
  stdout = stdout.match(/^\d/);
  let n = 0;
  try {
    n = ~~stdout[0];
  } catch (error) { }
  return n;
}

/**
 *
 * @param {*} cmd
 */
function exec(cmd) {
  console.log(`EXECUTING cmd=#:: ${cmd} --------------`);
  const { exec } = require("shelljs");
  const r = exec(cmd);
  if (parseInt(r.code) !== 0) {
    console.log(`${cmd} has failed:`, r);
    throw { error: "500", message: INTERNAL_ERROR };
  }
}

/**
 * returns absolute path attached to node
 */
function get_node_content(node, format = ORIGINAL, extension) {
  let p1;
  const mfs_root = node.target_mfs_root || node.mfs_root;
  const id = node.target_nid || node.id || node.nid;
  const ext = extension || node.ext || node.extension;

  if (isEmpty(mfs_root)) {
    console.error("VFS ROOT IS EMPTY", node);
    return null;
  }

  const base = resolve(mfs_root, id);

  if (node.filetype !== FOLDER) {
    p1 = `${base}/${format}.${ext.toLowerCase()}`;
  } else {
    p1 = base;
  }
  return p1;
}

/**
 *
 * @param {*} node
 * @returns absolute path attached to node
 */
function get_base(node) {
  let mfs_root = node.mfs_root || node.home_dir;
  if (isEmpty(mfs_root)) {
    console.error("get_base : VFS ROOT IS EMPTY", node);
    return null;
  }

  if (!/\/__storage__(\/*)/.test(mfs_root)) {
    mfs_root = join(mfs_root, '__storage__');
  }
  const id = node.id || node.nid;

  const base = resolve(mfs_root, id);
  return base;
}

/**
 *
 * @param {*} node
 * @returns absolute path attached to node
 */
function check_base(node) {
  const { mfs_root } = node;
  const id = node.id || node.nid;

  if (isEmpty(mfs_root)) {
    console.error("check_base : VFS ROOT IS EMPTY", node);
    console.trace();
    return null;
  }
  const base = resolve(mfs_root, id);
  if (!existsSync(base)) {
    console.error("check_base : FILE_NOT_FOUND", node);
    return null;
  }

  return base;
}

/**
 * 
 * @param {*} nid 
 * @returns 
 */
function special_dir(nid) {
  switch (~~nid) {
    case -1:
      return "__logo__";
    case -2:
      return "__avatar__";
    case -1:
      return "__favision__";
    default:
      return "__avatar__";
  }
}

/**
 * 
 * @param {*} nid 
 * @param {*} ext 
 * @param {*} type 
 * @returns 
 */
function special_file(nid, ext, type) {
  let e;
  if (/svg/i.test(ext)) {
    e = "svg";
  } else {
    e = "png";
  }
  switch (~~nid) {
    case -1:
      return `favicon.${e}`;
    case -2:
      return `avatar-${type}.${e}`;
    case -3:
      return `logo.${e}`;
    default:
      return `avatar-${type}.${e}`;
  }
}

/**
 *
 * @param {*} src
 * @param {*} dest
 * @param {*} detach
 */
function move_item(src, dest, detach = 0) {
  check_safety(src);
  if (detach) {
    let child = Spawn(`mv`, [src, dest], { detached: true });
    child.unref();
  } else {
    mv(src, dest);
  }
}

/**
 *
 * @param {*} src
 * @param {*} detach
 */
function remove_item(src, detach = 0) {
  const { rm } = require("shelljs");
  check_safety(src);
  if (detach) {
    let child = Spawn(`rm`, [src], { detached: true });
    child.unref();
  } else {
    rm(src);
  }
}

/**
 *
 * @param {*} node
 * @returns
 */
function remove_node(node, detach = 0) {
  const p1 = get_base(node);
  if (!p1) {
    throw ("Base not found for", node);
  }
  if (!check_safety(p1)) {
    throw ("SAFETY ALAERT ", p1, node);
  }
  check_safety(p1);
  if (detach) {
    let child = Spawn(`rm`, ["-rf", p1], { detached: true });
    child.unref();
  } else {
    rmdir(p1);
  }
}

/**
 *
 */
function remove_dir(dirname, detach = 0) {
  check_safety(dirname);
  if (detach) {
    let child = Spawn(`rm`, ["-rf", dirname], { detached: true });
    child.unref();
  } else {
    rmdir(dirname);
  }
}

/**
 *
 * @param {*} src
 * @param {*} dest
 * @param {*} detach
 */
function move_dir(src, dest, detach = 0) {
  check_safety(dest) && check_safety(src);
  if (detach) {
    let child = Spawn(`mv`, [src, dest], { detached: true });
    child.unref();
  } else {
    mv(src, dest);
  }
}

/**
 *
 * @param {*} dirname
 * @returns
 */
function archive_dir(dirname) {
  check_safety(dirname);
  return mv(dirname, `${process.env.data_dir}/archives/`);
}

/**
 *
 * @param {*} src
 * @param {*} dest
 * @param {*} detach
 * @returns
 */
function mv(src, dest) {
  try {
    renameSync(src, dest);
  } catch (e) {
    /** Cant't move cross partition  */
    if (e.code == "EXDEV") {
      cpSync(src, dest, { recursive: true });
      rmSync(src, { recursive: true });
    } else {
      console.warn("Failed to mv", src, e);
      return false;
    }
  }
  return true;
}

/**
 *
 * @param {*} src
 * @param {*} dest
 * @param {*} detach
 * @returns
 */
function move_node(src, dest, detach = 0) {
  var src_path = check_base(src);
  if (!src_path) {
    return;
  }
  var src_path = get_base(src);
  var dest_path = get_base(dest);
  if (!existsSync(src_path)) return
  if (!dest_path || !src_path) {
    console.warn(`Moving inconsistent paths src=${src_path}, dest=${dest_path}`)
    return;
  }
  check_safety(dest_path) && check_safety(src_path);
  if (detach) {
    let parent = dirname(dest_path);
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true });
    }
    let child = Spawn(`mv`, [src_path, dest_path], { detached: true });
    child.unref();
    return
  }
  mv(src_path, dest_path);
}

/**
 *
 */
function copy_node(src, dest, detach = 0) {
  let src_path = check_base(src);
  if (!src_path) {
    return;
  }
  let dest_path = get_base(dest);
  if (!dest_path) {
    return;
  }
  console.log(
    `copy_node detach=${detach} SRC=${src_path} ==> ${dest_path}\n`,
    Script.copy_node,
    src_path,
    dest_path
  );

  check_safety(dest_path);
  if (detach) {
    let child = Spawn(`${Script.copy_node}`, [src_path, dest_path], {
      detached: true,
    });
    child.unref();
  } else {
    cpSync(src_path, dest_path, { recursive: true });
  }
}

/**
 *
 * @param {*} dir
 */
function make_home_dir(dir) {
  const p = join(dir, "__storage__");
  mkdirSync(p, { recursive: true });

}

/**
 *
 * @param {*} src
 * @param {*} dest
 * @returns
 */
function copy_tree(src, dest) {
  const src_path = check_base(src);
  const dest_path = check_base(dest);
  if (!src_path || !dest_path) {
    return;
  }
  check_safety(dest_path);
  return cpSync(src_path, dest_path, { recursive: true });
}

/**
 *
 * @param {*} image
 * @returns
 */
function get_image_dimension(image) {
  if (!existsSync(image)) {
    return { width: 0, height: 0, exists: 0 };
  }
  const { exec } = require("shelljs");
  const width = parseInt(
    exec(
      "identify -format '%w' '" + image + "' | awk '{print $1}'"
    ).stdout.replace("\n", "")
  );
  const height = parseInt(
    exec(
      "identify -format '%h' '" + image + "' | awk '{print $1}'"
    ).stdout.replace("\n", "")
  );
  return { width, height };
}

/**
* 
*/
async function walkDir(dirname) {
  let items = [];

  const walk = async (dir) => {
    try {
      const files = await readdir(dir);
      for (const file of files) {
        let path = resolve(dir, file);
        let stat = statSync(path);
        items.push({ path, stat })
        if (stat.isDirectory()) await walk(path);
      }
    } catch (err) {
      console.trace();
      console.error(err);
    }

  }
  await walk(dirname);
  return items;
}

/**
 * 
 * @param {*} filePath 
 * @returns 
 */
function get_md5Hash(filePath) {
  const { createHash } = require('crypto');
  return new Promise((res, rej) => {
    const hash = createHash('md5');

    const rStream = createReadStream(filePath);
    rStream.on('data', (data) => {
      hash.update(data);
    });
    rStream.on('end', () => {
      res(hash.digest('hex'));
    });
  })
}

/**
 * Clean _seen_ property within the json data
 * @param {*} metadats
 */
function cleanSeen(data) {
  if (!data) return {};
  if (isString(data)) {
    let tmp = JSON.parse(data);
    delete tmp._seen_
    return tmp;
  }
  delete data._seen_
  return data;
}

module.exports = {
  archive_dir,
  get_md5Hash,
  check_base,
  check_safety,
  cleanSeen,
  copy_node,
  copy_tree,
  cp,
  exec,
  get_base,
  get_image_dimension,
  get_node_content,
  make_home_dir,
  mkdir,
  move_dir,
  move_item,
  move_node,
  pdfPagesCount,
  mv,
  remove_dir,
  remove_item,
  remove_node,
  rmdir,
  rmfile,
  special_dir,
  special_file,
  walkDir
};
