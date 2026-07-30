
const {
  Attr, Cache, Logger, sysEnv, Constants, Events, nullValue, sendSms, Messenger
} = require("@drumee/server-essentials");
const { main_domain, domain_desc } = sysEnv();
const END_OF_SESSION = "end:of:session";
const {
  INPUT_READY,
  SENT,
  ERROR,
  READY,
  START,
  DENIED,
} = Events;
const {
  IDENT_NOBODY,
  ID_NOBODY,
  DRUMATE,
  DB_NOBODY,
  COOKIE_SID,
  DOMAIN_NAME,
} = Constants;

const { isEmpty, isString } = require("lodash");
const Exception = require("./exception");
const User = require("./user");

const MAIDEN_SESSION = "maiden_session";
let SEQ = 0;
const PID = process.pid;

//########################################
class coreSession extends Logger {

  /**
   * 
   * @param {*} opt 
   * @returns 
   */
  initialize(opt) {

    if (opt.env == null) {
      this.warn("Missing global environment");
      return;
    }
    if (opt.env.yp == null) {
      this.warn("No yellow pages ");
      return;
    }

    this.input = opt.input;
    this.output = opt.output;
    this.exception = new Exception({
      output: this.output,
    });

    this.hub = new Logger();
    this.yp = opt.env.yp;
    this.websocket = new Logger();

    this.user = new User({
      output: this.output,
      input: this.input,
    });
    this.user.yp = opt.env.yp;
    this.input.once("precondition_failed", this._precondition.bind(this));
    this.output.once(SENT, () => {
      this.trigger(END_OF_SESSION);
      this.stop();
    });
    this.input.once(INPUT_READY, () => {
      if (this.input.get("parse_error")) {
        this.trigger(END_OF_SESSION);
        this.exception.user("MAL_FORMED_REQUEST");
        return;
      }
      this.output.set(Attr.domain, this.input.domain())
      this._selectSession();
    });

    if (SEQ > 9999999) SEQ = 0;
    SEQ++;
    let seq = SEQ.toString();
    seq = PID + seq.padStart(8, " ");
  }

  /**
   * 
   */
  async _selectSession() {
    if (!this.validSid()) {
      this.warn("Error in [_selectSession] -- Invalid authorization data", this.input.authorization(), this.sid());
      return this.trigger(ERROR);
    }

    let service = this.input.get(Attr.service);
    this.output.set({ service });

    let echoId = this.input.get("echoId");
    if (echoId) {
      this.output.set({ echoId });
    }
    /** _initHub and _initUser are independent: authorization() derives only from
     *  cookie/query/host on Input, and _initUser never reads hub state. Running
     *  them concurrently removes one serial DB round trip from every request. */
    const [hubInit, userInit] = await Promise.allSettled([
      this._initHub(),
      this._initUser(),
    ]);
    /** Hub init failures have always been swallowed here */
    if (hubInit.status === "rejected") {
      this.debug("Failed to initialize hub", hubInit.reason);
    }
    if (userInit.status === "rejected") {
      this.warn("Failed to initialize user", userInit.reason);
      this.exception.user("USER_ENV_CORRUPTED");
      return;
    }
    //this.refreshAuthorization();
    this.trigger(READY);
  }

