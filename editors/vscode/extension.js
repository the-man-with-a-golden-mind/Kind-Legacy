const vscode = require("vscode");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const LANG = "sure";
let client = null;
let diags = null;
let output = null;
let contextRef = null;

function log(msg) {
  if (output) output.appendLine(String(msg));
}

function frame(obj) {
  const body = JSON.stringify(obj);
  return "Content-Length: " + Buffer.byteLength(body, "utf8") + "\r\n\r\n" + body;
}

function parseFrames(buf) {
  const msgs = [];
  let rest = buf;
  while (true) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd < 0) return { msgs, rest };
    const header = rest.slice(0, headerEnd).toString("utf8");
    const m = /Content-Length:\s*(\d+)/i.exec(header);
    if (!m) {
      rest = rest.slice(headerEnd + 4);
      continue;
    }
    const len = parseInt(m[1], 10);
    const start = headerEnd + 4;
    if (!Number.isFinite(len) || len < 0 || rest.length < start + len) return { msgs, rest };
    const body = rest.slice(start, start + len).toString("utf8");
    rest = rest.slice(start + len);
    try { msgs.push(JSON.parse(body)); }
    catch (e) { msgs.push({ error: { code: -32700, message: "parse error" } }); }
  }
}

function exists(p) {
  try { return !!(p && fs.existsSync(p)); } catch (e) { return false; }
}

function findSure(configPath) {
  const configured = String(configPath || "sure").trim() || "sure";
  if (configured !== "sure" && exists(configured)) return { cmd: configured, args: ["lsp"] };
  const folders = (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
  const extra = [];
  folders.forEach((root) => {
    extra.push(path.join(root, "bin", "sure"));
    extra.push(path.join(root, "Kind-Legacy", "bin", "sure"));
    extra.push(path.join(root, "bin", "js", "src", "main.js"));
    extra.push(path.join(root, "Kind-Legacy", "bin", "js", "src", "main.js"));
  });
  if (contextRef) extra.push(path.join(contextRef.extensionPath, "..", "..", "bin", "sure"));
  if (contextRef) extra.push(path.join(contextRef.extensionPath, "..", "..", "bin", "js", "src", "main.js"));
  for (let i = 0; i < extra.length; i++) {
    if (!exists(extra[i])) continue;
    if (extra[i].slice(-3) === ".js") return { cmd: process.execPath, args: ["--stack-size=10000", extra[i], "lsp"] };
    return { cmd: extra[i], args: ["lsp"] };
  }
  return { cmd: configured, args: ["lsp"] };
}

function findBase(configured) {
  if (configured) return configured;
  const folders = (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
  const candidates = [];
  folders.forEach((root) => {
    candidates.push(root);
    candidates.push(path.join(root, "base"));
    candidates.push(path.join(root, "Kind-Legacy"));
    candidates.push(path.join(root, "Kind-Legacy", "base"));
  });
  for (let i = 0; i < candidates.length; i++) {
    if (exists(path.join(candidates[i], "Nat.sure"))) return candidates[i];
  }
  return folders[0] || process.cwd();
}

class LspClient {
  constructor(proc, trace) {
    this.proc = proc;
    this.trace = trace || "off";
    this.buf = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = Object.create(null);
    this.alive = true;
    proc.stdout.on("data", (c) => this._onData(c));
    proc.stderr.on("data", (c) => { if (this.trace !== "off") log("[stderr] " + c); });
    proc.on("exit", (code) => {
      this.alive = false;
      this.pending.forEach((p) => p.reject(new Error("language server exited " + code)));
      this.pending.clear();
      log("sure lsp exited " + code);
    });
  }

  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    const parsed = parseFrames(this.buf);
    this.buf = parsed.rest;
    parsed.msgs.forEach((msg) => this._onMsg(msg));
  }

  _onMsg(msg) {
    if (this.trace === "verbose" || this.trace === "messages") log("<< " + JSON.stringify(msg));
    if (msg && msg.method && this.handlers[msg.method]) {
      try { this.handlers[msg.method](msg.params || {}); } catch (e) { log(String(e)); }
      return;
    }
    if (msg && msg.id != null && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) p.reject(Object.assign(new Error(msg.error.message || "lsp error"), msg.error));
      else p.resolve(msg.result);
    }
  }

  send(obj) {
    if (!this.alive) return;
    if (this.trace === "verbose" || this.trace === "messages") log(">> " + JSON.stringify(obj));
    try { this.proc.stdin.write(frame(obj)); } catch (e) { log(String(e)); }
  }

  request(method, params) {
    if (!this.alive) return Promise.reject(new Error("language server not running"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: "2.0", id, method, params: params || {} });
    });
  }

  notify(method, params) {
    this.send({ jsonrpc: "2.0", method, params: params || {} });
  }

  on(method, fn) { this.handlers[method] = fn; }

  async stop() {
    if (!this.alive) return;
    try { await this.request("shutdown", null); } catch (e) {}
    this.notify("exit", null);
    this.alive = false;
    try { this.proc.kill(); } catch (e) {}
  }
}

