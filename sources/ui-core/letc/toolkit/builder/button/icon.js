const __builder = require("../../builder");

class __icon extends __builder {
  constructor(p, s) {
    super(p, s);
    const def_style = {
      width: '40px',
      height: '40px',
      padding: '10px',
    };
    this.props = p || {};
    this.style = s || def_style;
    this.props.chartId = this.props.ico;
    delete this.props.ico;
  }
}

module.exports = __icon;