/*
 * Selective, non-MFS LETC Widget extraction.
 *
 * The classes below retain the historical Marionette ancestry and lifecycle
 * (`initialize`, `onDomRefresh`, `feed`, `onUiEvent`) from ui-core. They are
 * adapted only at seams that called MFS, Team routing, browser radios, or the
 * legacy `KIND` constants.
 */
const createDOMPurify = require("dompurify");
const { ATTR, colorFromName, LetcBox, LetcView, _ } = require("./letc");

const NOTE_TAGS = ["a", "b", "br", "code", "div", "em", "i", "p", "span", "strong", "u"];

class LetcBlank extends LetcView {
  static figName = "widget_blank";

  initialize(options = {}) {
    super.initialize(options);
    this.model.atLeast({ flow: "x" });
  }

  // Adapted directly from ui-core/letc/widgets/blank/index.js::onDomRefresh.
  onDomRefresh() {
    const renderer = this.mget(ATTR.renderer);
    const content = this.mget(ATTR.content);
    if (content) this.el.innerHTML = String(content);
    else if (_.isFunction(renderer)) this.$el.append(renderer(this));
  }
}

class LetcText extends LetcView {
  static figName = "drumee_text";

  initialize(options = {}) {
    super.initialize(options);
    this.model.atLeast({
      flow: "wrap",
      placeholder: "",
      innerClass: "",
      use_mask: 0,
      content: this.mget(ATTR.alt) || this.mget(ATTR.value) || ""
    });
    this._id = this._id || _.uniqueId("note-");
    this.model.set(ATTR.widgetId, this._id);
  }

  // The source's cleanText/draw sequence is retained. DOMPurify is the
  // historical dependency and is deliberately not replaced by textContent.
  onDomRefresh() {
    this.cleanText();
    this.draw();
  }

  cleanText() {
    const model = this.model.toJSON();
    const content = model.content || model.value || model.label || model.text || "";
    const tags = this.mget("tags") || NOTE_TAGS;
    const purifier = createDOMPurify(this.el.ownerDocument.defaultView || globalThis);
    const safe = purifier.sanitize(content, { ADD_ATTR: ["target"], ALLOWED_TAGS: tags });
    this.el.innerHTML = `<div id="${model.widgetId}-inner" class="${model.innerClass || ""} ${this.fig.family} inner note-content">${safe}</div>`;
  }

  draw() {
    this.el.dataset.state = this.mget("state") || "";
    this.$content = this.$el.find(`#${this._id}-inner`);
    this.renderPseudo();
  }

  getText() {
    return this.el.innerText;
  }

  set(options, value) {
    if (typeof options === "string") this.model.set(options, value);
    else this.model.set(options);
    this.render();
    return this;
  }

  mould() {
    this.render();
    this.draw();
  }
}

class LetcList extends LetcBox {
  static figName = "list_smart";

  initialize(options = {}) {
    super.initialize(options);
    this.model.atLeast({ flow: "y", vendorOpt: {} });
  }

  onDomRefresh() {
    this.el.dataset.list = "smart";
  }
}

class LetcTable extends LetcList {
  static figName = "list_table";

  onDomRefresh() {
    this.el.dataset.list = "table";
  }
}

class LetcSvgImage extends LetcView {
  static figName = "drumee_svg";

  initialize(options = {}) {
    super.initialize(options);
    this.model.atLeast({ chartId: "", innerClass: "svg-inner", value: "", content: "", labelClass: "label" });
    this.declareHandlers();
  }

  // Adapted from widgets/image/svg/index.js::onDomRefresh: the generic inline
  // SVG branch is retained; MFS node/vector fetch branches are deferred.
  onDomRefresh() {
    const chartId = this.mget("chartId") || this.mget("ico") || "";
    const content = this.mget(ATTR.content);
    this.el.dataset.state = this.mget("state") || "";
    if (content) this.el.innerHTML = String(content);
    else this.el.innerHTML = `<svg id="icon-${this._id}" class="${this.mget("innerClass")}" role="img" aria-label="${chartId}"><use href="#--icon-${chartId}"></use></svg>`;
  }

  setIcon(chartId) {
    const icon = this.el.querySelector("svg");
    if (icon) icon.innerHTML = `<use href="#--icon-${chartId}"></use>`;
    this.model.set("chartId", chartId);
    return this;
  }
}

class LetcEntry extends LetcBox {
  static figName = "drumee_entry_input";

  initialize(options = {}) {
    super.initialize(options);
    this.model.atLeast({ type: "text", autocomplete: "off", value: "", placeholder: "" });
  }

