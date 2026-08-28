
const { isArray, isEmpty, isString, isObject, isNumber, findIndex } = require('lodash');
const { stringify } = JSON;
const { resolve, normalize } = require('path');
const {
  Attr, Constants, Events, Mariadb, Logger, toArray
} = require('@drumee/server-essentials');
const { UNDEFINED } = Constants;
const {
  DENIED,
  ERROR,
  READY,
  SENT,
  GRANTED,
} = Events;

let JID = 0; /** Job id */

//########################################
class __acl extends Logger {


  async initialize(opt) {
    JID++;
    const s = opt.session;

    if (this._failed || this._isStopped) return;
    try {
      if (s.output.isDone()) {
        this._halt();
        return;
      }
    } catch (e) {

    }

    this.session = s;
    this.yp = s.yp;
    this.input = s.input;
    this.output = s.output;
    this.exception = s.exception;
    this.websocket = s.websocket;
    this.visitor = s.user;
    this.hub = s.hub;
    this.user = s.user;
    this.mimicker = s.mimicker();
    this.mimic_id = s.mimic_id();
    this.uid = s.uid();
    this.username = s.ident();
    this.dbname = this.hub.get(Attr.db_name);
    this.permission = opt.permission;

    let svc = this.input.get(Attr.service);
    let nid = this.input.get(Attr.nid);
    let hub_id = this.hub.get(Attr.id);

    this.once(DENIED, () => {
      this.debug(`[${svc}][${JID}][DENIED] to uid=${this.uid} on hub_id=${hub_id}, nid:`, nid);
      this.debug("Permission:", this.dbname, this.permission, this.input.authorization());
      this.exception.forbiden(`${svc}: PERMISSION_DENIED`, "_insufficient_privilege");
      this._halt();
    });

    this.once(GRANTED, () => {
      this.debug(`[${svc}][${JID}][GRANTED] to uid=${this.uid} on hub_id=${hub_id}, nid:`, nid);
      if (svc == 'meida.manifest') {
        this.debug(`[${svc}][${JID}][GRANTED]`, this.input.authorization());

      }
    });

    this.once(ERROR, (e) => {
      try {
        if (this.exception) {
          let opt = {
            service,
            code: e.code,
            error: e.message || 'SERVICE_FAILED'
          }
          this.exception.server(opt);
        }
      } catch (e) {
        console.info("Failed to handle error", e);
        throw `Error handling thrown`;
      }
      this._halt();
    });

    this.input.once("precondition_failed", this._halt.bind(this));

    s.once(DENIED, this._halt.bind(this));

    s.once(READY, () => {
      try {
        this._start();
      } catch (e) {
        s.trigger(ERROR, e);
        this._halt();
        this.warn("Failed to start ACL", e);
      }
    })

    this.exception.once(SENT, this._halt.bind(this));
    this.output.once(SENT, this._halt.bind(this));
  }

  /**
   * 
   * @returns 
   */
  _halt() {
    if (this._isStopped) return;
    this.stop();
    this._isStopped = true;
  }

  /**
   * 
   */
  async _start() {
    try {
      this.db = new Mariadb({ name: this.dbname, idleTimeout: 60 });
    } catch (e) {
      this.warn(`CONNECTION TO =${this.dbname} HAS FAILED`, e);
      this.exception.server("SERVER_FAULT");
      this._halt();
      return;
    }

    if (this.isServingPage) {
      /** granted by default, delegated to client/page */
      this.trigger(GRANTED);
      return;
    }

    this.heap = this.input.data();
    let pp = this.check_preprocess();
    let data = await this.check_env(pp);
    if (isEmpty(data)) {
      this._failed = 1;
      this.trigger(DENIED);
      return;
    }
    if (data.fast_check) {
      this.trigger(GRANTED);
      return;
    }
    if (this.permission && this.permission.scope) {
      switch (this.permission.scope) {
        case Attr.domain:
        case 'organisation':
        case 'organization':
          let dom = await this.check_domain();
          if (dom) {
            this.trigger(GRANTED);
          } else {
            this._failed = 1;
            this.trigger(DENIED);
          }
          return;
        case "plateform":
          let p = await this.check_remit(this.permission);
          if (p) {
            this.trigger(GRANTED);
          } else {
            this.trigger(DENIED);
            this._failed = 1;
          }
          return;
      }
    }

    let src = await this.check_source(data);
    let dest = await this.check_dest(data);

    /** DEPRECATED -- mimic handling removed from the per-request path.
     *  session_check_cookie returns a hardcoded NULL mimic_id, so this was
     *  a no-op that still cost a proc call on every granted request. */
    // await this.mimic_check();
    if (src && dest) {
      this.trigger(GRANTED);
    } else {
      this.trigger(DENIED);
      this._failed = 1;
    }
  }

