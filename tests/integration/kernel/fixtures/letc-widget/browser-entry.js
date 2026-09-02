const runtimeApi = require("../../../../../target/foundation/ui-runtime/src/browser");

globalThis.Phase26WidgetReady = runtimeApi.bootstrap().then((runtime) => {
  const Phase26Widget = require("./index");
  runtime.Kind.registerAddons({ phase26_widget: Phase26Widget });
  runtime.mount({ kind: "phase26_widget", fig: { family: "phase26-widget" } }, document.getElementById("widget-root"));
  return runtime;
});
