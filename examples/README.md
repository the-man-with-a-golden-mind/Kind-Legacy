# Examples

Each folder is a Sure application (`sure.json` + `src/` + `Main`). `sure run` starts it.

Servers listen on 127.0.0.1. `sure prove` checks the theorems. For ui / excel / tweeter, `sure build --html Name.client` then `sure run` is required for clicks; without that file the page tells you to build.

```
examples/
  hello/      print "Sure"
  add/        Add(n) with proofs
  boxes/      library: Boxes + Audit
  codec/      JSON HTTP :8774     POST /  body 42 | "42" | junk | empty
  routes/     HTTP API :8770      GET /health  GET /user/:id  POST /echo
  ssr/        website :8771       GET /  /about  /user/:id
  ui/         counter :8772       GET /   (build --html Ui.client)
  excel/      grid :8765          10000 virtual rows, column resize
  tweeter/    tweets :8766        register, login, tweet, upload
  files/      files :8773         GET /read  POST /write
  walk/       catalog :8760
```

```bash
cd examples/hello && sure prove && sure run
# prints Sure

cd examples/routes && sure prove && sure run
# another terminal: curl http://127.0.0.1:8770/health
#                   curl http://127.0.0.1:8770/user/7
#                   curl -d 'hi' http://127.0.0.1:8770/echo

cd examples/codec && sure run
# curl -d '42' http://127.0.0.1:8774/          # 42
# curl -d '12x' http://127.0.0.1:8774/         # json
# curl -d '' http://127.0.0.1:8774/            # none

cd examples/ssr && sure run
# curl http://127.0.0.1:8771/

cd examples/excel && sure prove && sure build --html Excel.client && sure run
# open http://127.0.0.1:8765/                  # scroll + resize
# curl http://127.0.0.1:8765/sheet/state

cd examples/tweeter && sure prove && sure build --html Tweeter.client && sure run
# curl -d 'u=ada&p=x' http://127.0.0.1:8766/register
# curl -d 'u=ada&p=x' http://127.0.0.1:8766/login
# copy sid from "ok <sid> ada"
# curl -d 's=<sid>&t=hello' http://127.0.0.1:8766/tweet
# curl -d 'hello-file' 'http://127.0.0.1:8766/upload?s=<sid>'
```
