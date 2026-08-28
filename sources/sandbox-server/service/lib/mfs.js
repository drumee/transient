const { Mariadb, Logger, uniqueId,
  Network, sysEnv, Attr } = require("@drumee/server-essentials");
const { existsSync, mkdirSync, statSync, rmSync } = require("fs");
const { tmp_dir, system_user, system_group } = sysEnv();
const { resolve, extname, basename } = require("path");
const { cp, exec } = require('shelljs');
const Minimist = require('minimist');
const { createHash } = require("crypto");
const { userInfo } = require("os");
const UID = userInfo().uid;
const ARGV = Minimist(process.argv.slice(2));
const Filecap = new Map();

// ******
let TMPDIR = `/tmp/${uniqueId()}`;
if (ARGV.tmpdir) {
  TMPDIR = ARGV.tmpdir
} else if (tmp_dir) {
  TMPDIR = tmp_dir;
}


mkdirSync(TMPDIR, { recursive: true });

class Mfs extends Logger {
  /**
    * 
    * @param {*} opt 
    */
  initialize(opt = {}) {
    this.yp = opt.yp || new Mariadb({ name: "yp" });
    const { db_name } = opt;
    if (!db_name) {
      // console.log(opt);
      throw (`Destination was not found!`);
    }
    this.db = new Mariadb({ name: db_name });
    if (ARGV.resetCache) {
      cleanup()
    }
  }


  /**
   * 
   */
  async end() {
    if (!this.db) return;
    await this.db.stop();
  }

  /**
   * 
   */
  cleanup() {
    console.log(`Cleaning up tmp dir ${TMPDIR}`)
    rmSync(TMPDIR, { recursive: true, force: true });
  }

  /**
    *
    * @param {*} dir
    * @param {*} filter
    */
  async importFile(url, parent) {
    let { pathname, host } = new URL(url);
    pathname = decodeURI(pathname);
    let hash = createHash("md5");
    hash.update(`${host}-${pathname}`);
    let key = hash.digest("hex");

    let ext = extname(pathname);
    if (ext) {
      key = `${key}${ext}`;
      ext = ext.replace(/^\.+/, '');
    }

    let re = new RegExp(`\.${ext}$`, 'i');
    let filename = basename(pathname).replace(re, '');

    const source = resolve(TMPDIR, key);

    if (!source || !existsSync(source)) {
      // console.log(`Downloading ${pathname} => ${source}.`);
      let opt = {
        method: 'GET',
        outfile: source,
        url,
      };
      await Network.request(opt);
    }

    let stat = statSync(source);
    if (stat.isDirectory()) {
      console.log(`Source ${source} is a directory!`);
      return;
    }

    let { home_dir, owner_id, nid } = parent;

    let { category, mimetype } = Filecap.get(ext) || {};
    if (category) {
      let r = await this.yp.await_query(
        `select * from filecap where extension='${ext}'`
      );
      Filecap.set(ext, r);
    }

    /** Skip existing source */
    let id = await this.db.await_func(`node_id_from_path`, pathname);
    if (id != null) {
      let orig = resolve(home_dir, id, `orig.${ext}`);
      if (existsSync(orig)) {
        console.log(`Filepath ${pathname} already exists. Skipped.`);
        return;
      }
      let sql = `DELETE FROM media WHERE id=?`;
      await this.db.await_query(sql, id);
    }
    home_dir = home_dir.replace(/(\/__storage__.*)$/, '');
    let args = {
      owner_id,
      filename,
      pid: nid,
      category,
      ext,
      mimetype,
      filesize: stat.size,
      showResults: 1
    };
    let results = { isOutput: 1 };
    let item = await this.db.await_proc("mfs_create_node", args, {}, results);
    let base = resolve(home_dir, '__storage__', item.id);
    let orig = resolve(base, `orig.${ext}`);
    mkdirSync(base, { recursive: true });
    cp("-u", `${source}`, orig);
    if (UID == 0) {
      exec(`chown ${system_user}:${system_group} ${base}`)
    }
  }

