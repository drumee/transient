/**
 * 
 * @returns 
 */
HTMLElement.prototype.hide = function(){
  setTimeout(()=>{
    this.setAttribute('data-state', 'closed');
  }, 100);
};

/**
 * 
 * @returns 
 */
HTMLElement.prototype.show = function(){
  setTimeout(()=>{
    this.setAttribute('data-state', 'open');
  }, 100);
};


/**
 * 
 * @param {*} unit 
 * @returns 
 */
HTMLElement.prototype.innerWidth = function(unit){
  const r = window.getComputedStyle(this);
  const border  = (parseInt(r.borderLeftWidth) || 0) + (parseInt(r.borderRightWidth) || 0);
  const padding = (parseInt(r.paddingLeft)     || 0) + (parseInt(r.paddingRight) || 0);
  const w = parseInt(r.width) - padding - border;
  return w;
};

/**
 * 
 * @param {*} unit 
 * @returns 
 */
HTMLElement.prototype.outerWidth = function(unit){
  return parseInt(window.getComputedStyle(this).width);
};

/**
 * 
 * @param {*} unit 
 * @returns 
 */
HTMLElement.prototype.innerHeight = function(unit){
  const r =  window.getComputedStyle(this);
  const border  = (parseInt(r.borderTopWidth) || 0) + (parseInt(r.borderBottomWidth) || 0);
  const padding = (parseInt(r.paddingTop)     || 0) + (parseInt(r.paddingBottom)     || 0);
  const h = parseInt(r.height) - padding - border;
  return h;
};

/**
 * 
 * @param {*} unit 
 * @returns 
 */
HTMLElement.prototype.outerHeight = function(unit){
  return parseInt(window.getComputedStyle(this).height);
};


/**
 * 
 * @param {*} e 
 * @returns 
 */
HTMLElement.prototype.getService = function(e){
  e.stopImmediatePropagation();
  e.stopPropagation();
  const {
    target
  } = e;
  const {
    service
  } = target.dataset;
  if (target === this) { 
    return service; 
  }

  let p = target.parentNode;
  while (p != null) {
    if ((p.dataset != null ? p.dataset.service : undefined) != null) {
      return p.dataset.service;
    }
    p = p.parentNode;
  }
  return service;
};
