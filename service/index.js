const { Entity } = require('@drumee/server-core');
const {
  Cache, toArray, Attr, RedisStore
} = require('@drumee/server-essentials');
const Organization = require("./lib/organization");
const Page = require("./lib/page");
const { resolve } = require('path');

class Sandbox extends Entity {

  /**
   * 
   */
  async create() {
    const sandox_name = this.input.get(Attr.domain);
    const email = this.input.get(Attr.email) || "";
    if (/^nobody/.test(email)) {
      let headers = this.input.headers();
      delete headers.cookie;
      await this.yp.await_proc("sandbox.store_email", email, headers);
    }
    const socket_id = this.input.get(Attr.socket_id);
    let res;
    let drumate = parseInt(await this.yp.await_func("pool_free", Attr.drumate));
    let hub = parseInt(await this.yp.await_func("pool_free", Attr.hub));
    if (drumate < 10 || hub < 20) {
      return this.output.data({ error: "LOW_SEEDS_LEVEL" });
    }
    if (sandox_name) {
      res = await this.yp.await_proc("sandbox.domain_users", sandox_name);
      if (res && res.length) {
        this.debug(`AAA:31 - ${sandox_name} already exists`, res);
        this.output.data(res);
        return;
      }
    }
    const org = new Organization({ yp: this.yp, socket_id });
    let domain = await org.createDomain();
    const owner = await org.createOwner();
    let i = 0;
    if (owner) {
      const members = [];
      while (i < 1) {
        let member = await org.AddMember();
        members.push(member.get(Attr.uid));
        i++;
      }
      for (let uid of members) {
        await org.updateContacts(uid);
      }
    }
    res = await this.yp.await_proc("sandbox.domain_users", domain.name);
    this.output.data(res);
  }

  /**
   * 
   * @returns 
   */
  authorization() {
    let auth = this.input.authorization() || {};
    let c = {
      type: auth.type,
      session_type: auth.type,
      sid: auth.id,
      device_id: this.input.get(Attr.device_id)
    }
    return c;
  }

  /**
    * 
  */
  async logout(sid, uid) {
    let sockets = await this.yp.await_proc('user_sockets', uid);
    sockets = toArray(sockets).filter((e) => {
      return e.cookie == sid
    })

    await RedisStore.sendData(this.payload({ uid, session_id: sid }), sockets);
    await this.yp.call_proc("session_logout", sid, uid);
  }


  /**
   * 
   */
  async _write(user) {
    let page;
    try {
      page = new Page({
        session: this.session,
        permission: this.permission,
        user: this.user
      });
    } catch (e) {
      this.warn("PAGE_ERROR", e);
      return this.exception.server("PAGE_ERROR");
    }
    let auth = this.authorization();
    let keysel = user.id;
    auth[keysel] = user.session_id;
    const params = {
      host: this.input.host(),
      session_type: Attr.regular,
      keysel,
      auth,
      id: user.session_id
    }
    this.output.setAuthorization(params);
    await page.main(user);
    return this.output.list([]);
  }

  /**
   * 
   */
  async _checkSession(token) {
    let sql = `SELECT * FROM sandbox.token WHERE id=?`;
    let res = await this.yp.await_query(sql, token);
    let { value, domain } = res || {};
    let { password, email } = value || {};
    let auth = this.authorization();
    let { sid } = auth;
    this._sid = sid;
    if (!sid) {
      this.exception.not_found("INVALID_SESSION");
      return {};
    }
    if (!password) {
      this.exception.not_found("TOKEN_ONT_FOUND");
      return {};
    }
    let user = await this.yp.await_proc(
      "session_check_cookie", auth
    );
    if (!user || !user.signed_in) {
      user = await this.yp.await_proc(
        "session_login_next",
        email,
        password,
        sid,
        domain
      );
      return { ...user, domain };
    }
    if (res.uid == user.id) {
      return { ...user, domain };
    }

    await this.logout(sid, user.id);
    user = await this.yp.await_proc(
      "session_login_next",
      email,
      password,
      sid,
      domain
    );
    return { ...user, domain };
  }

  /**
 * 
 * @returns 
 */
  async updateProgress() {
    this.debug("PROGRESS", this.input.get(Attr.service), this._progress, this.socket_id);
    if (!this.socket_id) return;
    this._progress++;
    const model = {
      progress: this._progress,
    };
    let payload = {
      options: {
        service: "sandbox.progress",
        event: this.input.get(Attr.service)
      },
      model
    };
    await RedisStore.sendData(payload, this.socket_id);
  }

  /**
   * 
   */
  async get_env() {
    this._progress = 5;
    const quota = Cache.getSysConf("sandbox_quota");
    const domain = this.input.get(Attr.domain);
    this.socket_id = this.input.get(Attr.socket_id);
    let users = await this.yp.await_proc("sandbox.domain_users", domain);
    await this.updateProgress();
    this.output.data({ users, quota: JSON.parse(quota) });
  }

  /**
   * 
   */
  async subscribe_me() {
    const email = this.input.need(Attr.email);
    let headers = this.input.headers();
    delete headers.cookie;
    await this.yp.await_proc("sandbox.store_email", email, headers);
    this.output.data({ email });
  }


  /**
   * 
   */
  async load() {
    let token = this.input.need(Attr.token);
    const user = await this._checkSession(token);
    this.user.set(user);

    const { domain } = user;
    if (!domain) {
      this.output.list([]);
      return
    }
    await this._write(user);
  }

  /**
   * 
   * @returns 
   */
  async remove() {
    const SPAWN_OPT = { detached: true, stdio: ["ignore", "ignore", "ignore"] };
    const Spawn = require("child_process").spawn;
    const token = this.input.need(Attr.token);
    const socket_id = this.input.get(Attr.socket_id) || "no-socket";
    const user = await this._checkSession(token);
    const { domain } = user;
    if (!domain) {
      this.output.data({});
      return;
    }
    let cmd = resolve(
      __dirname,
      "detach",
      "remove.js",
    );
    let args = { name: domain, id: user.domain_id, socket_id }
    let child = Spawn(cmd, [JSON.stringify(args)], SPAWN_OPT);
    child.unref();
    this.output.list({});
  }
}


module.exports = Sandbox;