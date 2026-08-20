# sure/files

File server on `127.0.0.1:8773`. Empty path and `..` are errors.

```bash
sure prove
sure run
curl http://127.0.0.1:8773/
curl 'http://127.0.0.1:8773/read?path='
curl 'http://127.0.0.1:8773/read?path=../secret'
curl -d 'hello' 'http://127.0.0.1:8773/write?path=note.txt'
curl 'http://127.0.0.1:8773/read?path=note.txt'
```