  /**
   *
   */
  async _initHub() {
    let hub;
    let hub_id = this.input.get(Attr.hub_id);
    let vhost = this.input.get(Attr.vhost);
    if (vhost) {
      hub = await this.yp.await_proc("get_hub", vhost);
      hub_id = hub.id;
      this.input.set({ hub_id: hub.id });
    } else {
      if (nullValue(hub_id)) {
        hub_id = this.input.host();
      }
      hub = await this.yp.await_proc("get_hub", hub_id);
    }
    if (isEmpty(hub)) {
      await this._default_hub();
    } else {
      this.hub.set(hub);
      if (hub.exists && hub.hostname) {
        this.output.set({ host: hub.hostname });
      } else {
        this.output.set({ host: hub.domain });
      }
      try {
        this.hub.set(Attr.profile, this.parseJSON(hub.profile));
      } catch (error) {
        this.warn("Profile parse error", error);
        this.hub.set(Attr.profile, {});
        this.trigger(ERROR, error);
      }
      try {
        this.hub.set(Attr.settings, this.parseJSON(hub.settings));
      } catch (error1) {
        this.warn("Settings parse error", error1);
        this.hub.set(Attr.settings, {});
        this.trigger(ERROR, error1);
      }
    }

    this.output.set({
      vhost: hub.vhost,
      domain: hub.domain,
      title: hub.title,
      icon: hub.icon,
      area: hub.area,
      default_lang: hub.default_lang,
    });
  }

  /**
   * 
   * @param {*} sid 
   */
  validSid() {
    let { sid } = this.input.authorization();
    if (!isString(sid)) {
      return false;
    }
    if (nullValue(sid)) {
      return false;
    }
    if (sid.length < 10) {
      return false;
    }
    return true;
  }

  /**
   *
   * @returns
   */
  sid() {
    return this.input.sid();
  }


  /**
   *
   * @returns
   */
  isAnonymous() {
    return this.user.get("signed_in") != 1;
  }

  /**
   *
   * @returns
   */
  isGuest() {
    return this.user.get('isGuest');
  }

  /**
   *
   * @returns
   */
  mimicker() {
    return this.user.get(Attr.mimicker);
  }

  /**
   *
   * @returns
   */
  mimic_id() {
    return this.user.get(Attr.mimic_id);
  }

  /**
   *
   * @returns
   */
  username() {
    return this.user.get(Attr.username) || IDENT_NOBODY;
  }

  /**
   *
   * @returns
   */
  uid() {
    return this.user.get(Attr.id) || ID_NOBODY;
  }

  /**
   * 
   * @returns 
   */
  ident() {
    return this.user.get(Attr.username);
  }

  /**
   * 
   * @param {*} data 
   */
  check_sanity(data) {
    if (data.type === DRUMATE && this.user.get(Attr.id) !== data.id) {
      this.trigger(DENIED);
    }
  }

  /**
   *
   */
  get_visitor() {
    return this.user;
  }

  // ========================
  // When yp return nothing, ensure to have default
  // ========================
  _default_user() {
    this.user.set({
      id: ID_NOBODY,
      ident: IDENT_NOBODY,
      username: IDENT_NOBODY,
      db_name: DB_NOBODY,
      signed_in: 0,
      settings: {},
      profile: {},
      organisation: {
        link: main_domain,
      },
    });
  }

  /**
   * 
   * @param {*} sid 
   */
  _guest_user(sid) {
    this.user.set({
      id: Cache.getSysConf("guest_id"),
      ident: Attr.guest,
      username: Attr.guest,
      db_name: DB_NOBODY,
      signed_in: 0,
      session_id: this.sid(),
      settings: {},
      profile: {},
      isGuest: 1
    });
  }

  /**
   * 
   */
  _precondition() {
    this.trigger(END_OF_SESSION);
    let err = this.input.getError();
    this.warn(err);
    this.exception.precondition(err);
  }

  // ========================
  // When yp return nothing, ensure to have default
  // ========================
  async _default_hub() {
    let hub = await this.yp.await_proc("get_hub", main_domain);
    this.hub.set(hub);
    this.set({
      domain: main_domain || DOMAIN_NAME,
    });
  }

