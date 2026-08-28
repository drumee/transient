const { button } = require("../toolkit/skeleton")

/**
 * Class representing signup page in Welcome module.
 * @class __welcome_signup
 * @extends __welcome_interact
 */
require('./skin');
class signin_router extends LetcBox {

  /**
   ** @param {object} opt
  */
  initialize(opt = {}) {
    super.initialize(opt);
    this.declareHandlers();
    this.mset({ flow: _a.y });
    this._step = parseInt(localStorage.signup_step) || 0;
    this._max_step = 1;
    try {
      LOCALE.extend(require("../../locale")('en'));
    } catch (e) {
      LOCALE = { ...LOCALE, ...require("../../locale")(Visitor.language()) }
    }
  }

  /** */
  loadWidget(pace = 0) {
    let opt = { uiHandler: [this], kind: "signin_form", email: this.mget(_a.email) }
    this._step = this._step + pace;
    if (this._step > this._max_step) this._step = this._max_step;
    if (this._step < 0) this._step = 0;
    switch (this._step) {
      case 0:
        opt.kind = "signin_form";
        break;
      case 1:
        opt.kind = "signup_otp";
        break;
    }
    this.feed(opt);
  }

  /**
   * Parse an OAuth 2FA hand-off from the URL. After a Google/Apple sign-in by a
   * 2FA-enabled user, loby bounces the browser back to
   * `#/welcome/signin?oauth_mfa=1&email=...` with the session left pending. The
   * query string lives inside the hash fragment.
   * @returns {{email:string}|null}
   */
  _oauthMfaParams() {
    const hash = location.hash || '';
    const qi = hash.indexOf('?');
    if (qi < 0) return null;
    const params = new URLSearchParams(hash.slice(qi + 1));
    if (params.get('oauth_mfa') !== '1') return null;
    return { email: params.get('email') || '' };
  }

  /**
   * Read the hash query — it lives inside the hash fragment, same as the OAuth
   * hand-off above. `#/welcome/signin?view=guest&name=Alpha` → URLSearchParams.
   * @returns {URLSearchParams} empty when the hash carries no query.
   */
  _hashParams() {
    const hash = location.hash || '';
    const qi = hash.indexOf('?');
    return new URLSearchParams(qi < 0 ? '' : hash.slice(qi + 1));
  }

  /**
   * Read a `view` selector out of the hash query.
   * `#/welcome/signin?view=guest` → 'guest'.
   * @returns {string} the requested view, or '' when none was asked for.
   */
  _viewParam() {
    return this._hashParams().get('view') || '';
  }

  /**
    *
    */
  async onDomRefresh() {
    // Anonymous guest landing page. Checked FIRST: the sign-in paths below end by
    // rewriting location.hash to a bare "#/welcome/signin", which would drop the
    // ?view=guest selector.
    if (this._viewParam() === 'guest') {
      const params = this._hashParams();
      await Kind.waitFor('signin_guest');
      // `scope` and `name` come from the invite email's CTA (server:
      // _guestLandingLink). scope picks the layout (internal = the Content
      // Restricted gate, external = the shared-contents view); name puts the real
      // workspace in the header. Both absent is fine — the widget falls back to
      // internal + its generic copy, which is the safe direction.
      this.feed({
        kind: 'signin_guest',
        scope: params.get('scope') || '',
        // Anonymous share token, present on external links only. It is what lets the
        // external layout read the real shared folder (dmz.login → show_node_by);
        // the internal layout never receives one.
        token: params.get('token') || '',
        // Which workspace the invite is for (server: _guestLandingLink). Present
        // on both scopes; it is the ONLY way the internal layout can know, since
        // it has no token to resolve one from.
        hub_id: params.get('hub') || '',
        title: params.get('name') || '',
        parent_name: params.get('parent') || '',
        current_name: params.get('current') || '',
      });
      return;
    }
    // OAuth 2FA hand-off: render the OTP screen pointed at oauth.verify_otp,
    // which finalizes the pending session (no client-side secret).
    const mfa = this._oauthMfaParams();
    if (mfa) {
      await this._mountOtp({
        payload: { email: mfa.email, method: 'oauth' },
        api: SERVICE.oauth.verify_otp,
        resendApi: SERVICE.oauth.resend_otp,
        title: "Multi factor authentication",
        message: "We have sent a code to {0} to validate your connection".format(mfa.email),
        resendService: 'resend-signin-otp',
        service: 'otp-signined'
      }, true);
      return;
    }
    if (Visitor.get('connection') == 'otp') {
      let { email } = Visitor.profile()
      await this._mountOtp({
        payload: {
          uid: Visitor.id,
          id: Visitor.id,
          secret: Visitor.get('otp_key'),
          email,
          method: 'otp'
        },
        api: SERVICE.yp.login_top,
        email,
        title: "Multi factor athentication",
        message: "We have sent a code to {0} validate you connection".format(email),
        resendService: 'resend-signin-otp',
        service: 'otp-signined'
      }, true);
      return
    }
    let { main_domain, protocol, endpoint } = bootstrap()
    if (!Visitor.isOnline() && location.host != main_domain) {
      location.href = `${protocol}://${main_domain}${endpoint}#/welcome/signin`
      return
    }
    location.hash = "#/welcome/signin"
    this.feed({ kind: 'signin_form' });
  }

