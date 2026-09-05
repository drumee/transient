/*
 * Literal-kind, CJS adaptation of ui-core/letc/toolkit/{core,builder}.js and
 * its public skeleton builders. `KIND.*` lookups are intentionally replaced
 * with their exact historical string values.
 */
const {
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
  LetcText
} = require("./widgets");

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

class CoreSkeleton {
  constructor(props = {}, style) {
    this.props = typeof props === "string" ? { content: props, className: "" } : { ...(props || {}) };
    this.style = style;
  }

  // Exact responsibility of toolkit/core.js::render, with only historical
  // global constants replaced by their string values.
  render() {
    const result = {};
    for (const [key, value] of Object.entries(this.props)) {
      switch (key) {
        case "ui": result.uiHandler = value; break;
        case "part": result.partHandler = value; break;
        case "api": result.api = typeof value === "string" ? { service: value } : value; break;
        case "cn": result.className = typeof value === "string" ? value : String(value || ""); break;
        case "item": result.itemsOpt = value; break;
        default: result[key] = value;
      }
    }
    if (result.handler) result.signal = "ui:event";
    result.className = result.className || "";
    if (this.style && isObject(this.style)) result.styleOpt = { ...(result.styleOpt || {}), ...this.style };
    return result;
  }
}

class SkeletonBuilder extends CoreSkeleton {
  // Retains builder.js's descriptor merge and minimal `kidsOpt` behaviour.
  render(options = {}) {
    const result = { ...super.render(), ...options };
    if (isObject(result.kidsOpt) && Array.isArray(result.kids)) {
      result.kids = result.kids.map((kid) => ({ ...kid, ...result.kidsOpt }));
    }
    return result;
  }
}

class AvatarBuilder {
  constructor(source, className, name) {
    this.source = source;
    this.className = className;
    this.name = name;
  }

  color(saturation = 40, lightness = 60) {
    let hash = 0;
    for (const character of String(this.name || "")) hash = character.charCodeAt(0) + (hash << 5) - hash;
    return { kind: "note", className: this.className || "", styleOpt: { backgroundColor: `hsl(${hash % 360}, ${saturation}%, ${lightness}%)` } };
  }

  render() {
    return { kind: "note", className: this.className || "", styleOpt: { backgroundImage: `url(${this.source})` } };
  }
}

class IconBuilder extends SkeletonBuilder {
  constructor(props, style) {
    super(props, style || { width: "40px", height: "40px", padding: "10px" });
    this.props.chartId = this.props.ico;
    delete this.props.ico;
  }
}

class LabelBuilder extends SkeletonBuilder {
  constructor(props, style) {
    super(props, style);
    if (this.props.ico) {
      this.props.chartId = this.props.ico;
      delete this.props.ico;
    }
  }
}

class SmartListBuilder extends CoreSkeleton {
  render() {
    const vendorOpt = {
      alwaysVisible: true,
      size: "2px",
      opacity: "1",
      color: "#FA8540",
      distance: "2px",
      railColor: "#E5E5E5",
      ...(this.props.vendorOpt || {})
    };
    return { ...super.render(), kind: "list_smart", vendorOpt };
  }
}

class TableListBuilder extends CoreSkeleton {
  render() {
    return {
      ...super.render(),
      kind: "list_table",
      vendorOpt: { alwaysVisible: true, size: "2px", opacity: "1", color: "#FA8540", distance: "2px", railColor: "#E5E5E5", ...(this.props.vendorOpt || {}) }
    };
  }
}

function withClassString(props, style) {
  const normalized = typeof props === "string" ? { content: props, className: "" } : props || {};
  if (typeof style === "string" && !normalized.className) return [normalized, { className: style }];
  return [normalized, style];
}

function box(flow) {
  return (props, style) => new SkeletonBuilder({ ...(props || {}), flow }, style).render({ kind: "box" });
}

function icon(props, style) {
  return new IconBuilder(props, style).render({ kind: "image_svg" });
}

function label(props, style) {
  return new LabelBuilder(props, style).render({ kind: "image_svg" });
}

