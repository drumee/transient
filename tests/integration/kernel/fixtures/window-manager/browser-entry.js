const runtime_api = require("../../../../../target/foundation/ui-runtime/src/browser");
const window_manager_api = require("@drumee/window-manager/browser");

window.Phase47Ready = runtime_api.bootstrap().then((runtime) => {
  const workspace = document.getElementById("workspace");
  const events = { drag_stop: 0, resize_stop: 0, over: 0, out: 0, drop: 0, payload: null };
  const manager = window_manager_api.createWindowManager({
    workspace,
    runtime,
    jquery: runtime_api.Backbone.$
  });
  const content = (name) => {
    const root = document.createElement("div");
    root.className = `window-content window-content--${name.toLowerCase()}`;
    return root;
  };
  const a_content = content("A");
  const b_content = content("B");
  const c_content = content("C");
  const a = manager.open({
    window_id: "window-a", title: "Window A", geometry: { left: 120, top: 80, width: 360, height: 250 },
    content: a_content,
    droppable: {
      accept: ".generic-token", tolerance: "pointer",
      over: () => events.over++, out: () => events.out++,
      drop: (context) => { events.drop++; events.payload = context.payload; }
    }
  });
  const b = manager.open({
    window_id: "window-b", title: "Window B", geometry: { left: 520, top: 90, width: 330, height: 230 },
    min_width: 280, min_height: 190, content: b_content, droppable: false
  });
  const c = manager.open({
    window_id: "window-c", title: "Window C", geometry: { left: 300, top: 380, width: 340, height: 220 },
    content: c_content
  });
  runtime.mount(runtime.Skeletons.Note({ content: "LETC Window A" }), a_content);
  runtime.mount(runtime.Skeletons.Note({ content: "LETC Window B" }), b_content);
  runtime.mount(runtime.Skeletons.Note({ content: "LETC Window C" }), c_content);
  a.on("drag:stop", () => events.drag_stop++);
  b.on("resize:stop", () => events.resize_stop++);
  const token = document.getElementById("token");
  const $token = runtime_api.Backbone.$(token);
  $token.data("drumee_payload", { type: "generic-token", id: 47 });
  $token.draggable({ distance: 1, scroll: false });
  window.phase47 = { runtime, manager, a, b, c, token, events, closed_b: null };
  document.body.dataset.ready = "true";
  document.body.dataset.runtime_ready = String(runtime.isReady);
  document.body.dataset.jquery_shared = String(manager.jquery === runtime_api.Backbone.$ && window.jQuery === runtime_api.Backbone.$);
  return window.phase47;
}).catch((error) => {
  document.body.dataset.error = error.stack || String(error);
  throw error;
});
