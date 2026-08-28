

function _parseMatrix(s) {
  const m = /matrix\(([^)]+)\)/.exec(s);
  if (!m) throw new Error('invalid matrix');
  const [a, b, c, d, e, f] = m[1].split(',').map(Number);
  return { a, b, c, d, e, f };
}

/**
 *
 * @returns
 */
Backbone.View.prototype.cover = function() {
  return this.$el.attr(_a.data.hide, _a.yes);
};

/**
 * 
 * @returns 
 */
Backbone.View.prototype.uncover = function() {
  return this.$el.attr(_a.data.hide, _a.no);
};

/**
 * 
 * @returns 
 */
Backbone.View.prototype.getZindex = function() {
  const i = parseInt(this.style.get(_a.zIndex));
  if (_.isFinite(i)) {
    return i;
  }
  return 0;
};

/**
 * 
 * @returns 
 */
Backbone.View.prototype.isRotated = function() {
  let t = this.style.get(_a.transform);
  if ((t == null)) { 
    return 0;
  }
  try { 
    t = _parseMatrix(t);
    const angle = Math.round(Math.atan2(t.b, t.a) * (180/Math.PI));   
    return angle;
  } catch (e) {
    return 0;
  }
};

/**
 * 
 * @param {*} axis 
 * @returns 
 */
Backbone.View.prototype.isFlipped = function(axis) {
  let t;
  try {
    t = _parseMatrix(this.style.get(_a.transform));
  } catch (error) {
    t = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }
  switch (axis) {
    case _a.horizontal: case _a.x:
      return t.a < 0; //is -1
    case _a.vertical: case _a.y:
      return t.d < 0; // is -1
  }
  return false;
};



/**
 * 
 * @param {*} opt 
 * @returns 
 */
Backbone.View.prototype.setStyle = function(opt) {
  return (this.$el != null ? this.$el.css(opt) : undefined);
};


/**
 * 
 * @param {*} opt 
 * @returns 
 */
Backbone.View.prototype.updateStyle = function(opt) {
  if (_.isArray(opt)) {
    this.warn("Invalid arguments : array passed");
    return;
  }
  if (_.isString(opt)) {
    this.style.set(arguments['0'], arguments['1']);
  } else {
    this.style.set(opt);
  }
  this.refresh();
  return this.triggerMethod(_e.refresh);
};



/**
 * 
 * @returns 
 */
Backbone.View.prototype.getStyle = function() {
  return this.style.toJSON();
};


/**
 * 
 * @param {*} name 
 * @returns 
 */
Backbone.View.prototype.getActualStyle = function(name) {
  if (name != null) {
    return window.getComputedStyle(this.el)[name];
  }
  return window.getComputedStyle(this.el);
};


/**
 * 
 * @param {*} names 
 * @returns 
 */
Backbone.View.prototype.getActualStyles = function(names) {
  let style;
  if (Utils.Text.isSelected()) {
    style = window.getComputedStyle(document.getSelection().focusNode.parentElement);
  } else {
    style = window.getComputedStyle(this.el);
  }
  if ((names == null)) {
    return style;
  }
  const opt = {};
  for (var k of Array.from(names)) {
    var value = style[k];
    if (value != null) {
      value  = value.replace(/(^[\'\"])|([\'\"]$)/g, _K.char.empty);
      opt[k] = value;
    }
  }
  return opt;
};

/**
 * 
 * @returns 
 */
Backbone.View.prototype.renderPseudo=function(){
  if (!this.mget(_a.pseudo)) {
    return;
  }
  return Array.from(this.$el.find("[data-pseudo]")).map((el) =>
    el.pseudoStyle());
};