  // Non-MFS input branch of ui-core's entry/input widget. Its historical
  // application form/error/service plumbing is not a bootstrap prerequisite.
  onDomRefresh() {
    const type = this.mget("type") === "textarea" ? "textarea" : "input";
    const name = this.mget("name") || "";
    const value = this.mget("value") || "";
    const placeholder = this.mget("placeholder") || "";
    if (type === "textarea") this.el.innerHTML = `<textarea class="entry-input" name="${name}" autocomplete="${this.mget("autocomplete")}" placeholder="${placeholder}">${value}</textarea>`;
    else this.el.innerHTML = `<input class="entry-input" type="${type}" name="${name}" autocomplete="${this.mget("autocomplete")}" placeholder="${placeholder}" value="${value}">`;
    this.input = this.el.querySelector(".entry-input");
    this.input.addEventListener("input", () => this.model.set("value", this.input.value));
  }

  getValue() {
    return this.input ? this.input.value : this.mget("value");
  }

  setValue(value) {
    this.model.set("value", value);
    if (this.input) this.input.value = value;
    return this;
  }

  focusAt() {
    if (this.input) this.input.focus();
  }
}

class LetcEntryReminder extends LetcBox {
  static figName = "entry_reminder";

  initialize(options = {}) {
    super.initialize(options);
    this.declareHandlers({ part: "multiple", ui: "multiple" });
    this.model.atLeast({ type: "text", flow: "none", autocomplete: "off" });
  }

  // Adapted from entry/reminder/index.js::onDomRefresh. Its child model is a
  // genuine `entry` Widget; application service dispatch remains outside.
  onDomRefresh() {
    this.feed({
      kind: "entry",
      sys_pn: "ref-entry",
      type: this.mget("type"),
      name: this.mget("name"),
      value: this.mget("value"),
      placeholder: this.mget("placeholder"),
      autocomplete: this.mget("autocomplete")
    });
  }

  getValue() {
    const entry = this.getPart("ref-entry");
    return entry ? entry.getValue() : this.mget("value");
  }

  focus() {
    const entry = this.getPart("ref-entry");
    if (entry) entry.focusAt();
  }
}

class LetcFileSelector extends LetcView {
  static figName = "file_selector";

  // Retains ui-core/widgets/file-selector's actual DOM/lifecycle contract.
  onDomRefresh() {
    const accept = this.mget("accept") || "";
    this.el.innerHTML = `<input id="${this._id}-fsel" ${accept ? `accept="${accept}"` : ""} class="inner full" type="file" multiple name="files[]">`;
  }

  bindChange(callback) {
    this._callback = callback;
    return this;
  }

  open(handler = this._callback) {
    const input = this.el.querySelector(`#${this._id}-fsel`);
    if (!input) throw new Error("No element to handle file selection");
    input.onchange = (event) => {
      if (handler) handler(event);
      input.onchange = null;
    };
    input.value = "";
    input.click();
  }
}

class LetcImageSmart extends LetcView {
  static figName = "image_smart";

  tagName() {
    return "img";
  }

  initialize(options = {}) {
    super.initialize(options);
    if (options.src) this.model.atLeast({ low: options.src, high: options.src });
  }

  // Adapted from widgets/image/smart/index.js. The source's `nid`/
  // `actualNode()` branch is MFS and is intentionally absent; generic src,
  // low/high quality loading and error events are retained.
  onDomRefresh() {
    this.el.id = this._id;
    this._load();
  }

  _loadHighQuality(event) {
    const url = this.mget("high") || this.mget("src");
    if (!url) return;
    this.el.dataset.quality = "high";
    this.el.src = url;
    this._loaded = true;
    if (event && event.type === "load") this.trigger("loaded", this);
  }

  _load() {
    if (this._loaded) return;
    const low = this.mget("low");
    const url = low || this.mget("high") || this.mget("src");
    if (!url) return;
    this.el.onload = (event) => this._loadHighQuality(event);
    this.el.onerror = () => this.trigger("load:error", this);
    this.el.dataset.quality = low ? "low" : "high";
    this.el.src = url;
  }

  reload(options = {}) {
    const src = typeof options === "string" ? options : options.url || options.high || options.src || options.low;
    if (typeof options === "object") this.model.set(options);
    else this.model.set({ high: src });
    this._loaded = false;
    this._load();
  }
}

const profileImageCache = new Map();

function profileSkeleton(ui) {
  return ui.runtime.Skeletons.Box.Y({
    className: `${ui.fig.family}__main`,
    sys_pn: "image-box",
    partHandler: ui,
    active: ui.mget("active")
  });
}

class LetcProfile extends LetcBox {
  static figName = "user_profile";

