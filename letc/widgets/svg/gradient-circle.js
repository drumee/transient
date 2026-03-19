
function _path(stroke_array, stroke, moreClass) {
  if (moreClass == null) { moreClass = ''; }
  const r = {
    class: `gc-arc ${moreClass}`,
    'stroke-dasharray': stroke_array,
    stroke,
    d: `M18 4 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831`
  };
  return r;
};

const LetcBox = require('../box');
/**
 * 
 */
class __gradient_circle extends LetcBox {
  constructor(...args) {
    super(...args);
    this._draw = this._draw.bind(this);
    this.onDomRefresh = this.onDomRefresh.bind(this);
    this.onPartReady = this.onPartReady.bind(this);
    this.update = this.update.bind(this);
    this._shouldUpdate = this._shouldUpdate.bind(this);
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
      widgetId: this._id
    });
    this.model.atLeast({
      gradient: [['#dde2e8', '#879cff'], ["#35d6ab", "#cfe1e3"]],
      percent: 50,
      cursor: "#35d6ab",
      innerClass: 'circular-chart circular-chart--big'
    });
  }


  /**
   * 
   * @returns 
   */
  _draw() {
    let end_path, line11, line12, line21, line22, percent2;
    const grd = this.model.get(_a.gradient);
    const h = require('virtual-hyperscript-svg');

    const used = this.model.get("used_storage");
    const total = this.model.get("total_storage");
    const free = this.model.get("free_storage");

    let percent1 = this.model.get(_a.percent);
    if (percent1 < 10) {
      percent1 = 10;
    } else if ((percent1 >= 10) && (percent1 < 90)) {
      percent2 = percent1 + ((100 - percent1) / 2);
    } else {
      percent2 = 95;
    }

    if (percent1 === 100) {
      end_path = '';
    } else {
      end_path = h('path', _path("0, 99.9, 100", this.model.get('cursor'), "gc-end"));
    }

    const rotate1 = 3.6 * percent1;
    const radius = 18;
    const lineX1 = radius * Math.sin((rotate1 * Math.PI) / 180.0);
    const lineY1 = radius * Math.cos((rotate1 * Math.PI) / 180.0);

    const rotate2 = 3.6 * percent2;
    const lineX2 = radius * Math.sin((rotate2 * Math.PI) / 180.0);
    const lineY2 = radius * Math.cos((rotate2 * Math.PI) / 180.0);

    if (percent1 >= 50) {
      line11 = h('line', {
        x1: 35,
        y1: 32,
        x2: 41,
        y2: 32,
        class: 'chart-line chart-line--small'
      });
      line12 = h('line', {
        x1: 41,
        y1: 32,
        x2: 54,
        y2: 20,
        class: 'chart-line chart-line--small'
      });
      line21 = h('line', {
        x1: 14 + lineX2,
        y1: 20 - lineY2,
        x2: 8 + lineX2,
        y2: 20 - lineY2,
        class: 'chart-line chart-line--small'
      });
      line22 = h('line', {
        x1: 8 + lineX2,
        y1: 20 - lineY2,
        x2: -18,
        y2: 20,
        class: 'chart-line chart-line--small'
      });
    } else {
      line11 = h('line', {
        x1: 22 + lineX1,
        y1: 20 - lineY1,
        x2: 28 + lineX1,
        y2: 20 - lineY1,
        class: 'chart-line chart-line--small'
      });
      line12 = h('line', {
        x1: 28 + lineX1,
        y1: 20 - lineY1,
        x2: 54,
        y2: 20,
        class: 'chart-line chart-line--small'
      });
      line21 = h('line', {
        x1: 1,
        y1: 32,
        x2: -5,
        y2: 32,
        class: 'chart-line chart-line--small'
      });
      line22 = h('line', {
        x1: -5,
        y1: 32,
        x2: -18,
        y2: 20,
        class: 'chart-line chart-line--small'
      });
    }
    const lg1 = h('linearGradient', {
      id: `lg1-${this._id}`
    }, [
      h('stop', { offset: '0%', 'stop-color': grd[0][0] }),
      h('stop', { offset: '100%', 'stop-color': grd[0][1] })
    ]);
    const lg2 = h('linearGradient', {
      id: `lg2-${this._id}`
    }, [
      h('stop', { offset: '0%', 'stop-color': grd[1][0] }),
      h('stop', { offset: '100%', 'stop-color': grd[1][1] })
    ]);
    const lg11 = h('linearGradient', {
      x1: '0',
      y1: '0',
      x2: '0',
      y2: '1',
      id: `lg1-link-${this._id}`,
      "xlink:href": `#lg1-${this._id}`
    });
    const lg22 = h('linearGradient', {
      x1: '0',
      y1: '0',
      x2: '0',
      y2: '1',
      id: `lg2-link-${this._id}`,
      "xlink:href": `#lg2-${this._id}`
    });
    const pc = this.model.get(_a.percent);
    const a = h('svg', { viewBox: "-4 -2 44 44", class: this.model.get(_a.innerClass) }, [
      lg1,
      lg2,
      lg11,
      lg22,
      h('path', _path(`0, ${pc}, 100`, `url(#lg2-link-${this._id})`)),    // lower circle
      h('path', _path(`${pc}, 100`, `url(#lg1-link-${this._id})`)),       // upper circle
      end_path,
      line11,
      line12,
      line21,
      line22
    ]);
    return require('vdom-to-html')(a);
  }


  /**
   * 
   * @returns 
   */
  onDomRefresh() {
    this.declareHandlers();

    const skl = Skeletons.Box.X({
      className: 'chart u-ai-center u-jc-center',
      justify: _a.center,
      kids: [
        Skeletons.Box.Y({
          className: 'chart__legend',
          sys_pn: "free_storage",
          styleOpt: {
            width: 180
          }
        }),
        Skeletons.Box.Y({
          className: '',
          sys_pn: "chart",
          styleOpt: {
            width: 430
          }
        }),
        Skeletons.Box.Y({
          className: 'chart__legend',
          sys_pn: "used_storage",
          styleOpt: {
            width: 180
          }
        })
      ]
    }, { 'z-index': 3000 });
    return this.feed(skl);
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
      case "used_storage":
        return this._used_storage = child;
      case "free_storage":
        return this._free_storage = child;
    }
  }

  /**
   * 
   * @returns 
   */
  update() {
    const used = this.model.get("used_storage");
    const used_storage = SKL_Note(null, `${used} used`, {
      className: "chart__text chart__text--big"
    });
    const free = this.model.get("free_storage");
    const free_storage = SKL_Note(null, `${free} available`, {
      className: "chart__text chart__text--big u-jc-end"
    });
    this._chart.el.innerHTML = this._draw();
    this._used_storage.feed(used_storage);
    return this._free_storage.feed(free_storage);
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

module.exports = __gradient_circle;
