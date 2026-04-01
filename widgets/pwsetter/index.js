

require('./skin');

export default class dtk_pwsetter extends LetcBox {

  /**
   ** @param {object} opt
  */
  initialize(opt = {}) {
    super.initialize(opt);
    this.declareHandlers();
    this.mset({ flow: _a.y })
  }

  /**
   *
  */
  onDomRefresh() {
    this.feed(require('./skeleton').default(this));
  }

  /**
   * 
   */
  check() {
    let { password, password2 } = this.getData()
    password = password || '';
    password2 = password2 || '';
    let rate = 100 * (password.length / 20) + 5;
    if (rate > 100) rate = 100;
    this.__strengthGrade.el.style.width = `${rate}%`;
    let min = 6;
    this._isValid = 0;
    if (password.length < min) {
      this.__strengthState.set({ content: LOCALE.WEAK })
      this.__strengthGrade.el.dataset.strenght = "0";
      this.__messageText.set({ content: LOCALE.PASSWORD_AT_LEAST.format(min) });
      this.__messageText.el.dataset.status = "error";
    } else if (password.length <= 10) {
      this.__strengthState.set({ content: LOCALE.STRONG })
      this.__strengthGrade.el.dataset.strenght = "1";
      this.__messageText.set({ content: "" })
      this._isValid = 1;
      this.__messageText.el.dataset.status = "normal";
    } else {
      this.__strengthGrade.el.dataset.strenght = "2";
      this.__strengthState.set({ content: LOCALE.VERY_STRONG })
      this.__messageText.set({ content: "" });
      this._isValid = 1;
      this.__messageText.el.dataset.status = "normal";
    }
    if (!password2 || password != password2) {
      this._isValid = 0;
    }
    this.__topic.set({ content: LOCALE.PASSWORD_STRENGTH })
    if (this._isValid) {
      this.__messageIcon.el.dataset.state = "1";
      this.__messageText.set({ content: LOCALE.PASSWORD_MATCH })
      if (this.__commitButton) this.__commitButton.el.dataset.state = "1";
    } else {
      this.__messageIcon.el.dataset.state = "0";
      if (this.__commitButton) this.__commitButton.el.dataset.state = "0";
    }
  }

  /**
   * 
   * @returns 
   */
  isValid() {
    return this._isValid
  }

  /**
   * 
   * @param {*} pw 
   */
  message(content, status = "normal") {
    this.__messageText.set({ content })
    this.__messageText.el.dataset.status = status;
    if (status !== "normal") {
      this.__messageIcon.el.dataset.state = "0";
    }
  }

  /**
   * @param {LetcBox} cmd
   * @param {any} args
  */
  onUiEvent(cmd, args = {}) {
    const service = args.service || cmd.mget(_a.service);
    switch (service) {
      case 'password-input':
        this.check()
        if (cmd.status == _e.commit) {
          let service = this.mget(_a.service) || _e.commit;
          this.triggerHandlers({ service })
        } else {
          this.triggerHandlers({ service })
        }
        break;
      case _e.commit:
        let { api, payload } = this.model.toJSON();
        if (api) {
          payload = { ...payload, ...this.getData() };
          this.postService(api, { ...payload }).then((data) => {
            this.triggerHandlers({ data })
          }).catch((error) => {
            this.triggerHandlers({ error })
          })
          return
        }
        break;
      default:
        this.triggerHandlers({ service })
    }
  }

}
