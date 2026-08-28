const {
  Attr, Logger, Cache, Constants
} = require("@drumee/server-essentials");

const {
  IDENT_NOBODY,
  ID_NOBODY,
} = Constants;

const {resolve} = require("path");
const { isString } = require("lodash");

class __core_user extends Logger {

  initialize(opt) {
    const p = this.get(Attr.profile);
    this.input = opt.input;
    this.unset("input");
    this.unset("output");
    if (isString(p)) {
      this.set({
        profile: JSON.parse(p),
      });
    }
  }

  /**
   * 
   * @returns 
   */
  isAnonymous() {
    return this.user.get(Attr.ident) === IDENT_NOBODY;
  }

  /**
   * 
   * @returns 
   */
  language() {
    const p = this.get(Attr.profile) || {};
    return p.lang || this.input.app_language();
  }

  /**
   * 
   * @param {*} key 
   * @returns 
   */
  locale_message(key) {
    let lang = this.language();
    return Cache.message(key, lang);
  }

  /**
   *
   * @returns
   */
  uid() {
    const uid = this.get("user_id") || this.get(Attr.id) || ID_NOBODY;
    return uid;
  }

  /**
   *
   */
  async organization() {
    return await this.yp.await_proc("my_organisation", this.uid());
  }

  /**
   *
   * @returns
   */
  ident() {
    return this.get(Attr.username) || this.get(Attr.ident);
  }

  /**
   *
   * @returns
   */
  domain_id() {
    return this.get("domain_id") || this.get("dom_id");
  }

  /**
   *
   */
  notify(service, dest, data) {
    let agent;
    let user = this.toJSON();
    delete user.profile;
    const Spawn = require("child_process").spawn;

    if (!dest.server) dest.server = Cache.getEnv(Attr.endpointAddress);

    let destination = { service: "live.update", ...dest };
    let payload = JSON.stringify(data);
    let args = [JSON.stringify(destination), payload];

    switch (service) {
      case "media.preview":
        agent = resolve(
          process.env.server_home,
          "offline",
          "media",
          "preview.js"
        );
        break;
    }
    // Who do what ?
    this.debug("AAA:87", agent, args, this.get(Attr.id));
    if (agent) Spawn(agent, args, { detached: true });
  }
}

module.exports = __core_user;
