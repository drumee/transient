const { toBoolean } = require("../../utils")
const { LetcBox } = require("../box");
if (!window.d3) window.d3 = require("d3");

class __chart_sline extends LetcBox {

  /**
   * 
   */
  onDomRefresh() {
    this.waitElement(this.el, () => {
      this.reload();
    });
  }

  /**
   * 
   * @returns 
   */
  reload() {
    this._data = this._data || this.get('dataset') || {};
    const columns = [];
    let i = 0;
    for (let a of Array.from(this._data.column_names)) {
      columns.push([a]);
    }
    for (let b of Array.from(this._data.data)) {
      var asc, end;
      for (i = 0, end = b.length - 1, asc = 0 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
        columns[i].push(b[i]);
      }
    }
    const chartId = `#${this.model.get(_a.chartId)}`;
    const options = {
      bindto: chartId,
      size: {
        width: this._width - 20,
        height: this._height - 60
      },
      data: {
        x: this._data.column_names[0],
        columns
      }, //[labels, values]
      point: {
        show: false
      },
      zoom: {
        enabled: true
      },
      axis: {
        x: {
          type: 'timeseries',
          tick: {
            format: '%Y-%m-%d',
            count: 10
          }
        },
        y: {
          label: {
            text: this._data.name,
            position: 'outer-middle'
          }
        },
        y2: {
          show: toBoolean(this.mget('y2'))
        }
      }
    };
    if (this.get('policy') != null) {
      options = { ...options, ...this.get('policy') };
    }
    let args = { ...options, ...this.get('policy') };
    return chart = this._c3.generate(args);
  }
}
module.exports = __chart_sline;
