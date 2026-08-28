
const { statSync, existsSync, mkdirSync } = require("fs");
const { isEmpty, isString, isObject, isFunction } = require("lodash");
const {
  sysEnv, Logger, Constants, Events
} = require("@drumee/server-essentials");
const {
  ACCEL_REDIRECT,
  AREA_PRIVATE,
  AREA_PUBLIC,
  CARD,
  DOCREADER,
  EXT,
  FILE_PATH,
  FILENAME,
  FILETYPE,
  FOLDER,
  MEDIA_TTL,
  MIMETYPE,
  ORIGINAL,
  PREVIEW,
  SCRIPT,
  SLIDE,
  STREAM,
  STYLESHEET,
  THEME,
  THUMBNAIL,
  VIDEO,
  VIGNETTE,
} = Constants;

const { data_dir, static_dir, main_domain } = sysEnv();
const { dirname, resolve, join, basename} = require("path");
const { get_node_content } = require("./utils/mfs");
const default_logo = "images/logo/desk.jpg";
const favicon = join(static_dir, default_logo);
const Generator = require("./utils/generator");

const static_file = {
  default_avatar: {
    name: "default-profile.svg",
    path: `${static_dir}/images/profiles/default.svg`,
    accel: "/accel/images/profiles/default.svg",
    mimetype: "image/svg+xml",
    code: 200,
  },

  direct: {
    code: 200,
  },

  not_found: {
    name: "404.jpg",
    favicon,
    path: `${static_dir}/images/error/404-eggs.jpg`,
    accel: "/accel/images/error/404-eggs.jpg",
    mimetype: "image/jpg",
    code: 404,
  },

  favicon: {
    name: "favicon.ico",
    path: favicon,
    accel: `/accel/${default_logo}`,
    favicon,
    mimetype: "image/jpg",
    code: 200,
  },

  robots: {
    name: "robots.txt",
    path: join(static_dir, "dataset", "robots.txt"),
    accel: "/accel/dataset/robots.txt",
    favicon,
    mimetype: "text/plain",
    code: 200,
  },

  icons: function (name = "editbox_menu", type = "normalized") {
    let file = `${name}.svg`;
    return {
      name: file,
      path: resolve(static_dir, "icons", file),
      accel: join("/accel", "icons", file),
      favicon,
      mimetype: "image/svg",
      code: 200,
    };
  },
};

const DATA_ROOT = new RegExp(`^${data_dir}`);

class __file_io extends Logger {
  constructor(...args) {
    super(...args);
    this.initialize = this.initialize.bind(this);
    this.not_found = this.not_found.bind(this);
    this.static = this.static.bind(this);
    this.send = this.send.bind(this);
    this.output = this.output.bind(this);
    this.input = this.input.bind(this);
  }

  initialize(entity) {
    this._output = entity.output;
    this._input = entity.input;
    this.once("end", entity.stop.bind(entity));
  }

  /**
   * 
   * @param {*} filename 
   */
  not_found(filename) {
    let file = static_file.not_found;
    let real_error = 1;
    switch(filename){
      case "/favicon.ico":
        file = static_file.favicon;
        filename = file.name;
        real_error = 0;
      break;
      case "/robot.txt":
      case "/robots.txt":
        file = static_file.robots;
        filename = file.name;
        real_error = 0;
        break;
      default:
         this.debug(`FILE NOT FOUND ::: ${filename}`);
    }
    let opt;
    let code = 200;
    if (real_error) {
      code = 404;
      opt = {};
    } else {
      filename = filename || file.name;
      filename = encodeURI(filename);
      const stat = statSync(file.path, { throwIfNoEntry: false });
      if(stat){
        opt = {
          "X-Accel-Redirect": file.accel,
          "Content-Disposition": `attachment; filename=\"${filename}\"`,
          "Content-Length": stat.size,
          "Content-Type": "image/jpg charset=utf-8",
          "Cache-Control": `public, max-age=${MEDIA_TTL}`,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Origin": `*.${main_domain}`,
        };
      }else{
        code = 404;
        opt = {};  
      }
    }

    this._output.head(opt, code);
    this.trigger(Events.end);
  }

  /**
   *
   */
  icon(n) {
    let file = static_file.icons(n);
    const stat = statSync(file.path);
    let filename = encodeURI(basename(file.name));
    let opt = {
      "X-Accel-Redirect": file.accel,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": stat.size,
      "Content-Type": `${file.mimetype}`,
      "Cache-Control": `public, max-age=${MEDIA_TTL}`,
      "Access-Control-Allow-Credentials": "true",
    };
    this._output.head(opt, file.code);
  }

