"use strict";
// RFC 6455 client frames (masked) and a one-frame parser. Empty payload is valid.

function ws_mask_frame(payload, mask) {
  var data = Buffer.from(String(payload == null ? "" : payload), "utf8");
  mask = mask && mask.length === 4 ? Buffer.from(mask) : require("crypto").randomBytes(4);
  var len = data.length;
  var hdr = 2 + (len < 126 ? 0 : len < 65536 ? 2 : 8) + 4;
  var buf = Buffer.alloc(hdr + len);
  buf[0] = 0x81;
  var o = 2;
  if (len < 126) buf[1] = 0x80 | len;
  else if (len < 65536) { buf[1] = 0x80 | 126; buf.writeUInt16BE(len, 2); o = 4; }
  else { buf[1] = 0x80 | 127; buf.writeBigUInt64BE(BigInt(len), 2); o = 10; }
  mask.copy(buf, o); o += 4;
  for (var i = 0; i < len; i++) buf[o + i] = data[i] ^ mask[i & 3];
  return buf;
}

function ws_take_frame(rec) {
  var buf = rec.buf || Buffer.alloc(0);
  if (buf.length < 2) return null;
  var b0 = buf[0], b1 = buf[1];
  var opcode = b0 & 15;
  var masked = (b1 & 0x80) !== 0;
  var len = b1 & 127;
  var o = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); o = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); o = 10; }
  var mlen = masked ? 4 : 0;
  if (buf.length < o + mlen + len) return null;
  var mask = masked ? buf.slice(o, o + 4) : null;
  o += mlen;
  var payload = Buffer.alloc(len);
  for (var i = 0; i < len; i++) payload[i] = buf[o + i] ^ (mask ? mask[i & 3] : 0);
  rec.buf = buf.slice(o + len);
  if (opcode === 8) return {close: true, text: ""};
  if (opcode === 9) return {ping: true, text: ""};
  return {text: payload.toString("utf8")};
}

function ws_handshake_request(url, key) {
  var u;
  try { u = new URL(String(url || "")); }
  catch (e) { return ""; }
  key = String(key || "");
  return "GET " + (u.pathname || "/") + (u.search || "") + " HTTP/1.1\r\nHost: " + u.host +
    "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: " + key +
    "\r\nSec-WebSocket-Version: 13\r\n\r\n";
}

function ws_handshake_ok(http) {
  return /HTTP\/1\.[01]\s+101\b/i.test(String(http || "")) &&
    /upgrade:\s*websocket/i.test(String(http || "")) &&
    /connection:\s*upgrade/i.test(String(http || ""));
}

module.exports = {
  ws_mask_frame: ws_mask_frame,
  ws_take_frame: ws_take_frame,
  ws_handshake_request: ws_handshake_request,
  ws_handshake_ok: ws_handshake_ok
};
