
const { getElStablePosition } = require("@drumee/ui-essentials");
const gsap = require('../../../vendor').default;
require('./skin')
const _default_class = "menu-topic drumee-widget";
const LetcBox = require('../box');
class __menu_topic extends LetcBox {
  constructor(...args) {
    super(...args);
    this.onBeforeDestroy = this.onBeforeDestroy.bind(this);
    this._onOpen = this._onOpen.bind(this);
    this._onClosed = this._onClosed.bind(this);
    this._closeItems = this._closeItems.bind(this);
  }

  static initClass() {
    this.prototype.nativeClassName = _default_class;
  }

  tagName() {
    return _K.tag.li;
  }

  /**
   * 
   * @param {*} opt 
   */
  initialize(opt) {
    // Force kids to be empty, because we use items + trigger
    this.model.set(_a.kids, []);
    super.initialize(opt);
    this._selector = this.mget(_a.selector) || _a.menu;
    this.declareHandlers({ part: _a.multiple, ui: _a.multiple });
    const state = this.mget(_a.initialState) || this.mget(_a.state) || 0;

    this.model.set({
      state
    });

    this.model.atLeast({
      motion: _a.none,
      radio: _a.parent,
      persistence: _a.toggle,
      opening: _a.click,
      axis: _a.y,
      direction: _a.down,
      itemsX: 0,
      itemsY: 0,
      duration: .4
    });
    this.offsetX = 0;
    this.offsetY = 0;
    const digit = /^(\-|\+)*[0-9]+(\.[0-9]*){0,1}$/;

    if (digit.test(this.mget(_a.offsetY))) {
      this.offsetY = parseInt(this.mget(_a.offsetY));
    }

    if (digit.test(this.mget(_a.offsetX))) {
      this.offsetX = parseInt(this.mget(_a.offsetX));
    }

    this._onOutsideClick = (e, origin) => {
      if (pointerDragged) {
        return;
      }
      if ((e != null) && this.el.contains(e.currentTarget)) {
        return;
      }
      if ((origin != null) && (this.contains(origin) || ([_e.data, _a.idle].includes(origin.status)))) {
        return;
      }
      // if (!this._size) return;
      this._closeItems();
    };
    RADIO_CLICK.on(_e.click, this._onOutsideClick);
  }

  /**
   * 
   */
  onBeforeDestroy() {
    RADIO_CLICK.off(_e.click, this._onOutsideClick);
  }

  /**
   * 
   * @param {*} cmd 
   */
  onUiEvent(cmd) {
    if (this.getPart(_a.trigger).contains(cmd)) {
      if (cmd.mget(_a.state) !== null) {
        cmd.mset(_a.state, 1 ^ cmd.mget(_a.state));
      }
      if (cmd.mget(_a.toggle) !== null) {
        cmd.mset(_a.toggle, 1 ^ cmd.mget(_a.toggle));
      }
      this._onTriggerClicked();
    }
  }

  /**
   * 
   * @param {*} skeletons 
   */
  renderItems(skeletons) {
    this.__items.feed(skeletons);
  }

  /**
   * 
   * @param {*} child 
   * @param {*} pn 
   */
  onPartReady(child, pn) {
    switch (pn) {
      case _a.trigger:
        var trigger = this.mget(_a.trigger) || Skeletons.Button.Svg({
          ico: "bars",
          className: "icon",
          signal: "menu:event"
        });
        child.feed(trigger);
        if (this.mget(_a.opening) === _a.flyover) {
          this.$el.on(_e.mouseleave, e => {
            this._timeout = _.delay(() => { this._mouseleave(e) }, 1000);
          });
          child.$el.on(_e.mouseenter, e => {
            clearTimeout(this._timeout);
            this._mouseenter(e);
          });
        }
        break;
      case _a.items:
        child.onChildBubble = c => {
          this._onItemClicked(child);
        };
        child.$el.on(_e.mouseenter, e => {
          clearTimeout(this._timeout);
        });
        this._prepareItems(child);
        break;

      case 'items-wrapper':
        child.$el.css({
          position: _a.absolute,
          overflow: _a.hidden,
        });
        break;
    }
  }

  /**
   * 
   * @param {*} child 
   */
  _onTriggerClicked(child) {
    this._triggerToggle();
  }

  /**
   * 
   * @param {*} child 
   * @returns 
   */
  _onItemClicked(child) {
    switch (this.mget(_a.persistence)) {
      case _a.always:
        return;
      case _a.self:
        if (this.__items.contains(child)) {
          return;
        }
        if (this.__trigger.contains(child)) {
          this._triggerToggle();
        }
        break;
      case _a.toggle:
        if (this.__trigger.contains(child)) {
          this._triggerToggle();
        }
        break;
      default:
        this._closeItems();
    }
  }

  /**
   * 
   */
  restart() {
    this.feed(require('./skeleton')(this));
  }

  /**
   * 
   */
  onDomRefresh() {
    this.restart();
  }