  /**
   * 
   */
  async createSymLink(target, dest) {
    const { hub_id } = target;
    //this.debug("Create symlink 147", { hub_id });
    let { db_name } = await this.yp.await_proc('get_entity', hub_id);
    if (!db_name) {
      this.warn(`Target not found`, target);
    }
    //this.debug("Create symlink 152", target.filetype, { db_name });
    switch (target.filetype) {
      case Attr.hub:
        this.warn("Can not link a hub")
        return
      case Attr.folder:
        let args = {
          owner_id: user_id,
          filename: target.filename,
          pid: dest.nid,
          category: Attr.folder,
          ext: "",
          mimetype: Attr.folder,
          filesize: 0,
        };
        let node = await this.db.await_proc(`mfs_create_node`, args, {}, { show_results: 1 });
        if (db_name) {
          await this.yp.await_proc(`${db_name}.mfs_create_link_by`,
            target.nid,
            dest.uid,
            node.id,
            dest.hub_id
          );
        }
        break;
      default:
        //this.debug("Create symlink 175", target.nid, dest.uid, dest.nid, dest.hub_id, db_name);
        if (db_name) {
          if(!dest.nid || !dest.hub_id){
            this.debug("Link desination in empty", dest)
            break;
          }
          await this.yp.await_proc(`${db_name}.mfs_create_link`,
            target.nid,
            dest.uid,
            dest.nid,
            dest.hub_id
          );
        }
    }
  }



  /**
 * 
 * @param {*} opt 
 * @returns 
 */
  async manifest(opt = {}) {
    let { host, dirname } = opt;
    host = host || 'docs.drumee.com';
    let origin = `https://${host}`;
    dirname = dirname || `/sandox`;
    const data = await Network.request(`${origin}/-/svc/media.manifest?nid=${dirname}`)
    return { origin, dirname, host, nodes: data[0] };
  }

  /**
 * 
 * @param {*} opt 
 * @returns 
 */
  async folderContent(opt = {}) {
    let { host, srcdir } = opt;
    host = host || 'docs.drumee.com';
    let origin = `https://${host}`;
    srcdir = srcdir || `/sandox`;
    const data = await Network.request(`${origin}/-/svc/media.manifest?nid=${srcdir}`)
    return data[0];
  }

  /**
   * 
   * @param {*} hub 
   * @param {*} folder 
   * @returns 
   */
  async importSymlinks(uid) {
    let sql = `SELECT * FROM sandbox.asset WHERE name=?`;
    let src = await this.yp.await_query(sql, 'assets');
    const { home_id } = await this.db.await_proc('mfs_home');
    const nodes = await this.folderContent(src);
    //this.debug("AAA:198", { src, uid });
    let re = new RegExp("^" + src.srcdir);
    for (let node of nodes) {
      if (!/^(hub|folder)$/i.test(node.filetype)) {
        /** The actual new root is below dirname */
        let ownpath = node.ownpath.replace(re, '');
        let path = ownpath.split(/\/+/);
        path.pop();
        path = path.filter(function (f) { return f });

        let dir = '/' + path.join('/');
        let parent;
        let id = await this.db.await_func(`node_id_from_path`, dir);
        if (id) {
          parent = await this.db.await_proc('mfs_node_attr', id);
        } else {
          if (!path.length) {
            parent = await this.db.await_proc('mfs_node_attr', home_id);
          } else {
            parent = await this.db.await_proc(`mfs_make_dir`, home_id, path, 1);
          }
        }
        await this.createSymLink(node, { ...parent, uid });
      }
    }
  }

  /**
   * 
   * @param {*} hub 
   * @param {*} folder 
   * @returns 
   */
  async importFolder(src) {
    const { dirname, origin, nodes } = await this.manifest(src)
    const { home_id } = await this.db.await_proc('mfs_home');
    let re = new RegExp("^" + dirname);
    for (let node of nodes) {
      if (!/^(hub|folder)$/i.test(node.filetype)) {
        /** The actual new root is below dirname */
        let ownpath = node.ownpath.replace(re, '');
        let path = ownpath.split(/\/+/);
        path.pop();
        path = path.filter(function (f) { return f });

        let dir = '/' + path.join('/');
        let parent;
        let id = await this.db.await_func(`node_id_from_path`, dir);
        if (id) {
          parent = await this.db.await_proc('mfs_node_attr', id);
        } else {
          if (!path.length) {
            parent = await this.db.await_proc('mfs_node_attr', home_id);
          } else {
            parent = await this.db.await_proc(`mfs_make_dir`, home_id, path, 1);
          }
        }
        //this.debug("AAA:267", node, { id, dir, home_id, path, parent });

        node.origin = origin;
        let url = `${origin}${node.ownpath}`
        await this.importFile(url, parent);
      }
    }
  }
}
module.exports = Mfs;