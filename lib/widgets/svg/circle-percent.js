
const _path = function(path_id, stroke_array, stroke, moreClass, stroke_offset){
  if (moreClass == null) { moreClass = ''; }
  const r = { 
    id : path_id,
    class : `gc-arc ${moreClass}`,
    'stroke-dasharray': stroke_array,
    'stroke-dashoffset': stroke_offset,
    stroke,
    d : `M18 4 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831` 
  };
  return r;
};

const { LetcBox } = require("..");
/**
 * 
 */
class __circle_percent extends LetcBox {
  constructor(...args) {
    super(...args);
    this._draw = this._draw.bind(this);
    this.onDomRefresh = this.onDomRefresh.bind(this);
    this.onPartReady = this.onPartReady.bind(this);
    this.update = this.update.bind(this);
    this._shouldUpdate = this._shouldUpdate.bind(this);
  }

  static initClass() {
    this.prototype.templateName = _T.wrapper.raw;
  }

  /**
   * 
   * @param {*} opt 
   * @returns 
   */
  initialize(opt) {
    this._id = _.uniqueId();
    super.initialize(opt);
    this.model.set({
      widgetId : this._id
    });
    this.model.atLeast({ 
      gradient        : [['#dde2e8', '#879cff'],["#fa8540", "#e7c1ad"]],   
      percent         : 50,
      percentSecond   : 0.000955259,
      cursor          : "#fa8540",
      innerClass      : 'circular-chart circular-chart--small'
    });
  }
    
  /**
   * 
   * @returns 
   */
  _draw() {
    let end_path, line, line2;
    const grd = this.model.get(_a.gradient);
    const h = require('virtual-hyperscript-svg');
    const pc = this.model.get(_a.percent);
    let pcs = this.model.get('percentSecond');
    if (pcs < 3) {
      pcs = 1;
      end_path = '';
    } else { 
      end_path = h('path', _path(`second-end-${this._id}`, "1, 100", this.model.get('cursor'), "gc-end", ((pc + pcs) - 1) * (-1)));    
    }
    const rotate = 3.6 * (pc + pcs);

    const radius = 16; 
    const lineX = radius * Math.sin((rotate * Math.PI)/180.0);
    const lineY = radius * Math.cos((rotate * Math.PI)/180.0);
    
    if (rotate < 180) {
      line = h('line', {
        x1: 22 + lineX,
        y1: 20 - lineY,
        x2: 50,
        y2: 20,
        class: 'chart-line'
      });
      line2 = h('line', {
        x1: 50,
        y1: 20,
        x2: 56, 
        y2: 20,
        class: 'chart-line'
      });
    } else { 
      line = h('line', {
        x1: 14 + lineX,
        y1: 20 - lineY,
        x2: -14, 
        y2: 20,
        class: 'chart-line'
      });
      line2 = h('line', {
        x1: -14,
        y1: 20,
        x2: -20, 
        y2: 20,
        class: 'chart-line'
      });
    }
      
    const lg1 = h('linearGradient', {
      id : `lg1-${this._id}`
    }, [
      h('stop', { offset: '0%', 'stop-color': grd[0][0] }),
      h('stop', { offset: '100%', 'stop-color': grd[0][1] })
    ]);
    const lg2 = h('linearGradient', {
      id : `lg2-${this._id}`
    }, [
      h('stop', { offset: '0%', 'stop-color': grd[1][0] }),
      h('stop', { offset: '100%', 'stop-color': grd[1][1] })
    ]);
    const lg11 = h('linearGradient', {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
      id : `lg1-link-${this._id}`,
      "xlink:href":`#lg1-${this._id}`
    });
    const lg22 = h('linearGradient', {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
      id: `lg2-link-${this._id}`,
      "xlink:href":`#lg2-${this._id}`,
      "gradientTransform":`rotate(${rotate})`      
    });
    const a = h('svg', {viewBox:"-4 -2 44 44", class:this.model.get(_a.innerClass)}, [
      lg1,
      lg2,
      lg11,
      lg22,
      h('path', _path(`main-line-${this._id}`, "", "#dde2e8", "gc-grey")),                                  // grey light circle
      h('path', _path(`second-line-${this._id}`, `${pcs}, 100`, `url(#lg2-link-${this._id})`, "", pc * (-1) )),   // red circle
      h('path', _path(`first-line-${this._id}`, `${pc}, 100`, `url(#lg1-link-${this._id})`)),                    // blue circle
      end_path,
      line,
      line2 
    ]);
    return require('vdom-to-html')(a);
  }


  /**
   * 
   * @returns 
   */
  onDomRefresh() {
    this.declareHandlers();

    let skl = Skeletons.Box.Y({
      className : 'chart u-ai-center',
      justify   : _a.center,
      style:{
        zIndex:3000
      },
      kids:[
        Skeletons.Box.Y({
          className:'',
          sys_pn: "chart", 
          styleOpt: { 
            width: 230
          }
        }),
        Skeletons.Box.Y({
          className:'chart__legend chart__legend--small',
          sys_pn: "legend"
        })
      ]
    });
    this.feed(skl);
  }

  /**
   * 
   * @param {*} child 
   * @param {*} pn 
   * @param {*} section 
   * @returns 
   */
  onPartReady(child, pn, section) {
    this[`_${pn}`] = child;
    switch (pn) {
      case "chart":
        return this._chart = child;
      case "legend":
        return this._legend = child;
    }
  }

  /**
   * 
   * @returns 
   */
  update() {
    let side;
    const pc = this.model.get(_a.percent);
    const pcs = this.model.get('percentSecond');
    const percent_sum = pc + (pcs / 2);
    if (percent_sum < 50) {
      side = 'right';
    } else { 
      side = 'left';
    }

    const legend = Skeletons.NOte({
      content:'New language', 
      className : "chart__text chart__text--small"
    });
    this._chart.$el.append(this._draw());
    this._legend.feed(legend);
    this._legend.$el.css(side, '0'); 
  }

  /**
   * 
   * @param {*} m 
   * @returns 
   */
  _shouldUpdate(m) {
    if (m.changed.percent) {
      return this.el.innerHTML = this._draw();
    }
  }
}
__circle_percent.initClass();

module.exports = __circle_percent;