  /**
   * Send static file
   * @param {*} opt 
   * @param {*} is_cache 
   * @returns 
   */
  static(opt, is_cache = 1) {
    let file;
    let name = null;
    if (isString(opt)) {
      file = static_file[opt];
      if (file == null) {
        this.not_found(opt);
        return;
      }
    } else if (isObject(opt)) {
      file = opt;
      name = opt.name;
    } else {
      this.not_found(opt);
      return;
    }

    const stat = statSync(file.path);
    let filename = basename(file.path);
    const disposition = this.get("disposition") || "attachment";
    const accel = file.path.replace(DATA_ROOT, "");
    if (name) filename = name;
    filename = encodeURI(filename);
    if (is_cache) {
      opt = {
        "X-Accel-Redirect": accel,
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Content-Length": stat.size,
        "Content-Type": `${file.mimetype}`,
        "Cache-Control": `public, max-age=${MEDIA_TTL}`,
        "Access-Control-Allow-Credentials": "true",
      };
    } else {
      opt = {
        "X-Accel-Redirect": accel,
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Content-Length": stat.size,
        "Last-Modified": new Date(stat.mtime),
        etag: "off",
        expires: "off",
        if_modified_since: "off",
        "Content-Type": `${file.mimetype}`,
        "Cache-Control": `no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`,
        "Access-Control-Allow-Credentials": "true",
      };
    }
    const code = file.code || 200;
    this._output.head(opt, code);
  }

  /**
   * 
   * @param {*} file 
   * @returns 
   */
  content(file) {
    if (!existsSync(file)) {
      filename = png;
      this.not_found(file);
      return;
    }
    const disposition = this.get("disposition") || "attachment";
    const filename = encodeURI(basename(file));
    const stat = statSync(file);
    var opt = {
      "X-Accel-Redirect": file.replace(DATA_ROOT, ""),
      "Content-Disposition": `${disposition}; filename=\"${filename}\"`,
      "Content-Length": stat.size,
      "Cache-Control": `public, max-age=${MEDIA_TTL}`,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": `*.${main_domain}`,
    };
    const code = file.code || 200;
    this._output.head(opt, code);
    this.trigger(Events.end);
  }

  /**
   * 
   * @param {*} node 
   * @param {*} age 
   * @param {*} format 
   * @param {*} extension 
   * @param {*} mimetype 
   * @returns 
   */
  send(node, age = MEDIA_TTL, format, extension, mimetype) {
    let filename, privacy, stat;
    if (node == null) {
       this.debug("EMPTY NODE", node);
      this.not_found("no-name");
      return;
    }
    mimetype = mimetype || node[MIMETYPE] || 'application/octet-stream';
    if (node.area === AREA_PRIVATE) {
      privacy = AREA_PRIVATE;
    } else {
      privacy = AREA_PUBLIC;
    }
    const opt = {
      "Content-Type": `${mimetype}; charset=utf-8`,
      "Cache-Control": `${privacy}, max-age=${age}`,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Credentials": "true",
    };
    const a = node[FILENAME].split(".");
    a.pop();
    if (!isEmpty(a)) {
      filename = a.join() + `.${extension}`;
    } else {
      filename = node[FILENAME] + `.${extension}`;
    }
    try {
      let filepath = get_node_content(node, format, extension);
      /** TMP FIX -- migration drumee.note */
      // if(extension == 'html' && !existsSync(filepath)){
      //   filepath = get_node_content(node, format, 'note');
      // }
      stat = statSync(filepath);
    } catch (e) {
      this.silly("FILE STAT FAILED", e);
      stat = { size: 0 };
      this.not_found(filename);
      return;
    }

    const fname = encodeURI(filename);
    const disposition = this.get("disposition") || "attachment";
    opt[ACCEL_REDIRECT] = node[ACCEL_REDIRECT];
    opt["Content-Disposition"] = `${disposition}; filename=\"${fname}\"`;
    opt["Content-Length"] = stat.size;
    opt["Access-Control-Allow-Origin"] = `*.${main_domain}`;
    opt["Accept-Ranges"] = "bytes";
    opt["Connection"] = "keep-alive";
    if (node._mode === "raw") {
      delete opt["Content-Disposition"];
    }
    this._output.head(opt, 200);
    this.trigger(Events.end);
  }

