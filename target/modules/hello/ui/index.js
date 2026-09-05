// The plugin bundle runs only after ui-runtime has published its READY-gated
// globals. This mirrors the normal CommonJS Drumee plugin registration shape.
const HelloWidget = require("./widget");

Kind.registerAddons({ hello: HelloWidget });
