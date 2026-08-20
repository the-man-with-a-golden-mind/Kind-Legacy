#!/usr/bin/env node
// Application-surface coverage. A public term is covered when a lemma or
// Test.suite mentions it. Exit 1 with --fail when below 90%.

const fs = require("fs");
const path = require("path");

const THRESHOLD = 90;
const SURFACE = {
  Host: 1, File: 1, Dir: 1, Path: 1, IO: 1, Http: 1, Net: 1, Proc: 1,
  Db: 1, JSON: 1, Parse: 1, Bytes: 1, Outcome: 1, Email: 1, Semver: 1,
  Compress: 1, Ffi: 1, Worker: 1, Task: 1, Regex: 1, Map: 1, Maybe: 1,
  Pair: 1, Either: 1, Result: 1, Time: 1, Date: 1, Bool: 1, List: 1,
  String: 1, Nat: 1, Sure: 1, Html: 1, Stream: 1, Queue: 1, Set: 1,
  Unit: 1, Equal: 1, Cmp: 1, Char: 1, Bits: 1, Crypto: 1,
};

function walk(dir, acc) {
  acc = acc || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".sure")) acc.push(p);
  }
  return acc;
}

function isHelper(name) {
  return (
    /\.(go|aux|tco|unpack|merge_pair)$/.test(name) ||
    name.indexOf(".go.") >= 0 ||
    name.indexOf(".aux.") >= 0 ||
    name.indexOf(".test.") >= 0 ||
    /Builder/.test(name) ||
    /\.(monad|functor|parser|serializer|deserializer|stringifier)$/.test(name) ||
    /\.(demo|view|update|subs|serve)$/.test(name)
  );
}

function isParked(name) {
  return (
    /^(ECDSA|U1024|U256|U128|U64|U32|U16|I256|I128|I64|I32|I16|I8|Int|F32|F64|Word|BBT|BitsMap|BitsSet|NatSet|GSet|GMap|PriorityQueue|Deserializer|Stringifier|Module|Dynamic|Fin|Random|Continuation|Trampoline|Refinement|Variadic|Array|ListMap|NatMap|U32Map|Sigma|Submonoid|Subset|The|Empty|Not|And|Or|Logic|Decidable|Functor|Monad|Monoid|Function|Lambda|Lex|DOM|Vector|U8_Vector|Parser|Kind|Example|Test|TestSuite|Prove|Main)/.test(name) ||
    name.indexOf("Crypto.Keccak") === 0 ||
    name.indexOf("Crypto.WOTS") === 0 ||
    name.indexOf("ECDSA") === 0 ||
    name.indexOf("Html.Counter") === 0 ||
    name.indexOf("Html.Echo") === 0 ||
    /^(Html\.(a|attr|button|div|form|h1|img|input|label|li|on|option|select|span|textarea|ul))$/.test(name) ||
    /^(IO\.(clear|exit|exit_with|print|put_string|prompt|get_line|init_udp|send_udp|recv_udp|stop_udp))$/.test(name) ||
    name.indexOf("Bits.") === 0 ||
    name.indexOf("Char.") === 0 ||
    name.indexOf("Nat.to_u") === 0 ||
    name.indexOf("Nat.to_word") === 0 ||
    name.indexOf("Nat.to_i") === 0 ||
    name.indexOf("Nat.to_f") === 0 ||
    name.indexOf("Nat.to_fin") === 0 ||
    name.indexOf("Nat.add_Var") === 0 ||
    name.indexOf("Nat.mul_Var") === 0 ||
    name.indexOf("String.concat_Var") === 0 ||
    name.indexOf("String.cons_Var") === 0 ||
    name.indexOf("String.conses") === 0 ||
    name.indexOf("Bool.Is") === 0 ||
    name.indexOf("Bool.elim") === 0 ||
    name.indexOf("Bool.notf") === 0 ||
    name.indexOf("Bool.equal.") === 0 ||
    name.indexOf("Nat.add.Monoid") === 0 ||
    name.indexOf("Nat.mul.Monoid") === 0 ||
    name.indexOf("Nat.induction") === 0 ||
    name.indexOf("Nat.one_neq_zero") === 0 ||
    name.indexOf("Nat.lcm.list") === 0 ||
    name.indexOf("Nat.hex.") === 0 ||
    name.indexOf("Nat.for.io") === 0 ||
    /^(Sure\.(Term|Parser|Synth|api|Comp|Defs|Def|Core|Error|Context|Name|Map|Status|Path|Binder|Ann|Code|Letter|Fmt|Json|Meta|Test)\b)/.test(name) ||
    /^(Sure\.Check\.(bind|monad|pure|value|none|result)\b)/.test(name) ||
    name === "Sure.Check" ||
    name.indexOf("Sure.Mod.") === 0 ||
    name.indexOf("Sure.Sheet.") === 0 ||
    name.indexOf("Sure.Tweeter.") === 0 ||
    name.indexOf("Sure.Ui.") === 0 ||
    name.indexOf("Nat.AddExp") === 0 ||
    name.indexOf("Nat.AlgExp") === 0 ||
    name.indexOf("Nat.Order") === 0 ||
    name.indexOf("String.hex.") === 0 ||
    name.indexOf("String.hexstring") === 0 ||
    name.indexOf("Char.parse") === 0 ||
    name.indexOf("Regex.read.") === 0 ||
    name.indexOf("List.sequenceA") === 0 ||
    name.indexOf("List.merge_sort") === 0 ||
    name === "Path.refl" ||
    name === "Bytes.hash.offset" ||
    name === "Bytes.hash.prime" ||
    name.indexOf("String.escape.") === 0 ||
    name.indexOf("String.from_buffer") === 0 ||
    name.indexOf("String.to_buffer") === 0 ||
    name.indexOf("String.to_builder") === 0 ||
    name.indexOf("String.run_builder") === 0 ||
    name === "Time.pad2" || name === "Time.pad3" || name === "Time.pad4" ||
    name === "Maybe.IsSome" ||
    name === "Maybe.unfold" ||
    name === "List.range.nat" ||
    name === "List.sum.u32" ||
    name === "Date.Day" ||
    name === "Nat.divides"
  );
}

