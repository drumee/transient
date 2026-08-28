
require('./skin');
const { dtk_common } = require("..")
export default class dtk_otp extends dtk_common {

  /**
   ** @param {object} opt
  */
  initialize(opt = {}) {
    super.initialize(opt);
    this._len = this.mget('length') || 6;
    this._charset = this.mget('charset') || 'numeric';
    this._charRe = this._charset === 'alphanumeric' ? /^[0-9a-zA-Z]$/ : /^[0-9]$/;
    this.declareHandlers();
    // onlyKeyboard:1 stops the framework from binding the widget root's
    // onclick (see letc.js __handleClick), which would otherwise dispatch
    // this widget's `service` (the host's successService) on ANY click in
    // the card's empty space — prematurely "submitting". Submission must
    // happen only via checkForm() once every box is filled. Child views
    // (digits, resend link, close button) keep their own click handlers.
    this.mset({ flow: _a.y, onlyKeyboard: 1 })
  }

  /**
   * Single source of truth for which characters a box accepts.
   * @param {string} ch
   * @returns {boolean}
   */
  _validChar(ch) {
    return _.isString(ch) && this._charRe.test(ch);
  }

  /**
   * Resolve the raw DOM <input> for an Entry box, tolerating either a
   * jQuery-wrapped (`_input[0]`) or a raw-DOM (`_input`) representation.
   * @param {object} c entry box widget
   * @returns {HTMLInputElement|undefined}
   */
  _inputEl(c) {
    return (c && c._input && c._input[0]) || (c && c._input);
  }

  /**
   * Focus (and select) the box at `idx` if it exists.
   * @param {Array} boxes
   * @param {number} idx
   */
  _focusBox(boxes, idx) {
    const box = boxes[idx];
    if (!box) return;
    box.focus();
    if (_.isFunction(box.select)) box.select();
  }

  /**
   * Bind OTP keydown + paste directly on each box's DOM <input>. Both
   * listeners attach in the SAME readiness callback so paste can never lose a
   * race against keydown: previously two separate `once("input:ready")` passes
   * (bindKeyEvents before bindPasteEvent) meant a box could fire input:ready
   * between them, leaving paste unbound while keydown still worked — the
   * "2FA modal won't paste" symptom. Also binds immediately when the box is
   * already ready, since `once` would otherwise miss an already-fired event.
   */
  bindBoxEvents() {
    this.ensurePart("digits").then(async (p) => {
      await Kind.waitFor('entry');
      const boxes = p.children.toArray();
      const attach = (c) => {
        const el = this._inputEl(c);
        if (!el) return;
        el.addEventListener('keydown', (e) => this._onDigitKeydown(e, c, p));
        el.addEventListener('paste', (e) => {
          e.preventDefault();
          const cb = e.clipboardData || window.clipboardData;
          const text = (cb && cb.getData ? cb.getData('text') : '') || '';
          const chars = text.split('').filter((ch) => this._validChar(ch));
          if (!chars.length) return;
          const start = c.getIndex();
          let last = start;
          for (let k = 0; k < chars.length; k++) {
            const box = boxes[start + k];
            if (!box) break;
            box.setValue(chars[k]);
            last = start + k;
          }
          this._focusBox(boxes, last);
          this.checkForm();
        });
      };
      for (let c of boxes) {
        if (typeof c.isReaddy === 'function' && c.isReaddy()) attach(c);
        else c.once("input:ready", () => attach(c));
      }
    })
  }

  /**
   * @param {KeyboardEvent} e
   * @param {object} c the box that received the event
   * @param {object} p the digits container part
   */
  _onDigitKeydown(e, c, p) {
    const key = e.key;
    const boxes = p.children.toArray();
    const i = c.getIndex();

    // Let the browser handle normal tab order.
    if (key === 'Tab') return;

    if (key === 'ArrowLeft') {
      e.preventDefault();
      return this._focusBox(boxes, i - 1);
    }
    if (key === 'ArrowRight') {
      e.preventDefault();
      return this._focusBox(boxes, i + 1);
    }

    if (key === 'Backspace') {
      e.preventDefault();
      if (c.getValue()) {
        c.setValue('');
      } else {
        const prev = boxes[i - 1];
        if (prev) { prev.setValue(''); prev.focus(); }
      }
      return;
    }

    if (key === 'Delete') {
      e.preventDefault();
      c.setValue('');
      return;
    }

    // Non-printable keys (Shift, Arrow*, Home, ...) report key.length > 1: ignore.
    if (key == null || key.length !== 1) return;

    // Let shortcut combos through (copy/paste/select-all).
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Printable character: we own insertion to enforce exactly one char per box.
    e.preventDefault();
    if (!this._validChar(key)) return;
    // Retyping after a rejected code clears the stale error message.
    this.clearMessage();
    c.setValue(key);
    const next = boxes[i + 1];
    if (next) { next.focus(); if (_.isFunction(next.select)) next.select(); }
    this.checkForm();
  }