  /**
   * 
   * @param {*} node 
   * @param {*} format 
   * @param {*} page 
   * @returns 
   */
  output(node, format = ORIGINAL, page = 0) {
    let output;
    const orig_path = get_node_content(node);
    const extension = node[EXT];
    const filetype = node[FILETYPE];
    const filename = node[FILENAME];
    let mimetype = node[MIMETYPE];
    let ext = extension;
    switch (format) {
      case FOLDER:
        output = orig_path;
        break;

      case ORIGINAL:
        output = orig_path;
        break;

      case STYLESHEET:
        ext = "css";
        output = get_node_content(node, format, "css");
        break;

      case SCRIPT:
        ext = "js";
        output = get_node_content(node, ORIGINAL, ext);
        break;

      case VIDEO:
      case STREAM:
        if (filetype === VIDEO) {
          ext = "mp4";
          mimetype = "video/mp4";
        } else {
          ext = "mp3";
          mimetype = "audio/mp3";
        }
        //this._input.setTimeout(60 * 60);
        output = get_node_content(node, format, ext);
        break;
      case "hls":
        ext = "m3u8";
        output = get_node_content(node, "master", ext);
        break;
      case "segment":
        ext = "ts";
        output = get_node_content(node, "segment", ext);
        break;

      case PREVIEW:
      case SLIDE:
      case CARD:
      case THEME:
      case VIGNETTE:
      case THUMBNAIL:
        ext = "png";
        output = get_node_content(node, format, ext);
        break;

      case _a.pdf:
        ext = "png";
        output = get_node_content(node, format, ext);
        break;

      case DOCREADER:
        this._input.setTimeout(60 * 60);
        output = get_node_content(node, format, ext);
        break;

      default:
        output = orig_path;
        this.debug(`UNEXPECTED FORMAT ${format}, using original`);
    }

    const func_name = `create_${filetype}_${format}`;

    if (!existsSync(orig_path) || isEmpty(output)) {
      this.debug(`ERROR RAISED BY orig_path=${orig_path} or output=${output}`);
      this.not_found(filename);
      return node;  
      /** TMP FIX: drumee.note migration */
      // if(ext == 'html' && !existsSync(orig_path)){
      //   output = orig_path.replace(/\..+$/, '.note')
      // }else{
      //    this.debug(`ERROR RAISED BY orig_path=${orig_path} or output=${output}`);
      //   this.not_found(filename);
      //   return node;  
      // }
    }

    const g = Generator[func_name];
    if (isFunction(g)) {
      if (mimetype == null && ext === "webp") {
        mimetype = "image/webp";
      }
      try {
        mimetype = g(output, orig_path, node) || mimetype;
      } catch (e) {
        this.warn(`Output error: FAILED TO GENERATED PREVIEW`, e);
        this.debug(`AAA:420 func=${func_name} input=${orig_path} output=${output}`);
        this.not_found();
        return node;
      }
    }
    node[FILE_PATH] = output;
    node[ACCEL_REDIRECT] = output.replace(DATA_ROOT, "");
    node[FILENAME] = filename;
    node[MIMETYPE] = mimetype;
    this.send(node, MEDIA_TTL, format, ext, mimetype);
  }

  /**
   * 
   * @param {*} args 
   * @param {*} socket 
   * @param {*} zipid 
   * @param {*} channel 
   * @returns 
   */
  async create_zip(args, socket, zipid, channel) {
    const files = args[0];
    const size = args[1].size;
    const zname = args[2].filename;
    const dest_dir = join(
      process.env.DRUMEE_MFS_DIR,
      `__download__`,
      this.uid,
      zipid
    );
    this.debug(`DEST DIR =${dest_dir} SIZE=${size}`);
    let dump = [];
    let src;
    let dest;
    let dname;
    const recursive = true;
    mkdirSync(dest_dir, {recursive});
    for (let a of files) {
      src = join(a.home_dir, "__storage__", a.id, `orig.${a.extension}`);
      a.file_path = a.file_path.replace(/\.null$/, "");
      dest = join(dest_dir, a.file_path);

      if ([_a.hub, _a.folder].includes(a.category)) {
        dname = join(dest_dir, a.file_path);
      } else {
        dname = dirname(join(dest_dir, a.file_path));
        dest = join(dname, basename(a.file_path));
      }

      if (!existsSync(dname)) {
        this.debug(`MKDIR =${dname}`);
        mkdirSync(dest_dir, {recursive});
      }
      dump.push({ src, dest, type: a.category });
    }

    let cmd = `nice ${Script.archive} ${dest_dir} ${zname}`;
    for (let k of dump) {
      if (existsSync(k.src)) {
        if (!this.sh_cp(k.src, k.dest)) return;
      }
    }
    if (channel == _a.email) {
      cmd = `nice ${Script.archive} ${dest_dir} ${zname}`;
      var spawn = require("child_process").spawn;
      spawn(`nice ${Script.archive}`, [dest_dir, zname], {
        detached: true,
      });
      return;
    }

    return this.sh_exec(cmd);
  }

  /**
   * 
   * @param {*} src 
   * @param {*} dest 
   */
  input(src, dest) { }
}

module.exports = __file_io;