  // Selective extraction of widgets/profile/index.js. The generic initials,
  // display name, colour and optional browser-avatar presentation remain;
  // Visitor.avatar, RADIO_BROADCAST and Window Manager state do not.
  initialize(options = {}) {
    super.initialize(options);
    this.model.atLeast({ flow: "y", auto_color: 1, online: 0 });
    this.declareHandlers();
    const id = options.id || options.uid || options.user_id || options.drumate_id || options.entity_id || this.mget("id");
    if (id != null) this.mset("id", id);
  }

  onDomRefresh() {
    this.feed(profileSkeleton(this));
    this.loadImage();
    this.el.dataset.online = String(this.mget("online") || 0);
  }

  restart(clearCache = false) {
    if (clearCache) profileImageCache.delete(this._profileCacheKey());
    this.onDomRefresh();
  }

  initiales() {
    const first = String(this.mget("firstname") || "").trim().charAt(0);
    const last = String(this.mget("lastname") || "").trim().charAt(0) || first;
    if (first || last) return `${first}${last}`;
    const [surnameFirst = "", surnameLast = ""] = String(this.mget("surname") || this.mget("username") || "").trim().split(/[ ,]+/);
    return `${surnameFirst.charAt(0)}${surnameLast.charAt(0)}`;
  }

  displayName() {
    const surname = String(this.mget("surname") || "").trim();
    if (surname) return surname;
    const username = String(this.mget("username") || "").trim();
    if (username) return username;
    const full = `${this.mget("firstname") || ""} ${this.mget("lastname") || ""}`.trim();
    return full || String(this.mget("email") || "").split("@")[0];
  }

  _profileCacheKey() {
    return this.mget("id") || this.mget("avatar") || this.mget("src") || this.displayName() || this.cid;
  }

  _avatarSource() {
    const direct = this.mget("avatar") || this.mget("src");
    if (direct) return direct;
    const resolver = this.mget("avatarResolver");
    return typeof resolver === "function" ? resolver({ id: this.mget("id"), type: this.mget("type"), profile: this }) : "";
  }

  _imageBox() {
    return this.getPart("image-box");
  }

  _showAvatar(source) {
    const box = this._imageBox();
    if (!box) return;
    box.el.innerHTML = `<img class="${this.fig.family}__icon ${this.fig.family}__picture picture" data-flow="x" alt="${this.displayName()}" src="${source}">`;
    this.el.dataset.default = "0";
  }

  _showFallback() {
    const box = this._imageBox();
    if (!box) return;
    const initials = this.initiales();
    const subject = this.mget("oneLetter") ? this.mget("firstname") || "??" : initials || "??";
    const styleOpt = this.mget("auto_color") === 0 ? {} : { backgroundColor: colorFromName(subject) };
    const descriptor = initials
      ? this.runtime.Skeletons.Note({ content: initials, className: `${this.fig.family}__icon ${this.fig.family}__initiales`, sys_pn: "initiales", active: this.mget("active"), styleOpt })
      : this.runtime.Skeletons.Element({ content: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"8\" r=\"4\"></circle><path d=\"M4 22c0-4.4 3.6-8 8-8s8 3.6 8 8\"></path></svg>", className: `${this.fig.family}__icon ${this.fig.family}__initiales`, sys_pn: "initiales", active: this.mget("active"), styleOpt });
    box.feed(descriptor);
    this.el.dataset.default = "1";
  }

  loadImage() {
    const source = this._avatarSource();
    const key = this._profileCacheKey();
    if (!source || profileImageCache.has(key)) return this._showFallback();
    const ImageConstructor = this.el.ownerDocument && this.el.ownerDocument.defaultView && this.el.ownerDocument.defaultView.Image;
    if (typeof ImageConstructor !== "function") return this._showFallback();
    const image = new ImageConstructor();
    image.onerror = () => {
      profileImageCache.set(key, true);
      this._showFallback();
    };
    image.onload = () => {
      this.el.dataset.quality = "high";
      this._showAvatar(source);
    };
    image.src = source;
  }

  // Generic callers may supply status updates themselves; subscribing to
  // Team radio channels remains outside ui-runtime.
  updateStatus(data = {}) {
    const id = data.id || data.user_id || data.drumate_id;
    if (id != null && this.mget("id") != null && id !== this.mget("id")) return;
    if (data.status == null) return;
    this.mset("online", data.status);
    this.el.dataset.online = String(data.status);
    this.trigger("status_changed", data);
  }
}