  /**
   *
   * @param {*} user
   */
  async _assign_user(user) {
    if (this._started) return;
    this._started = 1;
    this.user.set({ session_id: this.sid() });
    if (isEmpty(user)) {
      this._default_user();
      this.output.set({ status: "offline" });
      this.trigger(START);
      return;
    }

    if (user.signed_in) {
      user.connection = "online";
      this.output.set({ status: user.connection });
      this.user.set({ connection: user.connection });
    }

    try {
      this.user.set(Attr.quota, this.parseJSON(user.quota));
    } catch (e) {
      this.user.set(Attr.quota, {});
      // this.trigger(ERROR, e);
    }
    try {
      user.profile = this.parseJSON(user.profile);
      if (user.profile && !isEmpty(user.profile.address)) {
        user.profile.address = this.parseJSON(user.profile.address);
      }
      this.user.set(Attr.profile, user.profile);
    } catch (error) {
      this.user.set(Attr.profile, {});
      // this.trigger(ERROR, error);
    }
    try {
      this.user.set(Attr.settings, this.parseJSON(user.settings));
    } catch (error1) {
      this.user.set(Attr.settings, {});
      // this.trigger(ERROR, error1);
    }
    this.trigger(START);
  }

  /**
   *
   * @param {*} user
   */
  async _handleOrganization(user) {
    /** DEPRECATED -- mimic handling. user.mimicker is always NULL
     *  (hardcoded in session_check_cookie), so this never ran. */
    // if (!isEmpty(user.mimicker)) {
    //   user.mimic_entity = {};
    //   user.mimic_entity = await this.yp.await_proc(
    //     `${user.db_name}.shareroom_contact_get`,
    //     user.mimicker
    //   );
    // }
    return;
  }

  /**
   *
   * @param {*} sid
   */
  async dmz_logout() {
    const sid = this.sid();
    const uid = this.user.get(Attr.id);
    await this.yp.call_proc("session_logout", sid, uid);
    this.output.clearAuthorization(this.input.authorization());
    this.output.data({});
  }

  /**
   *
   * @param {*} sid
   */
  async dmz_login(token, password) {
    if (!/^(share|dmz|public)$/.test(this.hub.get(Attr.area))) {
      this.warn(`[dmz_login] WRONG AREA=`, this.hub.get(Attr.area));
      return {
        failed: 1,
        error: "WRONG_AREA",
      };
    }

    let sid = this.sid();
    let socket_id = this.input.get(Attr.socket_id);
    let guest = await this.yp.await_proc(
      "session_dmz_login",
      token,
      password,
      socket_id
    );

    if (isEmpty(guest)) {
      return {
        failed: 1,
        error: "INVALID_CREDENTIAL",
      };
    }
    guest.is_verified = 1;
    guest.is_guest = 1;
    await this.yp.await_proc("cookie_touch", { sid, socket_id, uid: guest.id });
    this.user.set({
      id: guest.id,
      ident: guest.id,
      session_id: sid,
      username: guest.guest_name,
      db_name: DB_NOBODY,
      domain: this.hub.get(Attr.domain),
      is_guest: 1,
      signed_in: 0,
      settings: {},
      profile: {},
      organisation: {
        link: this.hub.get(Attr.domain),
      },
    });
    this.refreshAuthorization();
    return guest;
  }

  /**
   *
   * @param {*} u
   * @returns
   */
  async _initUser(u) {
    /** Pass the process-cached sysconf ids so the proc can skip two
     *  get_sysconf() lookups. It falls back to its own lookup if absent. */
    const sysIds = {
      guest_id: Cache.getSysConf("guest_id"),
      nobody_id: Cache.getSysConf("nobody_id"),
    };
    let auth = this.input.authorization();
    let user = await this.yp.await_proc(
      "session_check_cookie", { ...auth, ...sysIds }
    );
    if (!user) {
      user = await this.yp.await_proc(
        "session_check_cookie", { ...this.input.authorization(1), ...sysIds }
      );
    }
    if (user.signed_in) {
      await this._handleOrganization(user);
    }
    this.user.set(user);
    this.set({
      id: user.session_id,
      connection: user.connection,
    });

    const status = user.status;
    /** DEPRECATED -- mimic handling */
    // const mimicker = user.mimicker;
    switch (user.connection) {
      case "otp":
        /** Ensure otp is still active */
        await this._assign_user(user);
        this.output.set({ status: user.connection });
        break;
      case "new":
        await this._assign_user({});
        break;
      case "ok":
        switch (user.status) {
          case Attr.system:
            user.connection = "offline";
            await this._assign_user(user);
            break;
          case Attr.active:
            user.connection = "online";
            await this._assign_user(user);
            break;
          case Attr.frozen:
            this.exception.forbiden(status);
            break;
          case Attr.locked:
          case Attr.archived:
            /** DEPRECATED -- mimic handling. mimicker was always empty, so this
             *  always took the else branch; kept as the plain forbiden() call. */
            // if (!isEmpty(mimicker)) {
            //   await this._assign_user(user);
            // } else {
            this.exception.forbiden(status);
            // }
            break;
          default:
            this.warn(`Unexpected user status`, user);
            await this._assign_user({});
        }
        break;
      default:
        await this._assign_user({});
    }
    return user;
  }

