# Sure for VS Code

Language Server, syntax, and commands for `*.sure` files.

The type checker is the prover. Empty names, junk methods, and empty URIs are not documents.

## Install

From this folder:

```
code --install-extension .
```

or symlink it into your extensions directory:

```
ln -s "$(pwd)" ~/.vscode/extensions/sure-0.1.0
```

Open a folder that contains `*.sure` files. The extension starts `sure lsp`.

## Settings

- `sure.path` — executable (default `sure`). If that is not on PATH, the extension looks for `bin/sure` or `bin/js/src/main.js` in the workspace.
- `sure.base` — `SURE_BASE`. Empty uses the workspace / `Kind-Legacy/base`.
- `sure.trace.server` — `off` | `messages` | `verbose`

## Commands

- Sure: Prove
- Sure: Debug
- Sure: Remaining holes
- Sure: Fill `?implement`
- Sure: Restart language server

## Language Server

`sure lsp` speaks JSON-RPC with `Content-Length` framing.

Hover, go to definition, completion (`.` and keywords), format, rename, references, document symbols, highlight, workspace symbols, and code actions. Diagnostics on open/change/save. Closing a file clears its diagnostics.

`sure help lsp`