function progressSkeleton(ui) {
  const Skeletons = ui.runtime.Skeletons;
  const mode = ui.mget("mode");
  if (mode === "row") {
    return Skeletons.Box.X({
      className: `${ui.fig.family}__main`,
      kids: [
        Skeletons.Box.X({ className: `${ui.fig.family}__container-name`, kids: [
          Skeletons.Note({ className: `${ui.fig.family}__value-filename`, sys_pn: "ref-filename", content: ui.mget("filename") || ui.mget("name") || "" })
        ] }),
        Skeletons.Box.X({ className: `${ui.fig.family}__container-progress`, kids: [
          Skeletons.Box.X({ className: `${ui.fig.family}__bar`, sys_pn: "ref-chart" }),
          Skeletons.Note({ className: `${ui.fig.family}__bar-percent`, sys_pn: "ref-percent", content: "0%" })
        ] }),
        Skeletons.Box.X({ className: `${ui.fig.family}__container-size`, kids: [
          Skeletons.Note({ className: `${ui.fig.family}__value-filesize`, sys_pn: "ref-filesize", content: ui.mget("size") || "" })
        ] })
      ]
    });
  }
  return Skeletons.Box.Y({
    className: `${ui.fig.family}__main`,
    kids: [
      Skeletons.Box.X({ className: `${ui.fig.family}__container-header`, kids: [
        Skeletons.Note({ className: `${ui.fig.family}__value-filesize`, sys_pn: "ref-filesize", content: ui.mget("size") || "" }),
        Skeletons.Note({ className: `${ui.fig.family}__value-percent`, sys_pn: "ref-percent", content: "0%" })
      ] }),
      Skeletons.Box.X({ className: `${ui.fig.family}__container-body`, kids: [
        Skeletons.Box.X({ className: `${ui.fig.family}__chart`, sys_pn: "ref-chart" })
      ] }),
      Skeletons.Box.X({ className: `${ui.fig.family}__container-footer`, kids: [
        Skeletons.Note({ className: `${ui.fig.family}__value-filename`, sys_pn: "ref-filename", content: ui.mget("filename") || ui.mget("name") || "" })
      ] })
    ]
  });
}

function arcLength(value) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  return String(((100 - percent) / 100) * (Math.PI * 160));
}

class LetcProgress extends LetcBox {
  static figName = "svg_progress";

  // Selective extraction of widgets/progress/media/index.js. The visual
  // percent/lifecycle contract and optional listener seam remain; upload end,
  // MFS parent mutation and application handler dispatch are excluded.
  initialize(options = {}) {
    super.initialize(options);
    this.declareHandlers();
    this.model.atLeast({ percent: 0, mode: "grid", interval: 300, filename: this.mget("name") || "" });
    const loader = this.mget("loader");
    if (loader && typeof loader.addListener === "function") {
      loader.addListener(this);
      this._mouseEvt = loader.mouseEvt;
    }
  }

  onDomRefresh() {
    this.feed(progressSkeleton(this));
  }

  onPartReady(child, name) {
    if (name !== "ref-chart") return;
    child.el.innerHTML = this.mget("mode") === "row"
      ? `<div class="${this.fig.family}__bar"><div class="${this.fig.family}__bar--bg"></div><div id="${this._id}-fg" class="${this.fig.family}__bar--fg"></div></div>`
      : `<svg viewBox="0 0 200 200" class="circular-chart"><circle class="${this.fig.family}__chart--bg" cx="100" cy="95" r="80" stroke-dashoffset="0" stroke-dasharray="502.4"></circle><circle id="${this._id}-fg" class="${this.fig.family}__chart--fg" cx="95" cy="90" r="80" stroke-dashoffset="${arcLength(this.mget("percent"))}" stroke-dasharray="502.4" transform="rotate(270, 100, 90)"></circle><circle class="${this.fig.family}__chart--inner" cx="100" cy="95" r="76"></circle></svg>`;
    this._progressElement = child.el.querySelector(`#${this._id}-fg`);
    this.update(this.mget("percent"));
  }

  _setPart(name, content) {
    const part = this.getPart(name);
    if (part && typeof part.set === "function") part.set("content", content);
  }

  update(value) {
    const raw = value && typeof value === "object"
      ? 100 * Number(value.loaded || 0) / Number(value.total || 0)
      : Number(value);
    const percent = Math.max(0, Math.min(100, Number.isFinite(raw) ? Math.ceil(raw) : 0));
    this.mset("percent", percent);
    if (this._progressElement) {
      if (this.mget("mode") === "row") this._progressElement.style.width = `${percent}%`;
      else this._progressElement.style.strokeDashoffset = arcLength(percent);
    }
    this._setPart("ref-percent", `${percent}%`);
    if (value && typeof value === "object" && value.total != null) {
      const formatter = this.mget("formatSize");
      this._setPart("ref-filesize", typeof formatter === "function" ? formatter(value.total) : String(value.total));
    }
    this._cursor = percent;
    return percent;
  }

