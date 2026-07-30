// ================================  *
//   Copyright Xialia.com  2013-2017 *
//   FILE  : src/service/private/scheme
//   TYPE  : module
//   DESC  : META FILESYSTEM CORE
// ================================  *

const { Attr, Cache, Constants } = require("@drumee/server-essentials");
const { isText } = require('istextorbinary');

const {
  AREA_PERSONAL,
  PERM_DELETE,
  NODE_TYPE,
  ROOT,
  UNABLE_TO_DELETE_ROOT,
  FILETYPE,
  FOLDER,
  BOUND,
  ORIGINAL,
  OTHER,
  SLIDE,
  INBOUND,
} = Constants;

const {
  existsSync,
  rmSync,
  symlinkSync,
  mkdirSync,
  readSync,
  openSync,
  closeSync
} = require("fs");

const { cp, exec } = require("shelljs");
const { join } = require("path");
const { isEmpty, isString } = require("lodash");
const FileIo = require("./file-io");

/** ===============================  */
const Entity = require("./entity");
class __mfs extends Entity {
  /**
   *
   * @param  {...any} args
   */
  constructor(...args) {
    super(...args);
    this.check_sanity = this.check_sanity.bind(this);
    this.mkdir = this.mkdir.bind(this);
    this.clean_filename = this.clean_filename.bind(this);
    this.add_ending_slash = this.add_ending_slash.bind(this);
    this.get_home_id = this.get_home_id.bind(this);
    this.mkdir_deeper = this.mkdir_deeper.bind(this);
    this.mfs_browse = this.mfs_browse.bind(this);
    this.send_media = this.send_media.bind(this);
    this.isMfs = true;
  }

  /**
   *
   * @param {*} callback
   * @param {*} trigger
   */
  check_sanity(callback, trigger) {
    this.debug(
      `CHECK SANITY ....cb=${callback}...........`,
      this.home_dir,
      this.home_id,
      this.hub.get(Attr.id)
    );
  }

  /**
   *
   * @param {*} id
   * @returns
   */
  isBranche(node) {
    if (!node || !node.filetype) return false;
    return /^(hub|folder|root)$/.test(node.filetype);
  }

  /**
   *
   * @param {*} id
   * @returns
   */
  get_mfs_path(id) {
    return join(this.mfs_root, id);
  }

  /**
   * 
   */
  getPartialBuffer(filePath, chunkSize = 1024) {
    const buffer = Buffer.alloc(chunkSize);
    const fd = openSync(filePath, 'r');
    try {
      const bytesRead = readSync(fd, buffer, 0, chunkSize, 0);
      const partialBuffer = buffer.slice(0, bytesRead);
      return partialBuffer;
    } catch (err) {
      this.warn(`getPartialBuffer:Error reading file: ${err.message}`);
    } finally {
      closeSync(fd);
    }
    return null;

  }

  /**
   * 
   * @param {*} filePath 
   * @returns 
   */
  async detect_filetype(filePath) {
    const { fileTypeFromBuffer } = await import('file-type');
    const buffer = this.getPartialBuffer(filePath);
    const type = await fileTypeFromBuffer(buffer);
    this.debug("AAA:124fileTypeFromBuffer", { filePath, type }, isText(null, buffer))
    if (type && type.mime) return type.mime;
    if (isText(null, buffer)) return "text/*";
    return 'application/octet-stream';
  };

  /**
   *
   * @param {*} filename
   * @returns
   */
  async get_format(filepath, filename) {
    this.warn("THIS FUNCTION HAS BEEN DEPRECATED. Use server-essentials impor instead")
    let mimetype = await this.detect_filetype(filepath);
    filename = filename.replace(/\/+$/, "");
    let name = filename;
    let extension;
    if (/^\..+/.test(filename)) {
      extension = ''
    } else {
      let e = filename.split('.');
      extension = e.pop() || "";
      extension = extension.toLowerCase();
      let re = new RegExp('.' + extension + '$')
      name = filename.replace(re, "")
    }
    let def = Cache.getFilecap(extension);
    def.mimetype = mimetype;

    if (this.input) {
      let filetype = this.input.get(Attr.filetype);
      if (filetype) {
        def.category = filetype;
      }
    }

    if (/script/.test(mimetype)) {
      def.category = Attr.script;
      def.capability = "---";
    } else if (/text/.test(mimetype)) {
      def.category = Attr.text;
      def.capability = "---";
    } else if (/video/.test(mimetype)){
      def.category = Attr.video;
    }

    if (!def.category || def.category == OTHER) {
      def.category = mimetype.split('/')[0];
    }

    let c = {
      mimetype,
      extension,
      capability: "---",
      category: OTHER,
      filename: name,
      ...def,
    };
    return c;
  }

