const fs = require("fs");
const path = require("path");
const webpack = require("/opt/kernel/ui-build/node_modules/webpack");
const { createConfig } = require("/opt/kernel/ui-build/lib");

const outputPath = "/opt/kernel/hello-artifact";
const coreMetadata = require("/opt/kernel/ui-artifact/index.json");
const config = createConfig({
  root: "/opt/kernel/hello/ui",
  name: "hello",
  type: "plugin",
  entry: "./index.js",
  outputPath,
  publicPath: "/-/plugins/hello/",
  version: require("/opt/kernel/hello/package.json").version,
  rev: process.env.KERNEL_BUILD_REV || "phase3",
  loaderRoots: ["/opt/kernel/ui-build/node_modules"],
  moduleRoots: ["/opt/kernel/ui-runtime/node_modules", "/opt/kernel/ui-build/node_modules"]
});

webpack(config, (error, stats) => {
  if (error) throw error;
  if (stats.hasErrors()) throw new Error(stats.toString({ all: false, errors: true }));
  const metadata = require(path.join(outputPath, "index.json"));
  if (!metadata.hash || !metadata.entry) throw new Error("hello build metadata is incomplete");
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>Drumee kernel hello</title></head><body><main id="hello-root"></main><script>window.onerror=function(message,source,line,column){document.body.dataset.browserError=[message,line,column].join(":");};</script><script src="/-/plugins/ui-runtime/${coreMetadata.entry}"></script><script>window.DrumeeUiRuntime.bootstrap().then(function(runtime){document.body.dataset.ready=String(runtime.isReady);document.body.dataset.kindBefore=String(runtime.Kind.exists("hello"));return runtime.Kind.loadPlugin({name:"hello",kind:"hello"}).then(function(HelloWidget){document.body.dataset.kindAfter=String(runtime.Kind.exists("hello"));document.body.dataset.widgetParent=String(HelloWidget.prototype instanceof window.DrumeeUiRuntime.LetcBox);var widget=runtime.mount({kind:"hello"},document.getElementById("hello-root"));return widget._pingPromise.then(function(reply){document.body.dataset.replyModule=reply.module;document.body.dataset.replyOk=String(reply.ok);document.body.dataset.finalStatus=widget.mget("status");});});}).catch(function(error){document.body.dataset.browserError=String(error);});</script></body></html>`;
  fs.writeFileSync(path.join(outputPath, "probe.html"), `${page}\n`);
  const pushPage = `<!doctype html><html><head><meta charset="utf-8"><title>Drumee kernel hello push</title></head><body><main id="hello-root"></main><script>window.onerror=function(message,source,line,column){document.body.dataset.browserError=[message,line,column].join(":");};</script><script src="/-/plugins/ui-runtime/${coreMetadata.entry}"></script><script>(async function(){try{var password=decodeURIComponent(window.location.hash.slice(1));if(!password)throw new Error("Phase 4 fixture password fragment is required");var runtime=await window.DrumeeUiRuntime.bootstrap();runtime.Websocket.on("state",function(state){document.body.dataset.socketState=state;});runtime.Websocket.on("connected",function(){document.body.dataset.socketHello="true";});runtime.Websocket.on("error",function(){document.body.dataset.socketError="true";});var login=await runtime.serviceClient.postService("yp.signin",{uid:"phase4-auth@kernel.test",password:password});document.body.dataset.login=String(login.authenticated);await runtime.Websocket.connect();document.body.dataset.socket=String(runtime.Websocket.state);var HelloWidget=await runtime.Kind.loadPlugin({name:"hello",kind:"hello"});document.body.dataset.widgetParent=String(HelloWidget.prototype instanceof window.DrumeeUiRuntime.LetcBox);var widget=runtime.mount({kind:"hello"},document.getElementById("hello-root"));await widget._pingPromise;var pushed=new Promise(function(resolve,reject){widget.once("hello:push",resolve);widget.push().catch(reject);});await pushed;document.body.dataset.pushStatus=widget.mget("status");document.body.dataset.socketId=runtime.Websocket.socketId||"";}catch(error){document.body.dataset.browserError=String(error);}})();</script></body></html>`;
  fs.writeFileSync(path.join(outputPath, "push-probe.html"), `${pushPage}\n`);
});
