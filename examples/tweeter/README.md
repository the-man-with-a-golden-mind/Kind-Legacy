# sure/tweeter

Login, session, tweets, and file upload on `127.0.0.1:8766`. Empty user, empty password, tweet-without-session, and empty file are errors.

The in-memory DB (`suremem:tweeter`) keeps data for the life of the process. `Db.with` close does **not** wipe it.

```bash
sure prove
sure build --html Tweeter.client
sure run
# open http://127.0.0.1:8766/
```

```bash
curl -d 'u=ada&p=secret' http://127.0.0.1:8766/register
curl -d 'u=ada&p=secret' http://127.0.0.1:8766/login
# copy the sid from "ok <sid> ada"
curl -d 's=<sid>&t=hello' http://127.0.0.1:8766/tweet
curl 'http://127.0.0.1:8766/feed?s=<sid>'
curl -d 'hello-file' 'http://127.0.0.1:8766/upload?s=<sid>'
# copy the file id from "ok <id>"
curl 'http://127.0.0.1:8766/file?id=<id>'
```