  /** DEPRECATED -- mimic (impersonation) handling.
   *  Kept for reference only. Dead since session_check_cookie began returning
   *  `NULL mimic_id`, and it called this.notify_user(), which is defined on
   *  Entity rather than Acl -- so it would have thrown had mimic_id ever been set.
   */
  // async mimic_check() {
  //   if (!this.mimic_id) return;
  //   let mimic = await this.yp.await_proc('mimic_get', this.mimic_id)
  //   if (mimic.status == 'active') {
  //     if ((mimic.remaining_time <= 0)) {
  //       await this.yp.await_proc('mimic_set_by_status', mimic.mimic_id, 'endbytime')
  //       await this.yp.await_proc('uncast_user', mimic.mimicker, mimic.uid)
  //       let res = await this.yp.await_proc('mimic_get', mimic.mimic_id)
  //       res.service = 'adminpanel.mimic_end_byuser'
  //       await this.notify_user(mimic.uid, res);
  //       await this.notify_user(mimic.mimicker, res);
  //       this.trigger(DENIED);
  //     }
  //   }
  // }

  /**
   * 
   * @returns 
   */
  check_preprocess() {
    this.__source = {};
    this.__dest = {};
    let pp = this.permission.preproc;

    if (pp == null) {
      return (this.permission || this.permission);
    }

    if (pp.checker) {
      this.before_granting = pp.checker;
    } else if (isString(pp)) {
      this.before_granting = pp;
    }

    if (pp.action) {
      this.trans_action = pp.action;
      this.heap.action = pp.action;
    }
    this._required_remit = pp.remit;
  }

  /**
   * Service without mfs access should just run lighter check
   * @param {*} name 
   */
  async fast_check(name) {
    let nid = this.input.use(Attr.nid);
    let r;
    switch (name) {
      case 'user_permission':
        r = await this.db.await_func(name, this.uid, nid);
        if (r > 0) return { fast_check: 1 };
        break;
      case 'guest_permission':
        r = await this.db.await_func('user_permission', this.uid, nid);
        if (r > 0) return { fast_check: 1 };
        break;
      case 'socket_bound':
        let socket_id = this.input.need(Attr.socket_id);
        r = await this.yp.await_func('is_socket_bound', socket_id, this.input.activeSessionId());
        if (r > 0) return { fast_check: 1 };
        break;
      case 'public-api':
        return { fast_check: 1 };
    }
    return null;
  }

  /**
   * Service without mfs access should just run lighter check
   * @param {*} plateform
   */
  async check_remit(permission) {
    let r;
    r = await this.yp.await_func('get_remit', this.uid);
    if (r & permission.src) {
      return { fast_check: 1 };
    }
    return null;
  }

  /**
   * 
   * @param {*} pp 
   * @returns 
   */
  async check_env(pp) {
    if (pp) {
      if (pp.fast_check) {
        let r = await this.fast_check(pp.fast_check); // Service without mfs access
        return r;
      }

      if (pp.plateform) {
        let r = await this.check_remit(pp.permission); // Service without mfs access
        return r;
      }
    }
    if (!this._start_with) this._start_with = 'mfs_home';
    const home = await this.db.await_proc(this._start_with);
    if (!home) {
      this.warn(`No ${this._start_with} found for`, pp);
      return null;
    }
    this.mfs_root = home.home_dir;
    this.home_dir = home.home_dir;
    this.home_id = home.home_id;
    this.hub_id = home.hub_id;
    this.area = home.area;
    try {
      this.mfs_root = resolve(this.home_dir, '__storage__');
      this._block_root = resolve(this.home_dir, 'Block');
    } catch (e) {
      this.warn("Check env failed", e);
      throw ("CORRUPTED_ENVIRONMENT");
    }
    if (!this.home_id || !this.hub_id) throw ('CORRUPTED_ENVIRONMENT');

    this.set(home);

    let nid = this.input.use(Attr.nid) || this.input.use('p');
    if (isArray(nid)) {
      nid = nid[0].nid || nid[0].id || nid[0];
    } else if (['', '0', '-1', '-2', '-3', 0, -1, -2, -3].includes(nid)) {
      nid = this.home_id;
    } else if (/^\/.+$/.test(nid)) {
      nid = await this.db.await_func('node_id_from_path', normalize(nid));
    }
    if (nid == null) {
      nid = this.home_id;
    }
    // nid is only a *reference id*, in case of multiple ids, more check shall be done
    let node;
    try {
      /** nid may be JSON data. In such a case, delegate to acl_check */
      let entity = JSON.parse(nid);
      if (isString(entity)) {
        nid = entity;
      } else if (isArray(entity)) {
        nid = entity[0].nid || entity[0].id || entity[0];
      } else if (isObject(entity)) {
        nid = entity.nid || entity.id
      }
    } catch (e) {
    }

    node = await this.db.await_proc('mfs_access_node', this.uid, nid.substr(0, 16));

    if (!node) {
      if (!this.permission.src && !this.permission.dest) {
        return;
      }
      return null;
    }

    this.heap.nid = node.id;
    this.heap.hub_id = this.heap.hub_id || node.actual_hub_id;
    this.src = this._normalize_source();
    this.dest = this._normalize_destination();

    this._currentNode = node;
    return node;
  }