  setLabel(label) {
    this.mset("filename", label);
    this._setPart("ref-filename", label);
  }

  onUploadProgress(event, total) {
    if (!event) return;
    const resolvedTotal = event.lengthComputable ? event.total : total;
    if (Number.isFinite(resolvedTotal) && resolvedTotal > 0) this.update({ loaded: event.loaded, total: resolvedTotal });
  }

  tick() {
    if (this.isDestroyed && this.isDestroyed()) return;
    this.update((this._cursor || 0) + 1);
    this._tickTimer = setTimeout(() => this.tick(), this.mget("interval"));
  }

  onBeforeDestroy() {
    clearTimeout(this._tickTimer);
  }

  onUiEvent(command) {
    const service = command && (typeof command.get === "function" ? command.get("service") || command.get("name") : command.service || command.name);
    if (service === "cancel") this.trigger("cancel", this);
  }
}

class LetcMenuTopic extends LetcBox {
  static figName = "menu_topic";

  initialize(options = {}) {
    super.initialize(options);
    this.declareHandlers({ part: "multiple", ui: "multiple" });
    this.model.atLeast({ flow: "x", motion: "none", persistence: "toggle", opening: "click", axis: "y", direction: "down", state: 0 });
  }

  // The source menu's generic state transition is retained; Team navigation,
  // global radio channels and desktop geometry are not bootstrap concerns.
  onUiEvent() {
    this.model.set("state", this.mget("state") ? 0 : 1);
    this.el.dataset.state = this.mget("state");
    this.trigger("menu:toggle", this);
  }
}

class LetcRichText extends LetcText {
  static figName = "text_editable";

  initialize(options = {}) {
    super.initialize(options);
    this.model.atLeast({ interactive: false, html: false, content: this.mget("content") || "" });
  }

  // Adapted from widgets/text/editable/index.js::onDomRefresh. Editing is
  // genuine browser contenteditable behaviour; MFS paste-file dispatch and
  // application service policy remain outside the bootstrap kernel.
  onDomRefresh() {
    const content = this.mget("content") || "";
    const editable = this.mget("interactive") || this.mget("mode") === "interactive";
    this.el.innerHTML = `<div id="${this._id}" class="${this.fig.family} inner note-content" ${editable ? "contenteditable=\"true\"" : ""}></div>`;
    this.content = this.el.querySelector(`#${this._id}`);
    if (this.mget("html")) this.content.innerHTML = content;
    else this.content.innerText = content;
    this.content.addEventListener("input", () => {
      const text = this.content.innerText;
      this.model.set("content", text);
      this.trigger("interactive", { text });
    });
  }

  getText() {
    return this.content ? this.content.innerText : "";
  }
}

const sourceIdentity = Object.freeze({
  LetcBlank: "sources/ui-core/letc/widgets/blank/index.js",
  LetcBox: "sources/ui-core/letc/widgets/box/index.js",
  LetcEntry: "sources/ui-core/letc/widgets/entry/input/index.js",
  LetcEntryReminder: "sources/ui-core/letc/widgets/entry/reminder/index.js",
  LetcFileSelector: "sources/ui-core/letc/widgets/file-selector/index.js",
  LetcImageSmart: "sources/ui-core/letc/widgets/image/smart/index.js",
  LetcList: "sources/ui-core/letc/widgets/list/{index.js,smart/index.js}",
  LetcMenuTopic: "sources/ui-core/letc/widgets/menu/index.js",
  LetcProfile: "sources/ui-core/letc/widgets/profile/{index.js,skeleton/index.js,templates/avatar.js,skin/index.scss}",
  LetcProgress: "sources/ui-core/letc/widgets/progress/media/{index.js,skeleton/{grid.js,row.js},template/{grid.js,row.js},skin/{grid.scss,row.scss}}",
  LetcRichText: "sources/ui-core/letc/widgets/text/editable/index.js",
  LetcSvgImage: "sources/ui-core/letc/widgets/image/svg/index.js",
  LetcText: "sources/ui-core/letc/widgets/text/index.js"
});

module.exports = {
  LetcBlank,
  LetcBox,
  LetcEntry,
  LetcEntryReminder,
  LetcFileSelector,
  LetcImageSmart,
  LetcList,
  LetcMenuTopic,
  LetcProfile,
  LetcProgress,
  LetcRichText,
  LetcSvgImage,
  LetcTable,
  LetcText,
  sourceIdentity
};
