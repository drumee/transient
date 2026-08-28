class __image_slide extends Marionette.CollectionView {
  constructor(...args) {
    super(...args);
    this.onDestroy = this.onDestroy.bind(this);
    this._responsive = this._responsive.bind(this);
    this._loaded = this._loaded.bind(this);
    this.onRender = this.onRender.bind(this);
    this.onDomRefresh = this.onDomRefresh.bind(this);
    this.onParentReady = this.onParentReady.bind(this);
    this._resize = this._resize.bind(this);
    this._playChildren = this._playChildren.bind(this);
    this.play = this.play.bind(this);
  }

  static initClass() { 
    this.prototype.templateName = _T.wrapper.slide;
    this.prototype.childViewContainer = _K.tag.ul;
    this.prototype.childView = WPP.Note;
    this.prototype.className  = 'film absolute';
    this.prototype.ui =
      {image   : 'img'};
  }

  /**
   * 
   * @param {*} opt 
   */
  initialize(opt) {
    this._done = false;
    const src = require('options/url/file')(this.model, _a.slide);
    this.model.set({
      format : _a.orig,
      src
    });
    this.image = new window.Image();
    $(this.image).on(_e.load, this._loaded);
    $(this.image).attr(_a.src, src);
    this.collection = new Backbone.Collection();
    this.collection.cleanSet(this.get(_a.kids));
    RADIO_BROADCAST.on(_e.responsive, this._responsive);
  }

  /**
   * 
   * @returns 
   */
  onDestroy() {
    RADIO_BROADCAST.off(_e.responsive, this._responsive);
  }

  /**
   * 
   * @returns 
   */
  _responsive() {
    const img = this.$el.find('img');
    img.attr(_a.width, this.$el.parent().width());
  }

  /**
   * 
   * @returns 
   */
  _loaded() {
    return this.trigger(_e.ready);
  }

  /**
   * 
   * @returns 
   */
  onRender() {
    return this.$el.css({
      overflow: _a.hidden});
  }

  /**
   * 
   * @returns 
   */
  onDomRefresh() {
    this._responsive();
  }

  /**
   * 
   * @param {*} parent 
   * @returns 
   */
  onParentReady(parent) {
    this._resize(parent);
  }

  /**
   * 
   * @param {*} parent 
   * @returns 
   */
  _resize(parent) {
    if (!this._done) {
      delete this.image.height; // = height
      this.ui.image.replaceWith(this.image);
      this._done = true;
    }
    this._responsive();
  }

  /**
   * 
   * @returns 
   */
  _playChildren() {
    this.children.each(child => child.triggerMethod(_e.play));
  }

  /**
   * 
   * @param {*} tl 
   * @returns 
   */
  play(tl) {
    const left = this.parent.$el.width() + 60;
    const anim = this.model.get(_a.anim);
    if ((anim == null)) {
      return;
    }
    // options/gsapp/base and options/gsapp/convert must return Anime.js-compatible values
    const settings = anim.settings || require('options/gsapp/base')(_a.defaults);
    tl.add(this.$el[0], { opacity: [0, 1], duration: 10 });
    const from = require('options/gsapp/convert')(anim.in, {x:-left});
    if (!_.isEmpty(from)) {
      tl.add(this.$el[0], { ...from.definition, duration: from.duration * 1000 });
    }
    const to = require('options/gsapp/convert')(anim.out, {x:left});
    if (!_.isEmpty(to)) {
      tl.add(this.$el[0], { ...to.definition, duration: to.duration * 1000 }, `+=${settings.pausetime * 1000}`);
    }
    tl.call(this._playChildren);
    return tl.add(this.$el[0], { opacity: 0, duration: 60 });
  }
}
__image_slide.initClass();
module.exports = __image_slide;