  /**
   * 
   */
  refreshAuthorization(force = 0) {
    if (this.input.sourceName != Attr.service && !force) {
      return
    }
    this.output.setAuthorization(this.input.authorization());
  }

  /** Log signin activity
   *  @params {string} option
   *  @params {string} sid -- session_id
   *  @params {string} uid -- user id
   */
  async _log_connection(opt) {
    const geoip = require("geoip-lite");
    let ip = this.input.ip();
    let geodata = geoip.lookup(ip) || {};
    await this.yp.await_proc(
      "analytics_log",
      this.input.get(Attr.service),
      { success: 1, ...opt, ip, geodata },
      opt.uid || this.user.get(Attr.id),
      this.hub.get(Attr.id),
      this.input.headers()
    );
  }

  /**
   * 
   */
  async selectOtpMethod(profile, args) {
    const lang = this.input.app_language();
    const { mobile } = profile;
    switch (profile.otp) {
      case Attr.sms:
        try {
          await sendSms(args);
          return {
            mobile: mobile.substr(profile.mobile.length - 4),
            secret: args.secret,
          }
        } catch (e) {
          this.warn("FAILED TO SEND OTP. Trying alternat", e);
          this.exception.server("FAILED_TO_SEND_SMS");
          return;
        }
        break;
      case Attr.email:
        let template = "butler/otp";
        const msg = new Messenger({
          template,
          subject: Cache.message("_your_otp", lang),
          recipient: profile.email,
          lex: Cache.lex(lang),
          data: {
            recipient: profile.displayName || email.replace(/@.+$/, ''),
            text: args.message,
            home: main_domain,
          },
          handler: this.exception.email
        });
        await msg.send();
        return {
          secret: args.secret,
        };
      case Attr.passkey:
        return
      default:
        this.exception.server("INVALID_OTP_METHOD", profile.otp);
        return

    }
  }

  /** Send One Time Password
   *  @params {object} profile -- as extracted from yp
   *  @params {object} args -- extra data to be sent back to frontend
   */
  async send_otp(user) {
    const Moment = require("moment");
    let { profile, fullname, firstname } = user;
    if (isString(profile)) {
      profile = this.parseJSON(profile);
    }
    if (isEmpty(profile.areacode)) {
      profile.areacode = "";
    }
    profile.displayName = firstname || fullname;
    const token = this.randomString();
    const lang = this.input.page_language() || "en";
    let otp = await this.yp.await_proc("otp_create", user.id, token);
    const message = Cache.message("_otp_code", lang);
    Moment.locale(lang);
    let e = otp.expiry || Moment.now() / 1000 + 60 * 10;
    const expiry = Moment(e, "X").format("hh:mm");
    let opt = {
      message: `${message.format(otp.code, domain_desc, expiry)}`,
      receivers: [profile.areacode.concat(profile.mobile)],
      secret: otp.secret
    };
    return this.selectOtpMethod(profile, opt)
  }

