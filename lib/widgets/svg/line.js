
/**
 * 
 * @param {*} id 
 * @returns 
 */
const _wrapper = function (id) {
  return `<div id="${id}" style="position:absolute;" class="svg-wrapper"></div>`;
};

const _defauldClass = "svg-line";
const { LetcBox } = require("..");

class __svg_line extends LetcBox {
  constructor(...args) {
    super(...args);
    this._generate = this._generate.bind(this);
    this.onDomRefresh = this.onDomRefresh.bind(this);
    this.update = this.update.bind(this);
    this._shouldUpdate = this._shouldUpdate.bind(this);
  }

  static initClass() {
    this.prototype.className = _defauldClass;
  }

  /**
   * 
   */
  initialize(opt) {
    this._id = _.uniqueId();
    super.initialize(opt);
    this.model.set({
      widgetId: this._id
    });
    this.model.atLeast({
      innerClass: 'svg-path'
    });
    return this.vector = new Backbone.Model(this.model.get('vectorOpt'));
  }


  /**
   * 
   * @param {*} size 
   * @returns 
   */
  _generate(size) {
    if ((size == null)) {
      return;
    }
    const h = require('virtual-hyperscript-svg');
    const opt = this.vector.toJSON();
    opt.x1 = "0";
    opt.y1 = Math.round(size.height / 2);
    opt.x2 = size.width;
    opt.y2 = opt.y1;
    opt['stroke-width'] = size.height;
    const a = h('svg', {
      viewBox: `0 0 ${size.width} ${size.height}`,
      width: size.width,
      height: size.height,
      class: this.model.get(_a.innerClass)// + " full"
    }, [
      h('line', opt)
    ]);
    return require('vdom-to-html')(a);
  }

  /**
   * 
   * @returns 
   */
  onDomRefresh() {
    this.$el.addClass(_a.widget);
    this.$el.append(_wrapper(this._id));
    this.model.on(_e.change, this._shouldUpdate);
    this._wrapper = this.$el.find(`#${this._id}`);
    const f = () => {
      const size = {
        width: this.el.innerWidth() || parseInt(this.style.get(_a.width)) || 100,
        height: this.el.innerHeight() || parseInt(this.style.get(_a.height)) || 100
      };
      return this._wrapper.append(this._generate(size));
    };
    return this.waitElement(this._wrapper[0], f);
  }

  /**
   * 
   * @param {*} size 
   * @returns 
   */
  update(size) {
    return this._wrapper[0].innerHTML = this._generate(size);
  }
  //return null

  /**
   * 
   * @param {*} m 
   * @returns 
   */
  _shouldUpdate(m) {
    if (m.changed.percent) {
      return this._wrapper[0].innerHTML = this._generate();
    }
  }
}
__svg_line.initClass();

module.exports = __svg_line;
