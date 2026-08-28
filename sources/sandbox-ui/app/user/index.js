/* ==================================================================== *
*   Copyright xialia.com  2011-2021
* ==================================================================== */

const { toDataURL } = require("qrcode");

class ___sandbox_user extends LetcBox {

  /**
   * 
   */
  initialize(opt = {}) {
    require('./skin');
    super.initialize(opt);
    this.declareHandlers();
    const { token, domain, uid } = opt;
    this.debug("AAAA:17", opt)
    let { svc } = bootstrap();
    const url = `https://${domain}${svc}sandbox.load?token=${token}&keysel=${uid}`;
    this.mset({ url })

  }

  /**
 * 
 * @param {*} text 
 */
  showQrCode(text = "") {
    const id = `canvas-${this.mget(_a.widgetId)}`;
    let i = setInterval(async () => {
      let canvas = document.getElementById(id);
      if (canvas) {
        clearInterval(i);
        let src = await toDataURL(text);
        canvas.width = 70;
        canvas.height = 70;
        canvas.src = src;
      }
    }, 300);
  }

  /**
   * 
   */
  openLink(url) {
    if (Visitor.device() == _a.mobile) {
      window.open(url, "_blank", "noopener; noreferrer");
    } else {
      let w = Math.min(900, screen.availWidth - 100);
      let h = Math.min(700, screen.availHeight - 100);
      let x = 0;
      let y = 0;
      switch (this.getIndex()) {
        case 1:
          x = screen.availWidth - w;
          break;
        case 2:
          y = screen.availHeight - h;
          break;
        case 3:
          x = screen.availWidth - w;
          y = screen.availHeight - h;
          break;

      }
      window.open(url, "_blank", `popup, noopener, noreferrer, width=${w}, height=${h}, left=${x}, top=${y}`);
    }
  }

  /**
 * Upon DOM refresh, after element actually insterted into DOM
 */
  onDomRefresh() {
    this.feed(require('./skeleton')(this));
  }

  /**
   * 
   * @param {*} child 
   * @param {*} pn 
   */
  onPartReady(child, pn) {
    switch (pn) {
      case 'qr-code':
        let url = this.mget(_a.url);
        toDataURL(url).then((src) => {
          child.el.src = src;
        })
        break;
    }
  }

  /**
   * 
   * @param {*} service 
   * @param {*} data 
   * @param {*} options 
   */
  onWsMessage(service, data, options = {}) {
    this.debug("onWsMessage ", service, data, options, this);
  }

  /**
 * User Interaction Evant Handler
 * @param {View} cmd
 * @param {Object} args
 */
  onUiEvent(cmd, args = {}) {
    const service = args.service || cmd.get(_a.service);
    this.debug("onUiEvent ", service, this, args, cmd);
    let url = this.mget(_a.url);

    switch (service) {
      case _a.copy:
      case 'show-qr-code':
        this.triggerHandlers({ service, url, src: cmd });
        this.triggerHandlers({ service: "trial-started" });
        break;
      default:
        this.openLink(url)
        this.triggerHandlers({ service: "trial-started" });
    }
    //return Desk.acknowledge(LOCALE.ACK_COPY_LINK);
  }



}

module.exports = ___sandbox_user