  /**
  * To avoid full page reload upon login 
  */
  gotSignedIn(data) {
    let { user, organization, hub } = data;
    if (user) {
      Visitor.set(user);
    }
    if (organization) {
      Organization.set(organization);
    }
    if (hub) {
      Host.set(hub);
    }

    wsRouter.restart(1);
    Drumee.start();
    setTimeout(() => {
      if (typeof Wm === 'undefined') location.reload();
    }, 1500);
  }

  /**
   * Host-driven OTP resend, delegated from the dtk_otp widget via its
   * `resendService`. The widget itself only fires the service (it does no
   * network work when `resendService` is set), so we own the request here —
   * which lets us show a loading state on the card while otp.send is in
   * flight. On success we swap in the fresh secret and clear the digit boxes
   * for re-entry; on failure we surface the error in the widget's tips line.
   */
  _resendSigninOtp() {
    const otp = this._otp;
    if (!otp || this._resending) return;
    this._resending = true;
    // The router skin renders a spinner on the resend link while this is set.
    if (otp.el) otp.el.dataset.resending = '1';

    const payload = otp.mget('payload') || {};
    const method = payload.method || 'otp';
    // Defense in depth: the post-login payload now carries the email (set by
    // the signin form), but fall back to Visitor so resend can never silently
    // fire with an empty email — the failure that made it "work only after a
    // page refresh".
    const email = payload.email || (Visitor.profile() || {}).email || Visitor.get('email');
    const api = otp.mget('resendApi') || SERVICE.otp.send;
    // otp.send verifies the caller's websocket in the pre-auth signin context
    // (same as otp.send_link in the form). Without socket_id the server rejects
    // the resend with INVALID_SOCKET.
    const vars = { email, method, socket_id: Visitor.get(_a.socket_id) };
    this.postService(api, vars).then((data) => {
      // The server returns errors in-band (e.g. INVALID_SOCKET) rather than
      // rejecting — surface them instead of falsely reporting "code resent".
      if (!data || data.error) {
        if (typeof otp.displayMessage === 'function') {
          otp.displayMessage(LOCALE.UNKNOWN_ERROR, 1);
        }
        return;
      }
      // Merge (not replace) so id/uid/method survive; overlay the new secret.
      otp.mset({ payload: { ...payload, ...data } });
      // Wipe the boxes so checkForm doesn't immediately resubmit the old code.
      otp.ensurePart('digits').then((p) => {
        const boxes = p.children.toArray();
        for (const c of boxes) {
          if (typeof c.setValue === 'function') c.setValue('');
        }
        if (boxes[0] && typeof boxes[0].focus === 'function') boxes[0].focus();
      });
      if (typeof otp.displayMessage === 'function') {
        const msg = LOCALE.NEW_CODE_RESENT ||
          "We have sent a new code to {0}".format(email);
        otp.displayMessage(msg);
      }
    }).catch((e) => {
      this.warn("Resend signin OTP failed", e);
      if (typeof otp.displayMessage === 'function') {
        otp.displayMessage(LOCALE.UNKNOWN_ERROR, 1);
      }
    }).finally(() => {
      this._resending = false;
      if (otp.el) otp.el.dataset.resending = '0';
    });
  }

