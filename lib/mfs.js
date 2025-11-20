const { filesize, dataTransfer } = require("./utils")
const { makeHeaders } = require("./socket/utils");
const Attr = require('./lex/attribute');
const PROPERTIES = [
  Attr.area,
  Attr.actual_home_id,
  Attr.ctime,
  Attr.ext,
  Attr.filename,
  Attr.filepath,
  Attr.filetype,
  Attr.filesize,
  Attr.geometry,
  Attr.home_id,
  Attr.hub_id,
  Attr.isalink,
  Attr.isalink,
  Attr.md5Hash,
  Attr.metadata,
  Attr.mtime,
  Attr.nid,
  Attr.origin,
  Attr.ownpath,
  Attr.pid,
  Attr.privilege,
  Attr.status,
]

/**
 *
 */
function svcUrl(o) {
  let { svc, keysel } = bootstrap();
  if (!_.isObject(o)) {
    return o;
  }
  let s = `${svc}media.zip?keysel=${keysel}&`;
  for (let k in o) {
    const v = o[k];
    s = `${s}&${k}=${v}`;
  }
  return s;
}


const OPEN_NODE = "open-node";
const pseudo_media = require("media/pseudo");
const DATEFORMAT = "DD MMM YY HH:MM:ss";
const LetcBox = require("./widgets/box")
class CoreMfs extends LetcBox {

  constructor(...args) {
    super(...args);
  }

  /**
   *
   */
  unselect() {
    // Abstract -- do not remove
  }

  /**
   *
   * @param {*} permission
   */
  isGranted(permission) {
    return this.mget(Attr.privilege) & permission;
  }

  /**
   * 
   */
  initData() {
    const ctime = this.mget(Attr.createTime) || 0;
    const m = Dayjs.unix(ctime); //Dayjs()(ctime, "X");
    this.model.set(Attr.age, m.fromNow());
    this.model.set(Attr.date, m.format(DATEFORMAT));
    this.model.set(Attr.size, filesize(this.mget(Attr.filesize)));
    this.model.atLeast({
      date: Dayjs.unix(Dayjs().unix()),
    });
    if (this.mget(Attr.file)) {
      return this.mset({
        filename: this.mget(Attr.name),
      });
    }
    this.isMfs = 1;
    if ([Attr.hub, Attr.folder].includes(this.mget(Attr.filetype))) {
      this.mset({ filesize: 0 });
    } else {
      this.mset({ filesize: parseInt(this.mget(Attr.filesize)) });
    }
    this.metadata();
  }

  /**
   * @param {*} response
   */
  onUploadEnd(response, restartEvent) {
    const { error_code, error, data } = response;
    switch (error_code) {
      case 400:
        if (/.+exceeded$/.test(error)) {
          Butler.upgrade().then(() => {
            this.goodbye();
          })
          return;
        }
        break;
      case 402:
        Butler.upgrade().then(() => {
          this.goodbye();
        })
        return;
      case 200:
        break;
      default:
        if (error) {
          Butler.say(error);
          this.suppress();
          return;
        }
    }
    data.format = this.mget(Attr.format) || Attr.card;
    const handler = this.mget(Attr.uiHandler) || this.getLogicalParent() || Wm;
    if (this.mget(Attr.file) != null || this.isReplacing) {
      // set by behavior
      data.kind = this._getKind();
      data.signal = _e.ui.event;
      data.service = OPEN_NODE;
      data.uiHandler = handler;
      data.isAttachment = this.isAttachment();
      data.recipient_id = Visitor.dmzRecipientToken;
      this.model.clear();
      this.model.set(data);
      this.initData();
      this.initURL();
      if (this.isAttachment()) {
        this.trigger(_e.restart);
        this.onDomRefresh();
        this.status = null;
      } else {
        this.restart(restartEvent);
      }
      this.enablePreview();
    } else {
      this.initData();
      this.initURL();
      this.restart(restartEvent);
      this.enablePreview();
    }

    const f = () => {
      return this.logicalParent.unselect(2);
    };
    _.delay(f, 1000);
  }

  /**
   *
   * @param {*} items
   * @param {*} p
   * @param {*} token
   * @returns
   */
  _sendTo(target, items, p, token) {
    let f, pm;
    const a = [];
    for (f of Array.from(items.files)) {
      pm = new pseudo_media({ phase: Attr.upload });
      pm.mset(Attr.file, f);
      if (token) {
        pm.mset(Attr.token, token);
      }
      a.push(pm);
    }
    for (f of Array.from(items.folders)) {
      pm = new pseudo_media();
      pm.mset(Attr.folder, f);
      if (token) {
        pm.mset(Attr.token, token);
      }
      a.push(pm);
    }

    if (!_.isEmpty(a)) {
      return target.insertMedia(a, p);
    }
  }

