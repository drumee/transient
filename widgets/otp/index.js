
require('./skin');
const { dtk_common } = require("..")
export default class dtk_otp extends dtk_common {

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
  bindPasteEvent() {
    this.ensurePart("digits").then(async (p) => {
      await Kind.waitFor('entry');
      for (let c of p.children.toArray()) {
        c.once("input:ready", () => {
          c._input[0].onpaste = (e) => {
            setTimeout(() => {
              let value = c.getValue() || '';
              if (!/[0-9]{1,6}/.test(value)) {
                c.setValue("")
                return
              }
              let digits = value.split('');
              let i = c.getIndex();
              for (let d of digits) {
                if (!p.children._views[i]) continue;
                p.children._views[i].setValue(d);
                i++;
              }
              this.checkForm()
            }, 300)
          }
        })
      }
    })
  }

  /**
   * 
   * @param {*} msg 
   */
  displayMessage(msg, error = 0) {
    this.__tipsText.set({ content: msg });
    this.__tipsText.el.dataset.error = error;
    setTimeout(() => {
      this.__tipsText.set({ content: '' });
      this.__tipsText.el.dataset.error = error;
    }, 3000)
  }

  /**
   * 
   */
  checkForm() {
    this.ensurePart("digits").then((p) => {
      let res = [];
      for (let c of p.children.toArray()) {
        let v = c.getValue()
        if (/[0-9]/.test(v)) {
          res.push(v)
        }
      }
      let api = this.mget(_a.api)
      let payload = this.mget('payload')
      if (res.length >= 6) {
        if (api) {
          return this.postService(api, { ...payload, code: res.join('') }, { async: 1 }).then((data) => {
            if (data.error) {
              return this.displayMessage(LOCALE.INVALID_CODE, 1)
            }
            let service = this.mget(_a.service) || 'otp-verified';
            this.triggerHandlers({ data, service })
          }).catch((e) => {
            this.warn("[checkForm] OTP verify error", e)
            this.displayMessage(LOCALE.INVALID_CODE, 1)
          })
        }
      }
    })
  }

  /**
   *
  */
  onDomRefresh() {
    this.feed(require("./skeleton").default(this));
    this.bindPasteEvent();
  }


  /**
   * @param {LetcBox} cmd
   * @param {any} args
  */
  onUiEvent(cmd, args = {}) {
    const service = args.service || cmd.get(_a.service);
    let status = cmd.status;
    let { email, method } = this.mget('payload') || {}
    switch (service) {
      case _a.input:
        cmd.focus();
        if (status == _e.click) {
          cmd.setValue('');
          return;
        }
        let res = [];
        this.ensurePart("digits").then((p) => {
          let i = cmd.getIndex() + 1;
          let value = cmd.getValue();
          for (let c of p.children.toArray()) {
            if (c.getIndex() < i) {
              continue;
            } else {
              if (/[0-9]/.test(value) && /[0-9]/.test(status)) {
                c.focus();
                c.setValue('')
              } else {
                cmd.setValue('');
              }
              break;
            }
          }
          this.checkForm()
        })
        break;
      case "resend-code":
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
        this.triggerHandlers({ ...args, service })
    }
  }


}
