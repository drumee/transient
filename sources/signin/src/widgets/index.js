
/**
 * Common class
 */
class signup_common extends LetcBox {

  /**
   * 
   */
  setItemState(pn, s = 0) {
    this.ensurePart(pn).then((p) => { setTimeout(() => { p.setState(s) }, 100) })
  }

  /**
   * 
   */
  setItemStatus(pn, s = 0, attr = _a.status) {
    this.ensurePart(pn).then((p) => { setTimeout(() => { p.el.dataset[attr] = s }, 100) })
  }


  /**
   * 
   * @param {*} xhr 
   */
  onServerComplain(xhr) {
    this.warn(xhr)
  }
}

module.exports = signup_common