  /**
   * Wrap the dtk_otp instance's verify POST so the code-check round-trip shows a
   * spinner and locks input — the signin OTP screen otherwise gives no feedback
   * while yp.login_top is in flight. Mirrors the otp-gate widget's submit
   * spinner. The widget self-POSTs to its `api`; resend POSTs elsewhere and
   * keeps its own [data-resending] state, so only `api` is gated. The router
   * skin renders the loader on [data-submitting="1"]. Idempotent and
   * best-effort: if the instance has no postService the screen simply runs
   * without a submit spinner.
   * @param {LetcBox} otp  the dtk_otp instance (this._otp)
   */
  _attachOtpSubmitSpinner(otp) {
    if (!otp || otp._signinSubmitWrapped || typeof otp.postService !== 'function') return;
    const api = otp.mget('api');
    if (!api) return;
    otp._signinSubmitWrapped = true;
    const post = otp.postService.bind(otp);
    otp.postService = function (service, ...rest) {
      // Resend (and any non-verify POST) keeps the stock behaviour.
      if (service !== api) return post(service, ...rest);
      if (this.el) this.el.dataset.submitting = '1';
      let p;
      try {
        p = post(service, ...rest);
      } catch (e) {
        if (this.el) this.el.dataset.submitting = '0';
        throw e;
      }
      return Promise.resolve(p).finally(() => {
        // On success the screen swaps out; on a rejected code dtk_otp clears the
        // boxes for re-entry — either way the inputs unlock here.
        if (this.el) this.el.dataset.submitting = '0';
      });
    };
  }

  /**
   * Abandon a pending OAuth 2FA sign-in and return to the sign-in form — the
   * "Back to sign in" action on the OTP screen.
   *
   * After an OAuth (Google/Apple) sign-in by a 2FA user, loby leaves an
   * `otp_pending` cookie and bounces the browser to the OTP screen. Until that
   * cookie is cleared the signin page keeps landing on the OTP screen, so a
   * soft view-swap (or a plain reload) gets bounced straight back. session
   * logout can't clear it either: session_logout matches the cookie by uid,
   * which a not-yet-authenticated pending session doesn't have. We therefore
   * call oauth.cancel_otp, which deletes the pending cookie by session id, then
   * set a clean hash and synchronously reload so the page boots on a fresh
   * sign-in form at a clean #/welcome/signin URL (no oauth_mfa/email left
   * behind). Best-effort: regular (non-OAuth) 2FA has no pending cookie, so the
   * call is a harmless no-op there.
   */
  _backToSignin() {
    const goSignin = () => {
      location.hash = '#/welcome/signin';
      location.reload();
    };
    const cancel = SERVICE.oauth && SERVICE.oauth.cancel_otp;
    if (!cancel) return goSignin();
    this.postService(cancel, {}, { async: 1 })
      .then(goSignin)
      .catch((e) => {
        this.warn('back-to-signin: cancel OTP failed', e);
        goSignin();
      });
  }

  /**
   * Mount the OTP screen inside a single bordered, rounded card that wraps BOTH
   * the dtk_otp widget and (for 2FA sign-in screens) the "← Back to sign in"
   * link. The card is the only child of the router root, so the router skin can
   * center it on the gradient page background. The back link lives inside the
   * card — alongside, but outside, the dtk_otp widget — and bubbles the
   * `back-to-signin` service handled in onUiEvent.
   *
   * @param {object} opt  dtk_otp options (payload/api/title/message/…); `kind`
   *                      is supplied here.
   * @param {boolean} withBack  append the back-to-sign-in link (2FA screens).
   * @returns {Promise<LetcBox>} the dtk_otp instance.
   */
  async _mountOtp(opt, withBack = false) {
    const fig = this.fig.family;
    await Kind.waitFor('dtk_otp');
    this.feed(Skeletons.Box.Y({
      className: `${fig}__card`,
      sys_pn: 'card',
      partHandler: [this],
      kids: [],
    }));
    const card = await this.ensurePart('card');
    // The OTP widget now sits inside the card (not directly under the router),
    // so route its services (otp-signined, resend-signin-otp, …) to the router
    // explicitly rather than relying on the immediate-parent handler chain.
    card.feed({ kind: 'dtk_otp', uiHandler: [this], ...opt });
    this._otp = card.children.last();
    this._attachOtpSubmitSpinner(this._otp);
    if (withBack) {
      card.append(
        Skeletons.Box.X({
          className: `${fig}__backlink-row`,
          kids: [
            Skeletons.Note({
              className: `${fig}__backlink`,
              content: LOCALE.BACK_TO_SIGN_IN,
              service: 'back-to-signin',
              uiHandler: [this],
            }),
          ],
        })
      );
    }
    return this._otp;
  }

