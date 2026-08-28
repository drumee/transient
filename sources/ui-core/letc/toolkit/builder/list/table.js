
const __builder = require("../../core");
class __table extends __builder {

  render() {
    const { vendorOpt } = this.props || {}
    const _default = require("./options");
    return {
      ...super.render(), 
      vendorOpt: {..._default(), vendorOpt},
      kind: "list_table",
    };
  }
}

module.exports = __table;