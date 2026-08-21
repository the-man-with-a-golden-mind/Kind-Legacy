#!/usr/bin/env node
"use strict";
var fs = require("fs");
var path = require("path");
var schema = require("../../../vendor/formcore-js/host-schema.js");

var destEnc = path.resolve(__dirname, "../../../base/Host/encode.sure");
var destDec = path.resolve(__dirname, "../../../base/Host/decode.sure");
var generatedEnc = schema.encodeSure();
var generatedDec = schema.decodeSure();

if (process.argv.indexOf("--check") >= 0) {
  var enc = fs.readFileSync(destEnc, "utf8");
  var dec = fs.readFileSync(destDec, "utf8");
  if (enc !== generatedEnc) {
    console.error("Host.encode.sure is stale. Run: node bin/js/src/gen-host.js");
    process.exit(1);
  }
  if (dec !== generatedDec) {
    console.error("Host.decode.sure is stale. Run: node bin/js/src/gen-host.js");
    process.exit(1);
  }
  process.exit(0);
}

fs.writeFileSync(destEnc, generatedEnc);
fs.writeFileSync(destDec, generatedDec);
console.log("wrote " + destEnc);
console.log("wrote " + destDec);
