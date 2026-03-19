

/**
 * 
 * @param {*} id 
 * @returns 
 */
function _wrapper(id){
  return `<div id=\"${id}\" style=\"position:absolute;\" class=\"svg-wrapper\"></div>`;
};

const LetcBox = require('../box');
class __svg_line extends LetcBox {
  constructor(...args) {
    super(...args);
    this._generate = this._generate.bind(this);
    this.onDomRefresh = this.onDomRefresh.bind(this);
    this.update = this.update.bind(this);
    this._shouldUpdate = this._shouldUpdate.bind(this);
  }


  /**
   * 
   */
  initialize(opt) {
    this._id = _.uniqueId();
    super.initialize(opt);
    this.model.set({
      widgetId : this._id});
    this.model.atLeast({ 
      innerClass : 'svg-path'});
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
    opt.y1 = Math.round(size.height/2);
    opt.x2 = size.width;
    opt.y2 = opt.y1;
    opt['stroke-width'] = size.height;
    //_.merge opt, {x1 : "0", y1 : "0", x2 : size.width, y2 : 0}
    const a = h('svg', {
      viewBox : `0 0 ${size.width} ${size.height}`,
      width  : size.width,
      height : size.height,
      class  : this.model.get(_a.innerClass)// + " full"
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
    const f = ()=> {
      this.debug("SVG  ZZZ 5555", this);
      const size = {  
        width  : this.el.innerWidth()  || parseInt(this.style.get(_a.width))  || 100,
        height : this.el.innerHeight() || parseInt(this.style.get(_a.height)) || 100
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
    this._wrapper[0].innerHTML = this._generate(size);
  }

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

module.exports = __svg_line;
