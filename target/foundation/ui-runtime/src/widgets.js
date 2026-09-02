class WidgetModel {
  constructor(attributes = {}) {
    this.attributes = { ...attributes };
  }

  get(name) {
    return this.attributes[name];
  }

  set(name, value) {
    if (name && typeof name === "object") Object.assign(this.attributes, name);
    else this.attributes[name] = value;
    return this;
  }

  atLeast(attributes = {}) {
    for (const [name, value] of Object.entries(attributes)) {
      if (this.attributes[name] === undefined) this.attributes[name] = value;
    }
    return this;
  }

  toJSON() {
    return { ...this.attributes };
  }
}

function normalizeDescriptors(descriptors) {
  if (!descriptors) return [];
  return Array.isArray(descriptors) ? descriptors.filter(Boolean) : [descriptors];
}

class LetcWidget {
  constructor(options = {}) {
    if (!options.runtime) throw new Error("A LETC Widget requires a runtime");
    this.runtime = options.runtime;
    this.model = new WidgetModel(options);
    this.fig = options.fig || { family: options.family || this.constructor.figName || "letc_widget" };
    this.children = [];
    this.el = null;
    this.initialize(options);
  }

  initialize() {}

  declareHandlers() {}

  mget(name) {
    return this.model.get(name);
  }

  mset(name, value) {
    return this.model.set(name, value);
  }

  tagName() {
    return "div";
  }

  applyAttributes() {
    const className = this.mget("className");
    if (className) this.el.className = className;
    const flow = this.mget("flow");
    if (flow) this.el.dataset.flow = flow;
    const style = this.mget("styleOpt");
    if (style && typeof style === "object") Object.assign(this.el.style, style);
    const sysPn = this.mget("sys_pn");
    if (sysPn) this.el.dataset.sysPn = sysPn;
  }

  render(parent) {
    if (!parent || typeof parent.appendChild !== "function") {
      throw new Error("A LETC Widget requires a DOM parent");
    }
    this.el = this.runtime.document.createElement(this.tagName());
    this.el.dataset.kind = this.mget("kind") || "";
    this.applyAttributes();
    parent.appendChild(this.el);
    this.onDomRefresh();
    return this;
  }

  onDomRefresh() {}

  feed(descriptors) {
    for (const descriptor of normalizeDescriptors(descriptors)) {
      const child = this.runtime.createWidget(descriptor);
      child.render(this.el);
      this.children.push(child);
    }
    return this.children[this.children.length - 1] || null;
  }
}

class LetcBlank extends LetcWidget {
  onDomRefresh() {
    const content = this.mget("content");
    if (content !== undefined && content !== null) this.el.textContent = String(content);
  }
}

class LetcBox extends LetcWidget {
  initialize(options = {}) {
    this.model.atLeast({ flow: "x", kids: [] });
    super.initialize(options);
  }

  onDomRefresh() {
    this.feed(this.mget("kids"));
  }
}

class LetcList extends LetcBox {
  onDomRefresh() {
    this.el.setAttribute("role", "list");
    super.onDomRefresh();
  }
}

class LetcText extends LetcBlank {
  initialize(options = {}) {
    this.model.atLeast({ content: this.mget("value") || this.mget("label") || "" });
    super.initialize(options);
  }
}

class LetcSvgImage extends LetcBlank {
  onDomRefresh() {
    const chartId = this.mget("chartId") || this.mget("ico") || this.mget("content") || "";
    this.el.dataset.chartId = chartId;
    this.el.setAttribute("aria-label", chartId);
  }
}

class LetcEntry extends LetcWidget {
  tagName() {
    return this.mget("type") === "textarea" ? "textarea" : "input";
  }

  onDomRefresh() {
    if (this.el.tagName.toLowerCase() === "input") this.el.type = this.mget("type") || "text";
    this.el.autocomplete = this.mget("autocomplete") || "off";
    this.el.value = this.mget("value") || "";
    this.el.placeholder = this.mget("placeholder") || "";
  }
}

class LetcFileSelector extends LetcEntry {
  initialize(options = {}) {
    this.model.set({ type: "file", ...options });
    super.initialize(options);
  }
}

module.exports = {
  LetcBlank,
  LetcBox,
  LetcEntry,
  LetcFileSelector,
  LetcList,
  LetcSvgImage,
  LetcText,
  LetcWidget,
  WidgetModel
};