  /**
   *
   * @param {*} target
   * @param {*} e
   * @param {*} p
   * @param {*} token
   * @returns
   */
  sendTo(target, e, p, token) {
    const r = dataTransfer(e);
    this._sendTo(target, r, p, token);
  }

  /**
   * 
   * @returns 
   */
  download_tree() {
    let nid;
    if (this.mget(Attr.filetype) === Attr.hub) {
      nid = this.mget(Attr.actual_home_id);
    } else {
      nid = this.mget(Attr.nid);
    }
    if (!wsRouter.check_sanity()) {
      Butler.say(LOCALE.ERROR_NETWORK);
      return;
    }
    this.postService({
      service: SERVICE.media.download,
      nid,
      hub_id: this.mget(Attr.hub_id),
      // token     : this.mget(Attr.token),
      socket_id: Visitor.get(Attr.socket_id),
    });
    this._waitingForZip = this.mget(Attr.nid);
  }

  /**
   * 
   * @param {*} o 
   * @returns 
   */
  download_zip(o) {
    let type = this.mget(Attr.filetype);
    let filename =
      this.mget(Attr.filename) ||
      o.zipname ||
      Dayjs().format("[drumee]-YYYY-MM-DD");
    let hub_id = this.mget(Attr.hub_id);
    let nid = this.mget(Attr.nid);

    switch (type) {
      case null:
      case undefined:
        if (!Visitor.inDmz) {
          nid = Visitor.get(Attr.home_id);
          hub_id = Visitor.get(Attr.id);
        }
        break;
      case Attr.hub:
        nid = this.mget(Attr.actual_home_id);
        hub_id = this.mget(Attr.hub_id);
        break;
      default:
        hub_id = this.mget(Attr.hub_id);
        nid = this.mget(Attr.nid);
    }
    let url = svcUrl({
      hub_id,
      nid,
      id: o.zipid,
      name: o.zipname,
      backup: o.backup,
    });
    filename = `${filename}.zip`;
    return this.fetchFile({
      url,
      progress: o.progress || this._progress,
      download: filename,
    });
  }