function docUri(doc) { return doc.uri.toString(); }

function asPos(p) { return p ? { line: p.line, character: p.character } : { line: 0, character: 0 }; }

function asRange(r) {
  if (!r || !r.start) return new vscode.Range(0, 0, 0, 0);
  return new vscode.Range(r.start.line || 0, r.start.character || 0, (r.end && r.end.line) || 0, (r.end && r.end.character) || 0);
}

function asLoc(loc) {
  if (!loc || !loc.uri) return null;
  return new vscode.Location(vscode.Uri.parse(loc.uri), asRange(loc.range));
}

async function startServer() {
  await stopServer();
  const cfg = vscode.workspace.getConfiguration("sure");
  const found = findSure(cfg.get("path"));
  const base = findBase(cfg.get("base"));
  const env = Object.assign({}, process.env, { SURE_BASE: base, KIND_BASE: base });
  output = output || vscode.window.createOutputChannel("Sure");
  log("spawn " + found.cmd + " " + found.args.join(" ") + " (SURE_BASE=" + base + ")");
  let proc;
  try {
    proc = spawn(found.cmd, found.args, { env, cwd: base, stdio: ["pipe", "pipe", "pipe"] });
  } catch (e) {
    vscode.window.showErrorMessage("Sure: could not start sure lsp: " + e);
    return;
  }
  proc.on("error", (e) => {
    vscode.window.showErrorMessage("Sure: " + (e && e.message || e) + ". Set sure.path or install the sure CLI.");
  });
  client = new LspClient(proc, cfg.get("trace.server") || "off");
  diags = diags || vscode.languages.createDiagnosticCollection("sure");
  client.on("textDocument/publishDiagnostics", (params) => {
    if (!params || !params.uri) return;
    const list = (params.diagnostics || []).map((d) => {
      const item = new vscode.Diagnostic(asRange(d.range), d.message || "error", d.severity === 2 ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error);
      item.source = d.source || "sure";
      item.code = d.code || undefined;
      return item;
    });
    diags.set(vscode.Uri.parse(params.uri), list);
  });
  try {
    await client.request("initialize", {
      processId: process.pid,
      rootUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] ? vscode.workspace.workspaceFolders[0].uri.toString() : null,
      capabilities: { textDocument: { hover: {}, definition: {}, completion: {}, publishDiagnostics: {} } }
    });
    client.notify("initialized", {});
  } catch (e) {
    vscode.window.showErrorMessage("Sure: initialize failed: " + (e && e.message || e));
    return;
  }
  vscode.workspace.textDocuments.forEach((doc) => {
    if (doc.languageId === LANG) openDoc(doc);
  });
}

function openDoc(doc) {
  if (!client || doc.languageId !== LANG) return;
  client.notify("textDocument/didOpen", {
    textDocument: { uri: docUri(doc), languageId: LANG, version: doc.version, text: doc.getText() }
  });
}

async function stopServer() {
  if (client) {
    try { await client.stop(); } catch (e) {}
    client = null;
  }
  if (diags) diags.clear();
}

function wordAt(doc, pos) {
  const range = doc.getWordRangeAtPosition(pos, /[A-Za-z_][A-Za-z0-9._]*/);
  return range ? doc.getText(range) : "";
}

function termArg(name) {
  if (name) return name;
  const ed = vscode.window.activeTextEditor;
  if (!ed || ed.document.languageId !== LANG) return "";
  return wordAt(ed.document, ed.selection.active);
}