  /** check_domain
   * Check privilege of the current user on domin 
   * @param {string} id - domain id, by default current domain, if null master domain
  */
  async check_domain() {
    if (this.permission.scope !== Attr.domain) {
      return 1;
    }
    let dom_id = this.user.get(Attr.domain_id);
    const org_id = this.hub.get(Attr.org_id) || this.hub.get(Attr.domain_id);
    if (dom_id != org_id) {
      this.exception.forbiden("Cross domain service not permitted", { dom_id, org_id });
      return null;
    }

    let s = 0;
    let d = 1;
    if (this.permission.src) {
      s = await this.yp.await_func(
        'domain_permission', this.uid, dom_id, this.permission.src
      );
    }
    if (this.permission.dest) {
      d = await this.yp.await_func(
        'domain_permission', this.uid, dom_id, this.permission.dest
      );
    }
    return (s && d);
  }
  /** */
  async check_source(data) {
    this.__source.granted = [];
    this.__source.denied = [];
    let entity_id = this.uid;
    let rows = await this.db.await_proc(
      'acl_check',
      entity_id,
      this.src.permission,
      this.src.args
    );
    rows = toArray(rows, 1);
    for (let r of rows) {
      if (r.privilege & r.asked) {
        r.node = data;
        this.__source.granted.push(r);
      } else {
        this.__source.denied.push(r);
      }
    }
    if (this.__source.granted.length) return 1;
    return 0;
  }

  /**
   * 
   * @returns 
   */
  async check_dest() {
    if (!this.dest || !this.dest.nid) return 1;
    let proc;
    if (isArray(this.dest.nid)) {
      proc = 'acl_array_check_next';
    } else {
      proc = 'acl_check';
    }

    let rows = await this.db.await_proc(
      proc,
      this.uid,
      this.dest.permission,
      this.dest.args
    );
    this.__dest.granted = [];
    this.__dest.denied = [];
    rows = toArray(rows, 1);
    for (let r of rows) {
      if (r.privilege & r.asked) {
        this.__dest.granted.push(r);
      } else {
        this.__dest.denied.push(r);
      }
    }
    if (this.__dest.granted.length) return 1;
    return 0;
  }


  /**
   * 
   * @returns 
   */
  _normalize_source() {
    let perm;

    if (typeof (this.permission) == UNDEFINED) {
      perm = 0;
    } else {
      perm = this.permission.src;
    }

    if (!isNumber(perm)) {
      this.warn("WRONG_PERMISSION_DATA", this.permission);
      this.exception.server("SERVER_FAULT");
    }

    let src = {
      nid: this.heap.list || this.heap.nid || '*',
      hub_id: this.heap.hub_id || this.hub.get(Attr.id),
      permission: this._normalize_permission(perm),
      permissions: this.heap.permissions
    };

    if (isArray(this.heap.nodes)) {
      src.args = stringify(this._normalize_ids(this.heap.nodes));
    } else {
      src.args = stringify(this._normalize_ids(src));
    }
    this.heap.source = {
      permission: src.permission
    };
    return src;
  }