function note(props, style) {
  const [normalized, normalizedStyle] = withClassString(props, style);
  const result = new SkeletonBuilder(normalized, normalizedStyle).render({ kind: "note" });
  return { ...result, content: result.content == null ? "" : result.content };
}

function element(props, style) {
  const [normalized, normalizedStyle] = withClassString(props, style);
  return new SkeletonBuilder(normalized, normalizedStyle).render({ kind: "wrapper" });
}

function entry(props, style) {
  return new SkeletonBuilder({ autocomplete: "off", ...(props || {}) }, style).render({ kind: "entry" });
}

function entryReminder(props, style) {
  return new SkeletonBuilder({ autocomplete: "off", ...(props || {}) }, style).render({ kind: "entry_reminder" });
}

function textarea(props, style) {
  return new SkeletonBuilder({ autocomplete: "off", type: "textarea", ...(props || {}) }, style).render({ kind: "entry" });
}

function imageSmart(props, style) {
  return new LabelBuilder(props, style).render({ kind: "image_smart" });
}

function imageSvg(props, style) {
  return new LabelBuilder(props, style).render({ kind: "image_svg" });
}

function fileSelector(props, style) {
  return new SkeletonBuilder(props, style).render({ kind: "fileselector", sys_pn: "fileselector" });
}

function menu(props, style) {
  return new SkeletonBuilder({ ...(props || {}), flow: "x" }, style).render({ kind: "menu_topic" });
}

function richText(props, style) {
  const [normalized, normalizedStyle] = withClassString(props, style);
  const result = new SkeletonBuilder(normalized, normalizedStyle).render({ kind: "rich_text" });
  return { ...result, content: result.content == null ? "" : result.content };
}

function wrapper(flow) {
  return (props, style) => {
    const normalized = { ...(props || {}), flow };
    normalized.className = `${normalized.className || ""} dialog__wrapper`.trim();
    const result = new SkeletonBuilder(normalized, style).render({ kind: "box", wrapper: 1 });
    result.name = result.name || "dialog";
    result.sys_pn = result.sys_pn || `wrapper-${result.name}`;
    return result;
  };
}

const Skeletons = Object.freeze({
  Avatar(source, className, name) {
    const avatar = new AvatarBuilder(source, className, name);
    return /default/.test(source || "") ? avatar.color() : avatar.render();
  },
  Box: Object.freeze({ G: box("g"), X: box("x"), Y: box("y"), Z: box("none") }),
  Button: Object.freeze({ Icon: icon, Label: label, Svg: label }),
  Element: element,
  Entry: entry,
  EntryBox: entryReminder,
  FileSelector: fileSelector,
  Image: Object.freeze({ Smart: imageSmart, Svg: imageSvg }),
  List: Object.freeze({
    Scroll(props, style) { return new SmartListBuilder(props, style).render(); },
    Smart(props, style) { return new SmartListBuilder(props, style).render(); },
    Table(props, style) { return new TableListBuilder(props, style).render(); }
  }),
  Menu: menu,
  Note: note,
  RichText: richText,
  Textarea: textarea,
  Wrapper: Object.freeze({ X: wrapper("x"), Y: wrapper("y") })
});

const staticKinds = Object.freeze({
  box: LetcBox,
  entry: LetcEntry,
  entry_reminder: LetcEntryReminder,
  fileselector: LetcFileSelector,
  image_smart: LetcImageSmart,
  image_svg: LetcSvgImage,
  list_smart: LetcList,
  list_table: LetcTable,
  menu_topic: LetcMenuTopic,
  note: LetcText,
  rich_text: LetcRichText,
  wrapper: LetcBlank
});