  /**
   * 
   * @param {*} c 
   */
  // _updateSize(c) {
  //   let maxWidth = 0;
  //   let maxHeight = 0;
  //   let timer = setInterval(() => {
  //     if (!this.__items.isAttached()) return;
  //     if (maxWidth == this.__items.$el.width() && maxHeight == this.__items.$el.height()) {
  //       clearInterval(timer)
  //     }
  //     if (this.__items.$el.width() > maxWidth) maxWidth = this.__items.$el.width();
  //     if (this.__items.$el.height() > maxHeight) maxHeight = this.__items.$el.height();
  //     this._size = {
  //       width: maxWidth,
  //       height: maxHeight
  //     }
  //     console.log("AAAA:230", c, c.el, c.cid, this._size)
  //   }, 100)
  //   setTimeout(() => {
  //   }, 1000)
  // }

  /**
   * 
   * @param {*} child 
   */
  async _prepareItems(child) {
    this._animIsActive = false;
    const kids = this.mget(_a.items);
    if (_.isEmpty(kids)) {
      this._started = 1;
      // this._updateSize(child);
      return;
    }
    child.onAddKid = k => {
      if ((k.getIndex() + 1) === (kids.length || 1)) {
        child.trigger(_e.ready);
        child._ready = 1;
        this._ready = 1;
      }
      // this._updateSize(k);
    };

    child.feed(kids);
    this._started = 1;
    this._size = await this._getCoordinates();
    child.onChildAnimCompleted = this.onChildAnimCompleted;
  }


  /**
   * 
   * @param {*} s 
   */
  changeState(s) {
    if ([true, _a.open, _a.on, 1].includes(s)) {
      this._openItems();
    } else {
      this._closeItems();
    }
  }

  /**
   * 
   * @param {*} e 
   */
  _onOpen(e) {
    const {
      items
    } = this._branches;
    items.el.dataset.state = _a.open;
    this._animIsActive = false;
    this.el.dataset.state = 1;
    this.isOpen = true;
    this.model.set(_a.state, 1);
    if (this.$shadow != null) {
      this.$shadow.width(this.$el.height());
      this.$shadow.width(items.$el.height() + this.$el.height());
    }
    const cb = this.mget(_a.callback);
    if (_.isFunction(cb)) {
      cb(this);
    }
  }

  /**
   * 
   */
  async _getCoordinates() {
    // let { height: items_height, width: items_width } = await getElStablePosition(this.__itemsWrapper.el);
    // let { height: trigger_height, width: trigger_width } = await getElStablePosition(this.__trigger.el);
    let items_height = this.__items.$el.height();
    let trigger_height = this.__trigger.$el.height();
    let items_width = this.__items.$el.width();
    let trigger_width = this.__trigger.$el.width();
    let x = items_height + trigger_height;
    let y = items_width + trigger_width;
    return { x, y }
  }

  /**
   * 
   * @param {*} e 
   */
  async _onClosed(e = { duration: 400 }) {
    if (!this.isOpen) return;
    const {
      items
    } = this._branches;
    items.el.dataset.state = _a.closed;
    this.el.dataset.state = 0;
    this.model.set(_a.state, 0);
    this.isOpen = false;
    this._animIsActive = false;
    let items_height = this.__items.$el.height();
    let trigger_height = this.__trigger.$el.height();
    const { x, y } = await this._getCoordinates()
    switch (this.mget(_a.direction)) {
      case _a.down:
        gsap.set(items.el, { y: 0 });
        this.debug("AAA:308", { translateY: -(items_height + trigger_height) },)
        break;
      case _a.up:
        gsap.set(this.__items.el, { y: items_height });
        gsap.set(this.__itemsWrapper.el, { y: 0, opacity: 0 });
        break;
      case _a.left:
      case _a.right:
        gsap.set(items.el, { x: 0 });
        break;
    }
  }

  /**
   *
   * @returns
   */
  async _openItems() {
    const { x, y } = await this._getCoordinates()
    if (this.isOpen) {
      return;
    }
    const d = this.mget(_a.duration) || Visitor.timeout(this.mget(_a.duration));
    let opt = {
      onComplete: this._onOpen,
      ease: 'expo.out',
    };
    let wrapper = this.__itemsWrapper;
    const items = this.__items;

    // Set state and initial positions synchronously before animation starts
    wrapper.el.dataset.state = _a.open;
    items.el.dataset.state = _a.open;
    this.isOpen = true;
    this._animIsActive = true;

    this.trigger("change:state", this);
    this.trigger(_e.open);

    switch (this.mget(_a.direction)) {
      case _a.down:
        gsap.set(items.el, { y: -x });
        gsap.set(wrapper.el, { opacity: 0 });
        gsap.to(items.el, { y: 0, duration: d, ...opt });
        break;
      case _a.up:
        gsap.set(items.el, { y: x });
        gsap.set(wrapper.el, { opacity: 0 });
        gsap.to(items.el, { y: 0, duration: d, ...opt });
        break;
      case _a.left:
        gsap.set(items.el, { x: y });
        gsap.to(items.el, { x: 0, duration: d, ...opt });
        break;
      case _a.right:
        gsap.set(items.el, { x: -y });
        gsap.to(items.el, { x: 0, duration: d, ...opt });
        break;
      default:
        this.warn("Unsupported valued", this.mget(_a.direction));
    }
    gsap.fromTo(wrapper.el, { opacity: 0 }, { opacity: 1, duration: d });
  }