  /**
   * 
   * @returns 
   */
  _normalize_destination() {
    let perm;

    if (typeof (this.permission) == UNDEFINED) {
      perm = this.permission.dest;
    } else {
      perm = this.permission.dest;
    }

    if (perm == null) {
      this.dest = null;
      return;
    }
    let dest = {
      nid: this.heap.pid || '0',
      hub_id: this.heap.recipient_id || this.hub.get(Attr.id),
      permission: this._normalize_permission(perm),
    };

    dest.args = stringify(this._normalize_ids(dest));
    this.heap.destination = {
      permission: dest.permission
    }

    return dest;

  }

  /**
   * 
   * @param {*} opt 
   * @returns 
   */
  _normalize_ids(opt) {
    let r;
    if (isArray(opt.nid)) {
      opt = opt.nid;
    }
    if (isString(opt)) {
      r = {
        hub_id: this.hub.get(Attr.id),
        nid: [opt]
      };
      return [r];
    } else if (isArray(opt)) {
      r = [];
      for (let o of opt) {
        if (isString(o)) {
          r.push({
            nid: o,
            hub_id: this.hub.get(Attr.id)
          });
        } else if (isObject(o)) {
          const a = o;
          a.hub_id = o.hub_id || this.hub.get(Attr.id);
          if (isString(a.nid)) {
            a.nid = a.nid;
          }
          r.push(a);
        }
      }
      return r;
    } else {
      r = {
        hub_id: opt.hub_id || this.hub.get(Attr.id),
        nid: opt.nid
      };
      return [r];
    }
  }


  /**
   * 
   * @param {*} p 
   * @returns 
   */
  _normalize_permission(p) {
    let r = p;
    return p;
  }


  /**
   * 
   * @param {*} index 
   * @returns 
   */
  source_granted(index = 0) {
    if (!this.__source.granted) {
      return null;
    }
    if (isNumber(index)) {
      return this.__source.granted[index];
    }
    if (index == Attr.all) {
      return this.__source.granted;
    }
    let i = findIndex(this.__source.granted, { id: index });
    if (i >= 0) {
      return this.__source.granted[i];
    }
    return null;
  }

  /**
   * 
   * @param {*} node 
   */
  granted_node(data) {
    if (data) {
      this._currentNode = { ...this._currentNode, ...data };
      this.__source.granted[0] = this._currentNode;
    }
    try {
      this._currentNode.changeTag = this._currentNode.metadata.change_tag || this._currentNode.changeTag;
    } catch (e) {
    }

    return this._currentNode || {};
  }

  /**
   * 
   * @param {*} node 
   * @returns 
   */
  is_source_granted(node) {
    if (!this.source_granted(node.id)) {
      return 0;
    }
    return this.source_granted(node.id).privilege & node.permission;
  }

  /**
   * 
   * @param {*} index 
   * @returns 
   */
  dest_granted(index = 0) {
    if (!this.__dest.granted) {
      return null;
    }
    if (isNumber(index)) {
      return this.__dest.granted[index];
    }
    if (index == Attr.all) {
      return this.__dest.granted;
    }
    let i = findIndex(this.__dest.granted, { id: index });
    if (i >= 0) {
      return this.__dest.granted[i];
    }
    return null;
  }

  /**
   * 
   * @param {*} node 
   * @returns 
   */
  is_dest_granted(node) {
    if (!this.dest_granted(node.id)) {
      return 0;
    }
    return this.dest_granted(node.id).privilege & node.permission;
  }

  /**
   * 
   * @param {*} way 
   * @param {*} index 
   * @returns 
   */
  source_denied(way, index = 0) {
    if (!isNumber(index)) {
      return this.__source.denied[index];
    }
    return this.__source.denied;
  }

  /**
   * 
   * @param {*} way 
   * @param {*} index 
   * @returns 
   */
  dest_denied(way, index = 0) {
    if (!isNumber(index)) {
      return this.__dest.denied[index];
    }
    return this.__dest.denied;
  }


  /**
   * 
   * @returns 
   */
  source_nodes() {
    return this.parseJSON(this.src.args);
  }

  /**
   * 
   * @returns 
   */
  dest_nodes() {
    return this.parseJSON(this.dest.args);
  }


  /**
   * 
   * @returns 
   */
  stop() {
    if (this._stopping) return;
    let svc = this.input.get(Attr.service);
    if (this.db) this.db.end();
    this.destroy();
    super.stop();
    this.debug(`[${svc}][${JID}][TERMINATED]`);
  }

}



module.exports = __acl;