  /**
   *
   * @param {*} node
   */
  async normalizeNode(node) {
    if (!node) return {}
    if (node.metadata && node.metadata.md5Hash) {
      node.md5Hash = node.metadata.md5Hash;
    } else {
      try {
        let { md5Hash } = JSON.parse(node.metadata);
        node.md5Hash = md5Hash;
      } catch (e) { }
    }
    node.filepath = node.filepath || node.file_path;
    node.filename = node.filename || node.user_filename;
    node.actual_home_id = node.actual_home_id || this.home_id;
    return node;
  }

  /**
   *
   * @param {*} dirname
   * @returns
   */
  mkdir(dirname) {
    try {
      mkdirSync(dirname, { recursive: true });
      return true;
    } catch (e) {
      this.exception.server(e);
      return false;
    }
  }

  /**
   *
   * @param {*} dirname
   * @param {*} opt
   * @returns
   */
  sh_mkdir(dirname) {
    return this.mkdir(dirname);
  }

  /**
   *
   * @param  {...any} o
   * @returns
   */
  sh_cp(...o) {
    let status = cp(...o);
    if (status.code !== 0) {
      this.exception.server(`FAILED_TO_COPY_FILES: ${status.stderr}`);
      return false;
    }
    return true;
  }

  /**
   *
   * @param {*} target
   * @param {*} pointer
   * @returns
   */
  sh_ln(target, pointer) {
    if (existsSync(join(pointer, "dont-remove-this-dir"))) {
      this.exception.server(`FAILED_TO_COPY_FILES: ${status.stderr}`);
      return false;
    }
    try {
      symlinkSync(target, pointer);
      return true;
    } catch (e) {
      this.warn("Link error", e)
      this.exception.server(`FAILED_TO_COPY_FILES`);
      return false;
    }
  }

  /**
   *
   * @param  {...any} o
   * @returns
   */
  sh_exec(...o) {
    let status = exec(...o);
    if (status.code !== 0) {
      this.exception.server(`FAILED_TO_RUN CMD: ${status.stderr}`);
      return false;
    }
    return true;
  }

  /**
   *
   * @param {*} filename
   * @returns
   */
  clean_filename(filename) {
    filename = filename.replace(/[\/\<\>\~\\\\]+/g, "-");
    return filename;
  }

  /**
   *
   * @param {*} path
   * @returns
   */
  add_ending_slash(path) {
    if (path === null || isEmpty(path)) {
      return "/";
    }
    const last_char = path.substr(path.length - 1);
    if (last_char !== "/") {
      path = path + "/";
    }
    return path;
  }

  /**
   *
   * @returns
   */
  get_home_id() {
    return this.get(Attr.home_id);
  }

  /**
   *
   * @param {*} home_dir
   * @returns
   */
  remove_home_dir(home_dir) {
    return rmSync(home_dir, { recursive: true, force: true });
  }