  /**
   * Show a transient note below the inputs (in the `tips` row). Non-error
   * notes auto-clear after 3s; pass persist=1 to keep an error visible until
   * the user retries (see clearMessage in _onDigitKeydown).
   * @param {string} msg
   * @param {number} error  1 = error styling
   * @param {number} persist 1 = do not auto-clear
   */
  displayMessage(msg, error = 0, persist = 0) {
    if (!this.__tipsText) return;
    if (this._msgTimer) { clearTimeout(this._msgTimer); this._msgTimer = null; }
    this.__tipsText.set({ content: msg });
    this.__tipsText.el.dataset.error = error;
    if (persist) return;
    this._msgTimer = setTimeout(() => {
      if (!this.__tipsText) return;
      this.__tipsText.set({ content: '' });
      this.__tipsText.el.dataset.error = 0;
    }, 3000)
  }

  /**
   * Clear any message currently shown below the inputs.
   */
  clearMessage() {
    if (this._msgTimer) { clearTimeout(this._msgTimer); this._msgTimer = null; }
    if (!this.__tipsText) return;
    this.__tipsText.set({ content: '' });
    this.__tipsText.el.dataset.error = 0;
  }

  /**
   * True when the verify response indicates a bad/expired code. Tolerates the
   * different shapes the server uses: `{error:1}`, `{error:"INVALID_CODE"}`,
   * `{status:"wrong-code"}`, a non-200 throw, or a null/empty body.
   * @param {*} data
   * @returns {boolean}
   */
  _isErrorResponse(data) {
    if (!data) return true;
    if (data.error) return true;
    const errStatus = ['wrong-code', 'no-user', 'no-socket', 'expired', 'invalid', 'INVALID_CODE', 'INVALID_SECRET'];
    if (data.status && errStatus.includes(data.status)) return true;
    return false;
  }

  /**
   * Handle a rejected code: show the error BELOW the inputs, clear the boxes
   * for re-entry, and focus the first one. Crucially we do NOT trigger the
   * host success service (which would navigate) and do NOT rethrow (which
   * could bubble to a global handler and reload the page).
   * @param {Array} boxes
   * @param {*} data
   */
  _onInvalidCode(boxes, data) {
    let msg = LOCALE.INVALID_CODE;
    const err = data && data.error;
    if (_.isString(err) && LOCALE[err]) msg = LOCALE[err];
    this.displayMessage(msg, 1, 1);
    for (let c of boxes) c.setValue('');
    this._focusBox(boxes, 0);
  }

  /**
   * Auto-submit once every box holds a valid character. On an invalid code
   * the error is shown in place and the page is never navigated/reloaded.
   */
  checkForm() {
    this.ensurePart("digits").then((p) => {
      const boxes = p.children.toArray();
      let res = [];
      for (let c of boxes) {
        let v = c.getValue()
        if (this._validChar(v)) {
          res.push(v)
        }
      }
      if (res.length < this._len) return;
      const api = this.mget(_a.api)
      if (!api) return;
      const payload = this.mget('payload')
      return this.postService(api, { ...payload, code: res.join('') }, { async: 1 }).then((data) => {
        if (this._isErrorResponse(data)) {
          return this._onInvalidCode(boxes, data);
        }
        let service = this.mget(_a.service) || 'otp-verified';
        this.triggerHandlers({ data, service })
      }).catch((e) => {
        this.warn("[checkForm] OTP verify error", e)
        this._onInvalidCode(boxes, e)
      })
    })
  }

  /**
   *
  */
  onDomRefresh() {
    this.feed(require("./skeleton").default(this));
    this.bindBoxEvents();
  }


  /**
   * @param {LetcBox} cmd
   * @param {any} args
  */
  onUiEvent(cmd, args = {}) {
    const service = args.service || cmd.get(_a.service);
    let { email, method } = this.mget('payload') || {}
    switch (service) {
      case _a.input:
        // Navigation/entry is handled in _onDigitKeydown; just re-check completion.
        this.checkForm();
        break;
      case "resend-code":
        // Host-driven resend: when `resendService` is configured the widget
        // delegates resending to the host (e.g. the reconnect flow re-runs
        // yp.login) instead of POSTing otp.send itself.
        const resendService = this.mget('resendService');
        if (resendService) {
          return this.triggerHandlers({ service: resendService });
        }
        let api = this.mget('resendApi') ||  SERVICE.otp.send
        this.postService(api, { email, method }).then((data) => {
          this.mset({ payload: data })
          this.displayMessage(LOCALE.NEW_CODE_RESENT)
          this.triggerHandlers({ service: "new-code", data })
          // Wipe the previous digits so the user can type the new
          // code into empty cells (otherwise checkForm would
          // re-submit the stale code immediately).
          this.ensurePart("digits").then((p) => {
            for (let c of p.children.toArray()) {
              if (typeof c.setValue === 'function') c.setValue('');
            }
            const first = p.children._views && p.children._views[0];
            const input = first && first._input && first._input[0];
            if (input && typeof input.focus === 'function') input.focus();
          });
        }).catch((e) => {
          this.displayMessage(LOCALE.UNKNOWN_ERROR, 1)
          this.warn("AAA:104 Error sending OTP", e)
        })
        break;
      default:
        // Swallow stray clicks. A click on the card's empty space
        // (dtk-otp__main, header, message, gaps between digits) has no
        // `service`, but the framework still routes it here because this
        // widget is registered as an ancestor ui-handler. Re-dispatching a
        // serviceless event makes the host read THIS widget's own `service`
        // (the host's successService) and submit prematurely. Only forward
        // genuinely-named services; success is dispatched solely by
        // checkForm() once every box is filled.
        if (service) {
          this.triggerHandlers({ ...args, service })
        }
        break;
    }
  }


}
