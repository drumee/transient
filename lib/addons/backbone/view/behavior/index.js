const __preset = {
  bhv_radio: require("./radio"),
  bhv_radiotoggle: require("./radio-toggle"),
  bhv_toggle: require("./toggle"),
  bhv_wrapper: require("./wrapper")
};

const __configured = {
  flyover: require("./flyover"),
  radio: require("./radio"),
  radiotoggle: require("./radio-toggle"),
  state: require("./toggle"),
  toggle: require("./toggle"),
  wrapper: require("./wrapper")
};


Backbone.View.prototype.behaviors = function () {
  let behaviorSet, k, sel, v;
  if (_.isFunction(this.behaviorSet)) {
    behaviorSet = this.behaviorSet();
  } else {
    ({ behaviorSet } = this);
  }

  const list = {};
  for (k in behaviorSet) {
    v = behaviorSet[k];
    sel = __preset[k];
    if (sel != null) {
      if (!_.isObject(v)) {
        v = { args: v };
      }
      list[sel.name] = { ...v, behaviorClass: sel };
    }
  }
  for (k in this.options) {
    v = this.options[k];
    sel = __configured[k];
    if (sel != null) {
      var tmp = list[sel.name] || {};
      if (!_.isObject(v)) {
        v = { args: v };
      }
      list[sel.name] = { ...tmp, ...v, behaviorClass: sel };
    }
  }
  if(list.behavior_radio && list.behavior_toggle){
    delete list.behavior_toggle
  }
  return _.values(list);
};