  /**
   *
   * @param {*} cmd
   * @param {*} args
   */
  async onUiEvent(cmd, args = {}) {
    const service = args.service || cmd.get(_a.service);
    this.debug("AAA:97", cmd, service, args, this)
    let buttons;
    let { error, data } = args;
    switch (service) {
      case "password-set":
        if (!error) {
          this.gotSignedIn(data)
        } else {
          this.cmd((error.message || LOCALE.UNKNOWN_ERROR), _a.error);
        }
        break;
      case "onboarding":
        let kind = "onboarding";
        let name = "onboarding";
        setTimeout(() => {
          location.reload()
        }, 1000)
        // Kind.loadPlugin({ name, kind }).then((widget) => {
        //   if (!widget) {
        //     return location.reload()
        //   }
        //   Kind.waitFor(kind).then((k) => {
        //     this.feed({ ...args, kind, type: "app", service: "onboarding-complete" })
        //   })
        // }).catch((e) => {
        //   this.warn(`Failed to load onboarding plugin`, e)
        //   location.reload()
        // })
        // location.reload() // TMP FIX
        break;

      case 'onboarding-complete':
        buttons = [
          button(this, {
            label: LOCALE.GO_TO_DRUMEEOS,
            service: 'login',
            ico: "arrow-right",
            type: _a.row,
            priority: "primary"
          }),
        ]
        this.feed({ buttons, kind: 'dtk_dialog', title: LOCALE.SIGNUP_COMPLETED, message: LOCALE.DRUMEEOS_IS_NOW_READY })
        break;

      case 'login':
        return location.reload();

      case 'otp-failed':
        return this._mountOtp({ api: SERVICE.otp.verify, service: 'otp-verified' });

      case 'otp-verified':
        if (!data || !data.secret) {
          return
        }
        this.feed({
          kind: 'dtk_dialog',
          body: {
            kind: 'dtk_pwsetter',
            sys_pn: 'pwsetter',
            uiHandler: [this],
            label: LOCALE.RESET_PASSWORD,
            api: SERVICE.otp.set_password,
            payload: data,
            service: 'password-set'
          },
          message: '',
          title: LOCALE.SET_NEW_PASSWORD,
        });
        return
      case 'verify-signin-otp':
        if (!data || !data.secret) {
          return
        }
        await this._mountOtp({
          payload: { id: data.id, uid: data.id, email: data.email, method: "otp", secret: data.secret },
          api: SERVICE.yp.login_top,
          title: "Multi factor athentication",
          message: "We have sent a code to {0} validate you connection".format(args.data.email),
          resendService: 'resend-signin-otp',
          service: 'otp-signined'
        }, true);
        return
      case 'resend-signin-otp':
        this._resendSigninOtp();
        return;

      case 'otp-signined':
        location.reload();
        return;

      case 'new-code':
        if (data.secret) Visitor.set({
          ...data,
          otp_key: data.secret,
        });
        return;
      case 'otp-sent':
        await this._mountOtp({
          payload: args.data,
          api: SERVICE.otp.verify,
          title: LOCALE.Q_FORGOT_PASSWORD,
          message: LOCALE.WE_HAVE_SENT_CODE.format(args.data.email),
          service: 'otp-verified'
        });
        return

      case _a.error:
        buttons = [
          button(this, {
            label: LOCALE.BACK,
            service: _a.home,
            ico: "arrow-right",
            type: _a.row,
            priority: "secondary"
          }),
        ]
        this.feed({ message: args.message, buttons, kind: 'dtk_dialog', service: _a.home, title: "Ooop!" })
        break;

      case 'back-to-signin':
        this._backToSignin();
        return;
      case _a.home:
        this.feed({ kind: 'signin_form' });
        break;
    }
  }
}

module.exports = signin_router