// Public, retained non-MFS catalog. The only historical public builders not
// present here are Messenger (Team product), Profile/UserProfile (MFS avatar
// and Team presence) and Progress (MFS upload-loader lifecycle).
const retainedSkeletonCatalog = Object.freeze({
  Avatar: { build: () => Skeletons.Avatar("default", "avatar", "Kernel"), kinds: ["note"], source: "toolkit/skeleton/avatar.js" },
  "Box.G": { build: () => Skeletons.Box.G(), kinds: ["box"], source: "toolkit/skeleton/box-g.js" },
  "Box.X": { build: () => Skeletons.Box.X(), kinds: ["box"], source: "toolkit/skeleton/box-x.js" },
  "Box.Y": { build: () => Skeletons.Box.Y(), kinds: ["box"], source: "toolkit/skeleton/box-y.js" },
  "Box.Z": { build: () => Skeletons.Box.Z(), kinds: ["box"], source: "toolkit/skeleton/box-z.js" },
  "Button.Icon": { build: () => Skeletons.Button.Icon({ ico: "kernel" }), kinds: ["image_svg"], source: "toolkit/skeleton/button/icon.js" },
  "Button.Label": { build: () => Skeletons.Button.Label({ ico: "kernel" }), kinds: ["image_svg"], source: "toolkit/skeleton/button/label.js" },
  "Button.Svg": { build: () => Skeletons.Button.Svg({ ico: "kernel" }), kinds: ["image_svg"], source: "toolkit/skeleton/button/svg.js" },
  Element: { build: () => Skeletons.Element("kernel"), kinds: ["wrapper"], source: "toolkit/skeleton/element.js" },
  Entry: { build: () => Skeletons.Entry(), kinds: ["entry"], source: "toolkit/skeleton/entry/input.js" },
  EntryBox: { build: () => Skeletons.EntryBox(), kinds: ["entry_reminder"], source: "toolkit/skeleton/entry/reminder.js" },
  FileSelector: { build: () => Skeletons.FileSelector(), kinds: ["fileselector"], source: "toolkit/skeleton/file-selector.js" },
  "Image.Smart": { build: () => Skeletons.Image.Smart({ src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" }), kinds: ["image_smart"], source: "toolkit/skeleton/image/smart.js" },
  "Image.Svg": { build: () => Skeletons.Image.Svg({ ico: "kernel" }), kinds: ["image_svg"], source: "toolkit/skeleton/image/svg.js" },
  "List.Scroll": { build: () => Skeletons.List.Scroll(), kinds: ["list_smart"], source: "toolkit/skeleton/list/smart.js" },
  "List.Smart": { build: () => Skeletons.List.Smart(), kinds: ["list_smart"], source: "toolkit/skeleton/list/smart.js" },
  "List.Table": { build: () => Skeletons.List.Table(), kinds: ["list_table"], source: "toolkit/skeleton/list/table.js" },
  Menu: { build: () => Skeletons.Menu(), kinds: ["menu_topic"], source: "toolkit/skeleton/menu.js" },
  Note: { build: () => Skeletons.Note("kernel"), kinds: ["note"], source: "toolkit/skeleton/note.js" },
  RichText: { build: () => Skeletons.RichText("kernel"), kinds: ["rich_text"], source: "toolkit/skeleton/rich-text.js" },
  Textarea: { build: () => Skeletons.Textarea(), kinds: ["entry"], source: "toolkit/skeleton/entry/textarea.js" },
  "Wrapper.X": { build: () => Skeletons.Wrapper.X(), kinds: ["box"], source: "toolkit/skeleton/wrapper-x.js" },
  "Wrapper.Y": { build: () => Skeletons.Wrapper.Y(), kinds: ["box"], source: "toolkit/skeleton/wrapper-y.js" }
});

const excludedSkeletonCatalog = Object.freeze({
  Messenger: { classification: "DEFER_TEAM", kind: "messenger", evidence: "sources/ui-team/src/drumee/builtins/messenger/index.js uses Team chat API, attachment/MFS and emoji assets" },
  Profile: { classification: "DEFER_MFS", kind: "profile", evidence: "sources/ui-core/letc/widgets/profile/index.js calls Visitor.avatar and Team presence/Window Manager state" },
  Progress: { classification: "DEFER_MFS", kind: "progress", evidence: "sources/ui-core/letc/widgets/progress/media/index.js binds upload loaders and media transfer lifecycle" },
  UserProfile: { classification: "DEFER_MFS", kind: "profile", evidence: "Alias of Profile in sources/ui-core/letc/toolkit/skeletons.js" }
});

module.exports = {
  CoreSkeleton,
  SkeletonBuilder,
  Skeletons,
  excludedSkeletonCatalog,
  retainedSkeletonCatalog,
  staticKinds
};