  /**
   * 
   * @param {*} e 
   */
  async _onStartClosing(e) {
    if (!this.isOpen) return;
    this._animIsActive = true;
  }

  /**
   * @param {*} e 
   */
  _mouseenter(e) {
    if (this._animIsActive || this.mget(_a.state) || Visitor.isMobile()) {
      return;
    }
    this._openItems();
  }

  /**
   * 
   * @param {*} e 
   * @returns 
   */
  _mouseleave(e) {
    if (this._animIsActive) {
      return;
    }
    if (e.target === this.__trigger.el) {
      const r = this.el.getBoundingClientRect();
      if (e.pageX >= r.x && e.pageX <= r.x + r.width && e.pageY >= r.y && e.pageY <= r.y + r.height) {
        return;
      }
    }
    this._closeItems();
    if (this._wrapper) {
      this.trigger(_a.radio, this, this);
    }
  }

  /**
   * 
   * @param {*} model 
   */
  _renderShower(model) {
    let content, vars;
    if (mget(_a.values)) {
      vars = mget(_a.values);
    } else {
      content = mget(_a.content);
      vars = {
        content: content || mget(_a.label) || mget(_a.value),
        value: mget(_a.value)
      };
    }
    for (let c of Array.from(this._showers)) {
      if (_.isFunction(c.mould)) {
        c.model.set(vars);
        if ((c.mget(_a.label) != null) && (content != null)) {
          c.model.set(_a.label, content);
        }
        c.mould(true);
      }
    }
  }


  /**
   * 
   * @returns 
   */
  async _closeItems() {
    if (this.brake) {
      return;
    }
    const items = this.__items;
    const d = this.mget(_a.duration) || Visitor.timeout(this.mget(_a.duration));
    let opt = {
      onStart: this._onStartClosing,
      onComplete: this._onClosed,
      ease: 'expo.inOut',
    };
    // let items_width = this.__items.$el.width();
    // let items_height = this.__items.$el.height();
    let { height: items_height, width: items_width } = await getElStablePosition(this.__itemsWrapper.el);
    let { height: trigger_height, width: trigger_width } = await getElStablePosition(this.__trigger.el);
    let x = items_height + trigger_height;
    let y = items_width + trigger_width;
    switch (this.mget(_a.direction)) {
      case _a.down:
        gsap.to(items.el, { y: -y, duration: d, ...opt });
        break;
      case _a.up:
        gsap.to(items.el, { y: y, duration: d, ...opt });
        break;
      case _a.left:
        gsap.to(items.el, { x: x, duration: d, ...opt });
        break;
      case _a.right:
        gsap.to(items.el, { x: -x, duration: d, ...opt });
        break;
      default:
        this.warn("Unsupported valued", this.mget(_a.direction));
    }
    // animate({ targets: this.__itemsWrapper.el, opacity: 0, duration: d * 1000 });
    // setTimeout(() => {
    //   this.trigger("change:state", this)
    //   this.trigger(_e.close);
    // }, d * 1000)
  }


  /**
   * 
   * @param {*} origin 
   * @param {*} e 
   * @returns 
   */
  _close(origin, e) {
    if (this.mget(_a.state) === 0) {
      return;
    }
    try {
      this.brake = (origin.mget(_a.persistence) === _a.always);
    } catch (error) { }
    if (this.brake) {
      return;
    }
    this.el.dataset.state = 0;
    this.el.dataset.radio = _a.off;
    this.el.dataset.radiotoggle = _a.off;
    try {
      const stop = origin.mget(_a.level) === _K.level.trigger;
      if (stop) {
        return;
      }
    } catch (error1) { }
    this.model.set(_a.state, 0);
    if ((origin == null) || origin.model) {
      return;
    }
    try {
      if (origin.mget(_a.shower) || this.mget(_a.shower)) {
        this._renderShower(origin.model);
      }
    } catch (error2) { }
  }


  /**
   * 
   * @param {*} item 
   */
  _update(item) {
    const name = this._name || item.mget(_a.name) || this._name;
    const value = item.mget(_a.value) || item.mget(_a.content);
    if (item.mget(_a.values)) {
      this.model.set(_a.values, item.mget(_a.values));
    } else {
      this.model.set(name, value);
      this.model.set(_a.value, value);
    }
  }



  /**
   * 
   * @param {*} child 
   * @param {*} origin 
   */
  _triggerToggle(child, origin) {
    if (!this.mget(_a.state)) {
      this._openItems();
    } else {
      this._closeItems();
    }
  }


  /**
   * 
   * @param {*} origin 
   */
  onChildAnimCompleted(origin) {
    this._animated = origin;
    this._animIsActive = false;
  }
}
__menu_topic.initClass();
// ---------------------------

module.exports = __menu_topic;
