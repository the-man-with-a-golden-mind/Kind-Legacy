#!/usr/bin/env node
// Rebuild bin/js/src/sure.js from Kind source via the current CLI + vendored FormCore.
// Does not git-checkout the previous blob (that would drop host-op patches).
// FormCore's FmcToJs (vendor/) is the source of the JS IO runtime in the new blob.

var {execSync} = require("child_process");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var sure_path = path.join(__dirname, "js/src/sure.js");
var cli = path.join(__dirname, "js/src/main.js");

console.log("Generating sure.js from Sure.api.export");
var cmd = "node --stack-size=10000 " + JSON.stringify(cli) + " Sure.api.export --js --module";
var js = execSync(cmd, {
  cwd: root,
  maxBuffer: 256 * 1024 * 1024,
  env: Object.assign({}, process.env, {
    SURE_BASE: path.join(root, "base"),
    KIND_BASE: path.join(root, "base"),
  }),
}).toString();

if (js.indexOf("Compilation error") === 0 || js.length < 1000) {
  console.error("bootstrap failed; leaving existing sure.js in place");
  console.error(js.slice(0, 500));
  process.exit(1);
}

fs.writeFileSync(sure_path, js);
console.log("wrote " + sure_path + " (" + js.length + " bytes)");
