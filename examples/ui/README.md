# sure/ui

Elm-like counter on `127.0.0.1:8772`. Unknown clicks leave the model.

```bash
sure prove
sure build --html Ui.client
sure run
# open http://127.0.0.1:8772/          # + / − / reset
```

`sure run` without `dist/Ui.client.html` serves a page that tells you to build. The static snapshot of the view is not the app.
