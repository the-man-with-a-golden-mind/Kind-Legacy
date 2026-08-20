# sure/todo

Elm-like todo list on `127.0.0.1:8775` (`Sure.Ui` sandbox). The view is HTML (`<input ... />`, `onClick`, `{expr}`), not nested `Html.el`. Empty add is `empty`. Newline text is `bad_text`. Unknown clicks leave the model.

```bash
sure prove
sure build --html App.client
sure run
# open http://127.0.0.1:8775/          # type, Add, todo/done, x, all/active/done, clear done
```

`sure run` without `dist/App.client.html` serves a page that tells you to build. The static snapshot of the view is not the app.