  /**
   *
   */
  normal_session(sid) {
    this.input.set({ maiden_session: 0 });
    this.output.cookie(MAIDEN_SESSION, null, main_domain);
    if (sid) {
      this.output.cookie(COOKIE_SID, sid, main_domain);
    }
    this.unset(MAIDEN_SESSION);
  }

  /** authenticate
   * Authenticate login using OTP
   * @param {string} -- token sent by this.login as rest response
   * @param {string} -- code sent by this.send_otp as push message
   */
  async authenticate(secret, code) {
    const sid = this.sid();
    if (secret && code) {
      let user = await this.yp.await_proc(
        "otp_authenticate",
        sid,
        secret,
        code
      );
      if (isEmpty(user)) {
        const { ident } = this.input.use("vars") || {};
        await this._log_connection({ ident, success: 0, reason: "INVALID_CODE" });
        this.output.data({ status: "INVALID_CODE", secret: secret });
        return;
      }
      await this._assign_user(user);
      await this._log_connection({ uid: user.id });
      user = await this.yp.await_proc("get_user", user.id);
      let organization = await this.yp.await_proc("my_organisation", user.id);
      let data = {
        user: { ...user, signed_in: 1 },
        organization,
        hub: this.hub.toJSON()
      }
      this.refreshAuthorization();
      this.output.data(data);
      return;
    }
    await this._log_connection({ success: 0, reason: "Server fault" });
    this.exception.server("SHOULD NOT HAPPEN");
  }

  /** reactivate
   * if v.secret is set, reactivate the account, whenever the secret is still valid
   */
  async reactivate(v) {
    let i = await this.yp.await_proc("token_get", v.secret);
    if (isEmpty(i)) return;

    //let entity = await this.yp.await_proc('get_user', v.ident);
    let entity = await this.yp.await_proc(
      "get_user_in_domain",
      v.ident,
      this.input.host()
    );
    if (entity.id == i.inviter_id) {
      await this.yp.await_proc("entity_set_status", i.inviter_id, "active");
      await self.yp.await_proc("token_delete", v.secret);
    }
  }

  /** login
   * If user's profile has opt set, send OTP
   */
  async signin(v = {}) {
    this.refreshAuthorization(1);
    let sid = this.sid();
    if (!sid) {
      return {
        status: "INVALID_SID",
      };
    }

    let { uid, host, username, password, secret } = v;
    if (secret) await this.reactivate(v, secret);
    let args = { username, uid, password, sid, host };
    let user = await this.yp.await_proc("session_signin", args);

    switch (user.condition) {
      case Attr.offline:
        if (!isEmpty(user.secret)) {
          return {
            status: "INCOMPLETE_SIGNUP",
            secret: user.secret,
          };
        }
        break;

      case Attr.locked:
        await this.yp.await_proc(
          "session_reset",
          sid,
          user.id,
          this.input.get(Attr.socket_id)
        );
        return {
          status: "BLOCKED",
          reason: user.condition,
        };

      case Attr.archived:
      case Attr.frozen:
        await this.yp.await_proc(
          "session_reset",
          sid,
          user.id,
          this.input.get(Attr.socket_id)
        );
        return {
          status: "ARCHIVED",
          reason: user.condition,
        };

      case "no_cookie":
        let s = await this.yp.await_proc(
          "session_check_cookie", this.input.authorization()
        );
        let s2 = await this.yp.await_proc("get_user", s.id);
        return {
          ...s2,
          auth: s.session_id,
          status: user.condition,
          signed_in: 1,
        };
    }

    if (user.status == "otp") {
      let res = await this.send_otp(user);
      return res;
    }
    if (isEmpty(user) || user.failed) {
      await this._log_connection({ ident: username, success: 0, reason: "WRONG_CREDENTIALS" });
      return {
        error: "user_error",
        reason: user.status,
        status: "WRONG_CREDENTIALS",
      };
    } else {
      await this._handleOrganization(user);
      await this._log_connection({ uid: user.id });
      user = await this.yp.await_proc("get_user", user.id);
      let organization = await this.yp.await_proc("my_organisation", user.id);
      if (isEmpty(organization)) {
        organization = await this.yp.await_proc(
          "organisation_get",
          this.hub.get(Attr.vhost)
        );
      }

      let data = {
        user: { ...user, signed_in: 1 },
        status: "ok",
        organization,
        hub: this.hub.toJSON(),
      }
      return data;
    }
  }