  /**
   *
   * @param {*} topdir
   * @param {*} subdir
   * @returns
   */
  mkdir_deeper(topdir, subdir) {
    //fu = new File_Util
    let arraypath;
    if (isEmpty(topdir)) {
      topdir = Cache.message("_attachments");
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = ("0" + parseInt(now.getMonth() + 1)).slice(-2);
    const today = ("0" + now.getDate()).slice(-2);
    if (this.area === AREA_PERSONAL) {
      if (isEmpty(subdir)) {
        subdir = Cache.message("_profiles");
      }
      arraypath = [topdir, subdir];
    } else {
      arraypath = [topdir, year, month, today];
    }

    const rel_path = "/" + arraypath.join("/");

    return rel_path;
  }

  /**
   *
   * @param {*} id
   * @param {*} type
   * @param {*} order
   * @param {*} page
   */
  mfs_browse(id, type, order, page) {
    if (isEmpty(id)) {
      id = this.get(Attr.home_id);
    }
    if (order === "asc") {
      this.db.call_proc("mfs_browse_asc", id, type, page, this.output.data);
    } else {
      this.db.call_proc("mfs_browse", id, type, page, this.output.data);
    }
  }

  /**
   *
   * @param {*} nid
   * @returns
   */
  delete(nid) {
    let file = this.get_access(nid, PERM_DELETE);
    file = this.mfs_node_attr(nid);
    if (file[NODE_TYPE] === ROOT) {
      this.exception.user(UNABLE_TO_DELETE_ROOT);
    }
    //throw {error: "500", message: UNABLE_TO_DELETE_ROOT}

    file = this.mfs_node_attr(nid);
    const cb_deleted = () => {
      let op = { recursive: true, force: true };
      if (file[BOUND] !== INBOUND) {
        if (file[FILETYPE] === FOLDER) {
          return rmSync(file.sys_file_path, opt);
        } else {
          return rmSync(join(file.sys_parent_path, file.id), opt);
        }
      }
    };
    this.db.call_proc("mfs_delete", nid, this.uid, file[BOUND], cb_deleted);
    file.status = "erased";
    return file;
  }

  /**
   *
   * @param {*} arg
   * @param {*} format
   * @param {*} page
   * @param {*} mode
   * @returns
   */
  async send_media(arg, format, page, mode) {
    let node = arg;
    if (isString(arg)) {
      node = await this.db.await_proc("mfs_node_attr", arg);
    } else if (arg.node) {
      node = arg.node;
    }
    const file = new FileIo(this);
    if (!node) {
      this.warn(`NODE_NOT_FOUND`, arg);
      file.not_found();
      return;
    }
    node._mode = mode;
    if ([ORIGINAL, Attr.pdf, SLIDE].includes(format)) {
      file.output(node, format, page);
      return;
    }
    file.output(node, format, page);
  }

  /**
 * To set user's default content defined by the installation settings
 * @param {*} user 
 */
  async defaultContent(user) {
    const { db_name, id } = user
    let tunnel_id = Cache.getSysConf("tunnel_hub");
    let hub_db;
    if (tunnel_id) {
      hub_db = await this.yp.await_proc('get_entity', tunnel_id).db_name;
    }
    let user_db = db_name;
    if (!user_db) {
      ({ user_db } = await this.yp.await_proc('get_entity', id))
    }
    let home = await this.yp.await_proc(`${user_db}.mfs_home`);
    for (let dir of ["_photos", "_documents", "_videos", "_musics"]) {
      let filename = Cache.message(dir);
      let args = {
        owner_id: id,
        filename,
        pid: home.home_id,
        category: _a.folder,
        ext: "",
        mimetype: _a.folder,
        filesize: 0,
      };
      let node = await this.yp.await_proc(`${user_db}.mfs_create_node`, args, {}, { show_results: 1 });
      let nid;
      switch (dir) {
        case "_photos":
          nid = Cache.getSysConf("tunnel_photos");
          break;
        case "_documents":
          nid = Cache.getSysConf("tunnel_documents");
          break;
        case "_videos":
          nid = Cache.getSysConf("tunnel_videos");
          break;
        case "_musics":
          nid = Cache.getSysConf("tunnel_musics");
          break;
      }
      if (hub_db) {
        await this.yp.await_proc(`${hub_db}.mfs_create_link_by`,
          nid,
          id,
          node.id,
          id
        );
      }
    }
  }

  /**
 * To set the Default content defined by the installation settings
 */
  async setDefaultContent(user_id, type = "pro") {
    let node;
    let defaultContentKey = "pro_default_content";
    if (type == "hub") {
      defaultContentKey = "hub_default_content";
    }

    let tunnel_id = Cache.getSysConf("tunnel_hub");
    let hub_db;
    if (tunnel_id) {
      hub_db = await this.yp.await_proc('get_entity', tunnel_id).db_name;
    }

    let defaultContent = Cache.getSysConf(defaultContentKey);
    defaultContent = JSON.parse(defaultContent);
    let user_db = await this.yp.await_proc('get_entity', user_id).db_name;
    let home = await this.yp.await_proc(`${user_db}.mfs_home`);

    await defaultContent.forEach(async (contentRow) => {
      switch (contentRow.type) {
        case "folder":
          let args = {
            owner_id: user_id,
            filename: contentRow.name,
            pid: home.home_id,
            category: _a.folder,
            ext: "",
            mimetype: _a.folder,
            filesize: 0,
          };
          node = await this.yp.await_proc(`${user_db}.mfs_create_node`, args, {}, { show_results: 1 });
          if (hub_db) {
            await this.yp.await_proc(`${hub_db}.mfs_create_link_by`,
              contentRow.nid,
              user_id,
              node.id,
              user_id
            );
          }
          break;
        case "file":
          if (hub_db) {
            await this.yp.await_proc(`${hub_db}.mfs_create_link_by`,
              contentRow.nid,
              user_id,
              home.home_id,
              user_id
            );
          }
      }
    });
  }

  /**
 * 
 * @param {*} uid 
 * @param {*} option 
 */
  async setDefaultWallpaper(uid, option) {
    let entity = await this.yp.await_proc("entity_touch", uid);
    let old_settings;
    if (isEmpty(entity) || isEmpty(entity.settings)) {
      old_settings = {};
    } else {
      old_settings = this.parseJSON(entity.settings);
    }
    let settings = {};
    if (option == "b2c") {
      settings.wallpaper = Cache.getSysConf("wallpaper_b2c");
    } else {
      settings.wallpaper = Cache.getSysConf("wallpaper_b2b");
    }
    this.yp.call_proc("drumate_update_settings", uid, { ...old_settings, ...settings });
  }


}

module.exports = __mfs;