  /**
   * 
   * @param {*} blob 
   * @param {*} filename 
   * @returns 
   */
  getBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    if (this._currentBlobURL == url) return;
    this._currentBlobURL = url;
    const a = document.createElement(_K.tag.a);
    a.download = filename || "download";
    a.hidden = "";
    a.setAttribute(Attr.id, this._id + "-dl");
    a.setAttribute(Attr.href, url);
    a.setAttribute(Attr.target, "_blank");
    a.setAttribute("data-service", _e.download);
    a.style.position = Attr.absolute;
    a.style.display = Attr.none;
    try {
      this.unselect();
    } catch { }
    var clickHandler = () => {
      const f = () => {
        URL.revokeObjectURL(url);
        this._currentBlobURL = null;
        a.removeEventListener(_e.click, clickHandler);
        this.trigger(_e.eod, blob);
        this.triggerMethod(_e.eod, blob);
        a.remove();
      };
      _.delay(f, 300);
    };
    a.addEventListener(_e.click, clickHandler, false);
    a.click();
  }

  /**
   *
   */
  metadata() {
    let md = this.mget(Attr.metadata) || {};
    if (_.isString(md)) {
      try {
        md = JSON.parse(md);
      } catch (e) {
        return {};
      }
    }
    let { md5Hash, dataType } = md;
    this.mset({ md5Hash, dataType });
    return md;
  }

  /**
   * 
   */
  copyPropertiesFrom(src) {
    for (let i of PROPERTIES) {
      if (src.mget(i)) {
        this.mset(i, src.mget(i));
      }
    }
  }

  /**
   * 
   * @param {*} url 
   */
  getFromUrl(url) {
    const a = document.createElement(_K.tag.a);
    a.download = "download";
    a.hidden = "";
    a.setAttribute(Attr.id, this._id + "-dl");
    a.setAttribute(Attr.href, url);
    a.setAttribute(Attr.target, "_blank");
    a.setAttribute("data-service", _e.download);
    a.style.position = Attr.absolute;
    a.style.display = Attr.none;
    try {
      this.unselect();
    } catch { }
    var clickHandler = () => {
      const f = () => {
        a.removeEventListener(_e.click, clickHandler);
      };
      _.delay(f, 300);
    };
    a.addEventListener(_e.click, clickHandler, false);
    a.click();
  }
  /**
   *
   * @returns
   */
  _fetchOptions() {
    this.aborter = new AbortController();
    let headers = makeHeaders({
      'Accept': '*/*',
      'x-param-device': Visitor.device(),
      'x-param-device-id': Visitor.deviceId()
    });
    let init = {
      mode: "cors",
      cache: "default",
      guard: "request",
      method: "GET",
      signal: this.aborter.signal,
      headers
    };
    return init;
  }

  /**
   *
   * @param {*} o.downlod : non null create a blob downloadable through a link
   */
  async fetchFile(o) {
    let options = this._fetchOptions();
    return fetch(o.url, options).then((response) => {
      if (!response.ok) {
        this.warn(`Failed to fetch ${o.url}, code=${response.status}`);
        return { error: response.status };
      }
      let total = Number(response.headers.get("content-length"));
      if (total == null) {
        total = Number(this.mget(Attr.filesize)) || 1000;
      }
      let reader = response.body.getReader();
      let loaded = 0;
      let type = response.headers.get("content-type").split(" ")[0];
      let chunks = [];
      let self = this;
      return reader
        .read()
        .then(function read_data(result) {
          if (result.done) {
            reader.releaseLock();
            let blob = new Blob(chunks, { type });
            if (o.progress && _.isFunction(o.progress.mget)) {
              if (o.progress.mget("autoDestroy") == Attr.no) return blob;
              o.progress.goodbye();
            }
            return blob;
          }
          // enqueue received data
          let buffer = new ArrayBuffer(result.value.length);
          let chunk = new Uint8Array(buffer);
          chunk.set(result.value, 0);
          chunks.push(chunk);
          loaded += result.value.length;
          if (o.progress && _.isFunction(o.progress.update)) {
            o.progress.update({ loaded, total });
          } else {
            try {
              self.triggerMethod("fetch:progress", { loaded, total }) ||
                self.trigger(_e.progress, { loaded, total });
            } catch (e) { }
          }
          return reader.read().then(read_data);
        })
        .then((blob) => {
          if (o.download) {
            self.getBlob(blob, o.download);
          } else {
            self.trigger(_e.eod, blob);
            self.triggerMethod(_e.eod, blob);
            return blob;
          }
        });
    }).catch((e) => {
      this.warn(`ERR:413 -- Failed to fetch ${o.url}`, e);
    });
  }

  /**
   * 
   */
  download(o) {
    let { url } = this.actualNode(Attr.orig);
    let type = this.mget(Attr.filetype);
    let filename = this.mget(Attr.filename);
    filename = filename.replace(/\<.+\>/, "");
    let pn = `${this._id}-progres`;
    if (!document.getElementById(pn)) {
      let mode = 'grid';
      if (this.getLogicalParent) {
        mode = this.getLogicalParent().getViewMode();
      }
      this.append({
        kind: "progress",
        sys_pn: pn,
        mode,
        filename: filename,
        attributes: {
          id: pn,
        },
      });
      this._progress = this.children.last();
    }
    this.trigger(_e.loaded);
    if ([Attr.hub, Attr.folder].includes(type)) {
      if (_.isEmpty(o)) {
        this.download_tree();
      }
      // Wait for backend to notify upon zip completion
      return;
    } else {
      const ext = this.mget(Attr.extension) || this.mget(Attr.ext);
      filename = `${filename}.${ext}`;
    }
    this.waitElement(pn, () => {
      this.fetchFile({
        url,
        progress: this._progress,
        download: filename,
      });
    });
  }

  /**
   *
   * @param {*} o.downlod : non null create a blob downloadable through a link
   */
  abortDownload(o) {
    this.aborter.abort({ aborted: 1 });
  }

  /**
   *
   */
  fullname(o) {
    return `${this.mget(Attr.filename)}.${this.mget(Attr.ext)}`;
  }

  /**
   * 
   */
  markAsSeen() {
    if (this.isHubOrFolder || Visitor.inDmz) {
      return;
    }
    // this._updateNotification(-1);
    this.postService({
      service: SERVICE.media.mark_as_seen,
      nid: this.mget(Attr.nid),
      hub_id: this.mget(Attr.hub_id),
      mode: "direct_call",
    });
  }
  /**
   * 
   */
  syncAttributes() {
    this.fetchService({
      service: SERVICE.media.get_node_attr,
      nid: this.mget(Attr.nid),
      hub_id: this.mget(Attr.hub_id),
    });
  }

  /**
   *
   * @returns
   */
  isRegularFile() {
    if (this.isHubOrFolder || this.mget(Attr.isalink)) return false;
    return true;
    // let needle;
    // return (this.mget(Attr.filetype)
    //   (needle = this.mget(Attr.filetype)),
    //   Array.from(REGULAR_TYPES).includes(needle)
    // );
  }

  /**
   *
   * @returns
   */
  directUrl() {
    if (!this.isRegularFile()) return null;
    return this.actualNode().href;
  }

  /**
   * 
   */
  url(format) {
    let f;
    switch (this.mget(Attr.type)) {
      case Attr.vector:
        f = Attr.orig;
        break;
      default:
        f = Attr.vignette;
    }
    f = format || f;
    return super.url(f);
  }

  /**
   * 
   */
  async viewerLink(format, e) {
    const m = this.model;
    if (!format) {
      if (m.get(Attr.type) === Attr.vector) {
        format = Attr.orig;
      } else {
        format = Attr.vignette;
      }
    }
    const mData = this.actualNode();

    let data = {
      nid:
        mData.nid ||
        m.get(Attr.nid) ||
        m.get(Attr.actual_home_id) ||
        m.get(Attr.home_id) ||
        "*",
      hub_id: mData.hub_id || m.get(Attr.hub_id),
      kind: m.get(Attr.kind),
    };

    if (m.get(Attr.filetype)) {
      let fType = m.get(Attr.filetype);
      if (fType == Attr.hub) {
        fType = `${fType}_${m.get(Attr.area)}`;
      }
      const opt = require("window/configs/application")(fType, "");
      data.filetype = m.get(Attr.filetype);
      data.kind = opt.kind;
    }

    // for share-link with right click on media from desk
    if (m.get(Attr.area) == Attr.private && m.get(Attr.filetype) == Attr.hub) {
      data.nid = m.get(Attr.actual_home_id);
      if (_.isFunction(this.getCurrentNid)) {
        data.nid = this.getCurrentNid();
      }
    }

    data = new URLSearchParams(data).toString();
    let { endpoint } = bootstrap();
    this.viewerURL = `${endpoint}${_K.module.desk}/wm/open/${data}`;
    let { nid, hub_id } = mData;
    let opt = {
      nid,
      hub_id,
    };
    let r;
    switch (m.get(Attr.area)) {
      case Attr.share:
      case Attr.dmz:
        if (m.get(Attr.filetype) == Attr.hub) {
          delete opt.nid;
        }
        r = await this.fetchService(SERVICE.hub.get_external_room_attr, opt);
        if (m.get(Attr.filetype) == Attr.hub) {
          this.viewerURL = r.link;
        } else {
          this.viewerURL = `${r.link}/${nid}/play`;
        }
        break;
      case Attr.public:
        if (m.get(Attr.filetype) == Attr.hub) {
          r = await this.fetchService(SERVICE.room.public_link, opt);
          this.viewerURL = r.link;
        }
    }
    return this.viewerURL;
  }

  /**
   * 
   */
  srcUrl() {
    if (!this.isRegularFile()) return null;
    let { protocol } = bootstrap();
    return `${protocol}://${this.mget(Attr.vhost)}${this.mget(Attr.ownpath)}`;
  }

  /**
   * 
   */
  pluginUrl() {
    const { endpointPath } = bootstrap();
    const path = `${this.getLogicalParent().mget(Attr.ownpath)}`;
    return `${protocol}://${this.mget(Attr.vhost)}${endpointPath}#/${path}`;
  }

  /**
   * 
   */
  getCurrentNid() {
    switch (this.mget(Attr.filetype)) {
      case Attr.folder:
        return this.mget(Attr.nodeId);
      case Attr.hub:
        return 0;
      default:
        return this.mget(Attr.parentId);
    }
  }

  /**
   *
   * @returns
   */
  isSymLink() {
    return this.mget(Attr.isalink) && this.mget(Attr.filetype) != Attr.hub;
  }

  /**
   * 
   */
  getHostName() {
    return this.mget(Attr.vhost);
  }

  /**
   * 
   */
  getHostId() {
    return this.mget(Attr.hub_id);
  }

  // ===========================================================
  // functions to check for media privileges
  // ===========================================================

  /**
   *
   */
  isMediaOwner() {
    return this.mget(Attr.privilege) & _K.permission.owner;
  }

  /**
   *
   */
  canOrganize() {
    if (this.mget(Attr.isalink) && !this.isHub) return false;
    return this.mget(Attr.privilege) & _K.permission.modify;
  }

  /**
   *
   */
  canUpload() {
    if (this.mget(Attr.isalink) && !this.isHub) return false;
    return this.mget(Attr.privilege) & _K.permission.write;
  }

  /**
   *
   */
  canDownload() {
    return this.mget(Attr.privilege) & _K.permission.download;
  }
}

module.exports = CoreMfs;