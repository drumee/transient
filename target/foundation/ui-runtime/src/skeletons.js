const { LetcBlank, LetcBox, LetcEntry, LetcFileSelector, LetcList, LetcSvgImage, LetcText } = require("./widgets");

function properties(props) {
  if (typeof props === "string") return { content: props, className: "" };
  return { ...(props || {}) };
}

function descriptor(kind, props, style) {
  const result = { ...properties(props), kind };
  if (style && typeof style === "object") result.styleOpt = { ...(result.styleOpt || {}), ...style };
  return result;
}

function iconDescriptor(props, style) {
  const result = properties(props);
  if (result.ico && !result.chartId) result.chartId = result.ico;
  delete result.ico;
  return descriptor("image_svg", result, style);
}

function avatar(source = "", className = "", name = "") {
  const hash = String(name).split("").reduce((total, character) => ((total << 5) - total) + character.charCodeAt(0), 0);
  return descriptor("note", {
    className,
    styleOpt: /default/.test(source)
      ? { backgroundColor: `hsl(${hash % 360}, 40%, 60%)` }
      : { backgroundImage: `url(${source})` }
  });
}

function box(flow) {
  return (props, style) => descriptor("box", { ...properties(props), flow }, style);
}

function list(kind) {
  return (props, style) => descriptor(kind, {
    vendorOpt: {
      alwaysVisible: true,
      size: "2px",
      opacity: "1",
      color: "#FA8540",
      distance: "2px",
      railColor: "#E5E5E5",
      ...(properties(props).vendorOpt || {})
    },
    ...properties(props)
  }, style);
}

function wrapper(flow) {
  return (props, style) => {
    const result = properties(props);
    result.flow = flow;
    result.className = `${result.className || ""} dialog__wrapper`.trim();
    result.name = result.name || "dialog";
    result.sys_pn = result.sys_pn || `wrapper-${result.name}`;
    return descriptor("box", result, style);
  };
}

const Skeletons = Object.freeze({
  Avatar: avatar,
  Box: Object.freeze({ G: box("g"), X: box("x"), Y: box("y"), Z: box("none") }),
  Button: Object.freeze({ Icon: iconDescriptor, Label: iconDescriptor, Svg: iconDescriptor }),
  Element: (props, style) => descriptor("wrapper", props, style),
  FileSelector: (props, style) => descriptor("fileselector", { ...properties(props), sys_pn: "fileselector" }, style),
  Entry: (props, style) => descriptor("entry", { autocomplete: "off", ...properties(props) }, style),
  Image: Object.freeze({ Svg: iconDescriptor }),
  List: Object.freeze({ Scroll: list("list_smart"), Smart: list("list_smart"), Table: list("list_table") }),
  Note: (props, style) => descriptor("note", props, style),
  Textarea: (props, style) => descriptor("entry", { autocomplete: "off", type: "textarea", ...properties(props) }, style),
  Wrapper: Object.freeze({ X: wrapper("x"), Y: wrapper("y") })
});

const staticKinds = Object.freeze({
  box: LetcBox,
  entry: LetcEntry,
  fileselector: LetcFileSelector,
  image_svg: LetcSvgImage,
  list_smart: LetcList,
  list_table: LetcList,
  note: LetcText,
  wrapper: LetcBlank
});

const retainedSkeletonCatalog = Object.freeze({
  Avatar: { build: () => Skeletons.Avatar("default", "avatar", "Kernel"), kinds: ["note"] },
  "Box.G": { build: () => Skeletons.Box.G(), kinds: ["box"] },
  "Box.X": { build: () => Skeletons.Box.X(), kinds: ["box"] },
  "Box.Y": { build: () => Skeletons.Box.Y(), kinds: ["box"] },
  "Box.Z": { build: () => Skeletons.Box.Z(), kinds: ["box"] },
  "Button.Icon": { build: () => Skeletons.Button.Icon({ ico: "kernel" }), kinds: ["image_svg"] },
  "Button.Label": { build: () => Skeletons.Button.Label({ ico: "kernel" }), kinds: ["image_svg"] },
  "Button.Svg": { build: () => Skeletons.Button.Svg({ ico: "kernel" }), kinds: ["image_svg"] },
  Element: { build: () => Skeletons.Element("kernel"), kinds: ["wrapper"] },
  FileSelector: { build: () => Skeletons.FileSelector(), kinds: ["fileselector"] },
  Entry: { build: () => Skeletons.Entry(), kinds: ["entry"] },
  "Image.Svg": { build: () => Skeletons.Image.Svg({ ico: "kernel" }), kinds: ["image_svg"] },
  "List.Scroll": { build: () => Skeletons.List.Scroll(), kinds: ["list_smart"] },
  "List.Smart": { build: () => Skeletons.List.Smart(), kinds: ["list_smart"] },
  "List.Table": { build: () => Skeletons.List.Table(), kinds: ["list_table"] },
  Note: { build: () => Skeletons.Note("kernel"), kinds: ["note"] },
  Textarea: { build: () => Skeletons.Textarea(), kinds: ["entry"] },
  "Wrapper.X": { build: () => Skeletons.Wrapper.X(), kinds: ["box"] },
  "Wrapper.Y": { build: () => Skeletons.Wrapper.Y(), kinds: ["box"] }
});

module.exports = { Skeletons, retainedSkeletonCatalog, staticKinds };