  /** login
   * If user's profile has opt set, send OTP
   */
  async login(v = {}, resent) {
    let sid = this.sid();
    if (!sid) {
      return this.output.data({
        status: "INVALID_SID",
      });
    }
    let user;
    if (resent) {
      user = this.user.toJSON();
      let res = await this.send_otp(user);
      this.output.data(res);
      return;
    }
    let { ident, password, secret } = v;
    if (secret) await this.reactivate(v, secret);
    let host = this.input.get(Attr.vhost) || this.input.host();
    user = await this.yp.await_proc(
      "session_login_next",
      ident.trim(),
      password,
      sid,
      host
    );
    this.refreshAuthorization();
    switch (user.condition) {
      case Attr.offline:
        if (!isEmpty(user.secret)) {
          this.output.data({
            status: "INCOMPLETE_SIGNUP",
            secret: user.secret,
          });
          return;
        }
        break;

      case Attr.locked:
        await this.yp.await_proc(
          "session_reset",
          sid,
          user.id,
          this.input.get(Attr.socket_id)
        );
        this.output.data({
          status: "BLOCKED",
          reason: user.condition,
        });
        return;

      case Attr.archived:
      case Attr.frozen:
        await this.yp.await_proc(
          "session_reset",
          sid,
          user.id,
          this.input.get(Attr.socket_id)
        );
        this.output.data({
          status: "ARCHIVED",
          reason: user.condition,
        });
        return;

      case "no_cookie":
        let s = await this.yp.await_proc(
          "session_check_cookie", this.input.authorization()
        );
        let s2 = await this.yp.await_proc("get_user", s.id);
        this.output.data({
          ...s2,
          auth: s.session_id,
          status: user.condition,
          signed_in: 1,
        });
        return;
    }

    if (user.status == "otp") {
      let res = await this.send_otp(user);
      this.output.data(res);
      return;
    }
    if (isEmpty(user) || user.failed) {
      await this._log_connection({ ident, success: 0, reason: "WRONG_CREDENTIALS" });
      this.output.data({
        error: "user_error",
        reason: user.status,
        status: "WRONG_CREDENTIALS",
      });
    } else {
      await this._handleOrganization(user);
      await this._log_connection({ uid: user.id });
      user = await this.yp.await_proc("get_user", user.id);
      let organization = await this.yp.await_proc("my_organisation", user.id);
      if (isEmpty(organization)) {
        organization = await this.yp.await_proc(
          "organisation_get",
          this.hub.get(Attr.vhost)
        );
      }

      let data = {
        user: { ...user, signed_in: 1 },
        status: "ok",
        organization,
        hub: this.hub.toJSON(),
      }
      this.output.data(data);
    }
  }

  /** logout
   * If user's profile has opt set, send OTP
   */
  async logout(data) {
    const sid = this.sid();
    const uid = this.user.get(Attr.id);
    await this.yp.call_proc("session_logout", sid, uid);
    await this._log_connection({ sid, uid });
    this.output.clearAuthorization(this.input.authorization());
    this.output.data(data);
  }

  /**
   *
   */
  async log_service(data) {
    let page = this.input.get(Attr.page);
    if (page && page > 1) return;
    let args = this.sanitize(this.input.data());
    let headers = this.input.headers();
    delete headers.cookie;
    await this.yp.await_proc(
      "analytics_log",
      this.input.get(Attr.service),
      args,
      this.user.get(Attr.id),
      this.hub.get(Attr.id),
      { ...headers, ...data }
    );
  }
}

module.exports = coreSession;
