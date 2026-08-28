
/**
 * 
 * @returns 
 */
Backbone.View.prototype.getIndex = function() {
  if (((this.parent != null ? this.parent.collection : undefined) == null)) {
    return -1;
  }
  return this.parent.collection.findIndex(this.model);
};

/**
 * 
 * @param {*} e 
 * @returns 
 */
Backbone.View.prototype.contains = function(e) {
  let p = e.parent; 
  while (p) { 
    if (p.cid === this.cid) {
      return true; 
    }
    p = p.parent;
  }
  return false; 
};

/**
 * 
 * @param {*} kind 
 * @returns 
 */
Backbone.View.prototype.getParentByKind = function(kind) {
  let p = this.parent; 
  while (p) { 
    if (p.mget(_a.kind) === kind) {
      return p; 
    }
    p = p.parent;
  }
  return null;
};


/**
 * 
 * @param {*} index 
 * @returns 
 */
Backbone.View.prototype.getSiblings = function(index) {
  if (!this.parent) {
    return [];
  }
  if (index != null) {
    return this.parent.children.findByIndex(index);
  }
  return this.parent._getImmediateChildren();
};