function runSure(args, title) {
  const cfg = vscode.workspace.getConfiguration("sure");
  const found = findSure(cfg.get("path"));
  const base = findBase(cfg.get("base"));
  const cmdArgs = found.args.slice(0, -1).concat(args);
  const t = vscode.window.createTerminal({ name: title || "Sure", cwd: base, env: { SURE_BASE: base } });
  const line = [found.cmd].concat(cmdArgs).map((a) => /\s/.test(a) ? JSON.stringify(a) : a).join(" ");
  t.show(true);
  t.sendText(line);
}

function activate(context) {
  contextRef = context;
  output = vscode.window.createOutputChannel("Sure");
  diags = vscode.languages.createDiagnosticCollection("sure");
  context.subscriptions.push(output, diags);

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((doc) => openDoc(doc)));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((ev) => {
    if (!client || ev.document.languageId !== LANG) return;
    client.notify("textDocument/didChange", {
      textDocument: { uri: docUri(ev.document), version: ev.document.version },
      contentChanges: [{ text: ev.document.getText() }]
    });
  }));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
    if (!client || doc.languageId !== LANG) return;
    client.notify("textDocument/didClose", { textDocument: { uri: docUri(doc) } });
    if (diags) diags.delete(doc.uri);
  }));
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
    if (!client || doc.languageId !== LANG) return;
    client.notify("textDocument/didSave", { textDocument: { uri: docUri(doc) }, text: doc.getText() });
  }));

  const sel = { language: LANG };

  context.subscriptions.push(vscode.languages.registerHoverProvider(sel, {
    async provideHover(doc, pos) {
      if (!client) return null;
      try {
        const r = await client.request("textDocument/hover", { textDocument: { uri: docUri(doc) }, position: asPos(pos) });
        if (!r || !r.contents) return null;
        const md = new vscode.MarkdownString(typeof r.contents === "string" ? r.contents : (r.contents.value || ""));
        md.supportFencedCodeBlocks = true;
        return new vscode.Hover(md, r.range ? asRange(r.range) : undefined);
      } catch (e) { return null; }
    }
  }));

  context.subscriptions.push(vscode.languages.registerDefinitionProvider(sel, {
    async provideDefinition(doc, pos) {
      if (!client) return null;
      try {
        const r = await client.request("textDocument/definition", { textDocument: { uri: docUri(doc) }, position: asPos(pos) });
        if (!r) return null;
        const loc = asLoc(r);
        return loc;
      } catch (e) { return null; }
    }
  }));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider(sel, {
    async provideCompletionItems(doc, pos) {
      if (!client) return [];
      try {
        const r = await client.request("textDocument/completion", { textDocument: { uri: docUri(doc) }, position: asPos(pos) });
        return (r || []).map((it) => {
          const item = new vscode.CompletionItem(it.label, it.kind == null ? vscode.CompletionItemKind.Value : it.kind);
          item.detail = it.detail || "";
          return item;
        });
      } catch (e) { return []; }
    }
  }, "."));

  context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(sel, {
    async provideDocumentFormattingEdits(doc) {
      if (!client) return [];
      try {
        const r = await client.request("textDocument/formatting", { textDocument: { uri: docUri(doc) }, options: { tabSize: 2, insertSpaces: true } });
        return (r || []).map((e) => vscode.TextEdit.replace(asRange(e.range), e.newText || ""));
      } catch (e) { return []; }
    }
  }));

  context.subscriptions.push(vscode.languages.registerRenameProvider(sel, {
    async prepareRename(doc, pos) {
      if (!client) throw new Error("no language server");
      const r = await client.request("textDocument/prepareRename", { textDocument: { uri: docUri(doc) }, position: asPos(pos) });
      if (!r) throw new Error("no symbol");
      return { range: asRange(r.range || r), placeholder: r.placeholder || wordAt(doc, pos) };
    },
    async provideRenameEdits(doc, pos, newName) {
      if (!client) return null;
      if (!newName) return null;
      const r = await client.request("textDocument/rename", {
        textDocument: { uri: docUri(doc), version: doc.version },
        position: asPos(pos),
        newName: newName
      });
      const we = new vscode.WorkspaceEdit();
      ((r && r.documentChanges) || []).forEach((ch) => {
        const uri = vscode.Uri.parse(ch.textDocument.uri);
        (ch.edits || []).forEach((e) => we.replace(uri, asRange(e.range), e.newText || ""));
      });
      return we;
    }
  }));

  context.subscriptions.push(vscode.languages.registerReferenceProvider(sel, {
    async provideReferences(doc, pos) {
      if (!client) return [];
      try {
        const r = await client.request("textDocument/references", {
          textDocument: { uri: docUri(doc) },
          position: asPos(pos),
          context: { includeDeclaration: true }
        });
        return (r || []).map(asLoc).filter(Boolean);
      } catch (e) { return []; }
    }
  }));

  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(sel, {
    async provideDocumentSymbols(doc) {
      if (!client) return [];
      try {
        const r = await client.request("textDocument/documentSymbol", { textDocument: { uri: docUri(doc) } });
        return (r || []).map((s) => new vscode.DocumentSymbol(
          s.name || "",
          s.detail || "",
          s.kind == null ? vscode.SymbolKind.Variable : s.kind,
          asRange(s.range),
          asRange(s.selectionRange || s.range)
        ));
      } catch (e) { return []; }
    }
  }));

  context.subscriptions.push(vscode.languages.registerDocumentHighlightProvider(sel, {
    async provideDocumentHighlights(doc, pos) {
      if (!client) return [];
      try {
        const r = await client.request("textDocument/documentHighlight", { textDocument: { uri: docUri(doc) }, position: asPos(pos) });
        return (r || []).map((h) => new vscode.DocumentHighlight(asRange(h.range), vscode.DocumentHighlightKind.Text));
      } catch (e) { return []; }
    }
  }));

  context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider({
    async provideWorkspaceSymbols(query) {
      if (!client) return [];
      try {
        const r = await client.request("workspace/symbol", { query: query || "" });
        return (r || []).map((s) => {
          const loc = asLoc(s.location);
          if (!loc) return null;
          return new vscode.SymbolInformation(s.name || "", vscode.SymbolKind.Variable, "", loc);
        }).filter(Boolean);
      } catch (e) { return []; }
    }
  }));

  context.subscriptions.push(vscode.languages.registerCodeActionsProvider(sel, {
    async provideCodeActions(doc, range) {
      if (!client) return [];
      try {
        const r = await client.request("textDocument/codeAction", {
          textDocument: { uri: docUri(doc) },
          range: { start: asPos(range.start), end: asPos(range.end) },
          context: { diagnostics: [] }
        });
        return (r || []).map((a) => {
          const item = new vscode.CodeAction(a.title || "Sure", vscode.CodeActionKind.QuickFix);
          if (a.command) item.command = { command: a.command.command, title: a.command.title || a.title, arguments: a.command.arguments || [] };
          return item;
        });
      } catch (e) { return []; }
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand("sure.prove", (name) => {
    const n = termArg(typeof name === "string" ? name : "");
    runSure(n ? ["prove", n] : ["prove"], "Sure prove");
  }));
  context.subscriptions.push(vscode.commands.registerCommand("sure.debug", (name) => {
    const n = termArg(typeof name === "string" ? name : "");
    if (!n) { vscode.window.showErrorMessage("Sure: debug needs a name"); return; }
    runSure(["debug", n], "Sure debug");
  }));
  context.subscriptions.push(vscode.commands.registerCommand("sure.goal", (name) => {
    const n = termArg(typeof name === "string" ? name : "");
    if (!n) { vscode.window.showErrorMessage("Sure: goal needs a name"); return; }
    runSure(["goal", n], "Sure goal");
  }));
  context.subscriptions.push(vscode.commands.registerCommand("sure.fill", async () => {
    const ed = vscode.window.activeTextEditor;
    if (!ed || ed.document.languageId !== LANG) { vscode.window.showErrorMessage("Sure: open a .sure file"); return; }
    const term = await vscode.window.showInputBox({ prompt: "Term to put in ?implement", value: "0" });
    if (term == null) return;
    const src = ed.document.getText();
    if (src.indexOf("?implement") < 0) { vscode.window.showErrorMessage("Sure: hole not found: ?implement"); return; }
    const next = src.replace("?implement", term);
    const we = new vscode.WorkspaceEdit();
    we.replace(ed.document.uri, new vscode.Range(0, 0, ed.document.lineCount, 0), next);
    await vscode.workspace.applyEdit(we);
  }));
  context.subscriptions.push(vscode.commands.registerCommand("sure.restart", () => startServer()));

  startServer();
}

async function deactivate() {
  await stopServer();
}

module.exports = { activate, deactivate };
