#!/usr/bin/env node
"use strict";
var fs = require("fs");
var path = require("path");
var schema = require("../../../vendor/formcore-js/host-schema.js");

var dest = path.resolve(__dirname, "../../../base/Host/encode.sure");
var generated = schema.encodeSure();

if (process.argv.indexOf("--check") >= 0) {
  var on_disk = fs.readFileSync(dest, "utf8");
  if (on_disk !== generated) {
    console.error("Host.encode.sure is stale. Run: node bin/js/src/gen-host.js");
    process.exit(1);
  }
  process.exit(0);
}

fs.writeFileSync(dest, generated);
console.log("wrote " + dest);
