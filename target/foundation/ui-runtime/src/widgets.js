/*
 * Selective, non-MFS LETC Widget extraction.
 *
 * The classes below retain the historical Marionette ancestry and lifecycle
 * (`initialize`, `onDomRefresh`, `feed`, `onUiEvent`) from ui-core. They are
 * adapted only at seams that called MFS, Team routing, browser radios, or the
 * legacy `KIND` constants.
 */
const createDOMPurify = require("dompurify");
const { ATTR, LetcBox, LetcView, _ } = require("./letc");

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
  LetcRichText,
  LetcSvgImage,
  LetcTable,
  LetcText,
  sourceIdentity
};
