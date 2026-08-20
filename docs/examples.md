# Examples

Each folder under `examples/` is a Sure **application**. `sure run` starts `Main`. The servers listen on 127.0.0.1. Catalog: [examples/README.md](../examples/README.md).

```
hello/     print Sure
add/       function + proofs
boxes/     library (two modules)
codec/     JSON HTTP :8774
routes/    HTTP API :8770
ssr/       website :8771
ui/        counter :8772
todo/      todos :8775 (build --html App.client)
excel/     10000-row grid :8765
tweeter/   login + tweets + upload :8766
files/     read/write :8773
walk/      catalog :8760
```

```bash
cd examples/hello
sure prove
sure run                 # prints Sure

cd ../excel
sure prove
sure build --html Excel.client
sure run
# open http://127.0.0.1:8765/
```

ui / todo / excel / tweeter need `sure build --html Name.client` before the page is interactive. `sure run` without that file serves a page that tells you to build.