const root = path.resolve(__dirname, "../../..");
const base = path.join(root, "base");
const files = walk(base);
const defRe = /^([A-Za-z][A-Za-z0-9_.]*)(\([^)]*\))?\s*:/;

const apis = [];
const lemmas = [];
const fileText = {};
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  fileText[f] = src;
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("type ") || line.startsWith("//")) continue;
    const m = line.match(defRe);
    if (!m) continue;
    const name = m[1];
    const rest = line.slice(m[0].length).trim();
    const chunk = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
    const isEq =
      rest.includes("==") ||
      rest.indexOf("Equal(") >= 0 ||
      rest.indexOf("Equal<") >= 0 ||
      rest.indexOf("Equal ") === 0 ||
      /\n\s*refl\b/.test(chunk) ||
      rest.indexOf("TestSuite") === 0;
    const isAgg = name.endsWith(".all") || /\.all\./.test(name) || name.endsWith(".def");
    if (isEq || isAgg) lemmas.push({ name, file: f });
    else apis.push({ name, file: f });
  }
}

const testSrc =
  (fileText[path.join(base, "Test/suite.sure")] || "") +
  "\n" +
  (fileText[path.join(base, "Prove/all.sure")] || "");

const lemmaText = lemmas.map((l) => fileText[l.file] || "").join("\n");
const blob = testSrc + "\n" + lemmaText;
const lemmaNames = lemmas.map((l) => l.name);

function covered(name) {
  const prefix = name + ".";
  for (let i = 0; i < lemmaNames.length; i++) {
    const n = lemmaNames[i];
    if (n === name || n.indexOf(prefix) === 0) return true;
  }
  const re = new RegExp("(^|[^A-Za-z0-9_])" + name.replace(/\./g, "\\.") + "([^A-Za-z0-9_]|$)");
  return re.test(blob);
}

const byMod = {};
let cov = 0;
let tot = 0;
const missing = [];
for (const a of apis) {
  if (isHelper(a.name) || isParked(a.name)) continue;
  const mod = a.name.split(".")[0];
  if (!SURFACE[mod]) continue;
  byMod[mod] = byMod[mod] || { tot: 0, cov: 0, miss: [] };
  byMod[mod].tot++;
  tot++;
  if (covered(a.name)) {
    cov++;
    byMod[mod].cov++;
  } else {
    missing.push(a.name);
    byMod[mod].miss.push(a.name);
  }
}

const pct = tot ? (100 * cov / tot) : 0;
const line = "cover " + cov + "/" + tot + " = " + pct.toFixed(1) + "%  need " + THRESHOLD + "%";
console.log(line);
console.log("");
Object.keys(byMod)
  .sort((a, b) => (byMod[a].cov / byMod[a].tot) - (byMod[b].cov / byMod[b].tot) || byMod[b].tot - byMod[a].tot)
  .forEach((m) => {
    const x = byMod[m];
    const p = (100 * x.cov / x.tot).toFixed(0).padStart(3);
    console.log(
      m.padEnd(12) + p + "%  " + String(x.cov).padStart(3) + "/" + String(x.tot).padEnd(4) +
      (x.miss.length ? "  " + x.miss.join(", ") : "")
    );
  });
console.log("");
console.log("missing " + missing.length);
missing.forEach((n) => console.log(n));

if (process.argv.includes("--fail") && pct + 1e-9 < THRESHOLD) {
  console.error(line);
  process.exit(1);
}
