#!/usr/bin/env node
// Rebuild bin/js/src/sure.js from Sure.api.export via the current CLI + vendored FormCore.
// Atomic write. Stage-two compares the prepare-hook injection (idempotent).
// Full compile-twice fixed-point is not in CI: Sure.api.export is unbounded.

var {spawnSync} = require("child_process");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var sure_path = path.join(__dirname, "js/src/sure.js");
var cli = path.join(__dirname, "js/src/main.js");
var node = process.execPath;

function inject_prepare(js) {
  js = String(js || "");
  if (js.indexOf("__surePrepare") >= 0) return js;
  var hook = "if(typeof globalThis.__surePrepare==='function'){_code$2=globalThis.__surePrepare(_file$1,_code$2);}";
  var needle = "function Kind$Defs$read$(_file$1,_code$2){";
  var i = js.indexOf(needle);
  if (i < 0) {
    needle = "function Sure$Defs$read$(_file$1,_code$2){";
    i = js.indexOf(needle);
  }
  if (i < 0) return js;
  return js.slice(0, i + needle.length) + hook + js.slice(i + needle.length);
}

function check_only() {
  var src = fs.readFileSync(sure_path, "utf8");
  if (src.length < 1000) {
    console.error("bootstrap --check: sure.js too small");
    process.exit(1);
  }
  var once = inject_prepare(src);
  var twice = inject_prepare(once);
  if (once !== twice) {
    console.error("bootstrap --check: prepare hook is not idempotent");
    process.exit(1);
  }
  var self = fs.readFileSync(__filename, "utf8");
  if (self.indexOf("spawnSync(node, [") < 0) {
    console.error("bootstrap --check: must spawn argv via spawnSync(node, [...])");
    process.exit(1);
  }
  if (self.indexOf("process.execPath") < 0) {
    console.error("bootstrap --check: must use process.execPath");
    process.exit(1);
  }
  console.log("bootstrap ok (hook idempotent, " + src.length + " bytes)");
}

if (process.argv.indexOf("--check") >= 0) {
  check_only();
  process.exit(0);
}

console.log("Generating sure.js from Sure.api.export");
var r = spawnSync(node, ["--stack-size=10000", cli, "Sure.api.export", "--js", "--module"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
  env: Object.assign({}, process.env, {
    SURE_BASE: path.join(root, "base"),
    KIND_BASE: path.join(root, "base"),
  }),
});
if (r.error) {
  console.error("bootstrap failed to spawn: " + r.error.message);
  process.exit(1);
}
if (r.status) {
  console.error("bootstrap failed; leaving existing sure.js in place");
  console.error(String(r.stderr || r.stdout || "").slice(0, 500));
  process.exit(r.status);
}
var js = String(r.stdout || "");
if (js.indexOf("Compilation error") === 0 || js.length < 1000) {
  console.error("bootstrap failed; leaving existing sure.js in place");
  console.error(js.slice(0, 500));
  process.exit(1);
}

var with_hook = inject_prepare(js);
var again = inject_prepare(with_hook);
if (with_hook !== again) {
  console.error("bootstrap: prepare hook is not a fixed point");
  process.exit(1);
}

var dir = path.dirname(sure_path);
var tmp = path.join(dir, "sure.js." + process.pid + ".tmp");
fs.writeFileSync(tmp, with_hook);
fs.renameSync(tmp, sure_path);
console.log("wrote " + sure_path + " (" + with_hook.length + " bytes)");
