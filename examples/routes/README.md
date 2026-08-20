# sure/routes

HTTP API on `127.0.0.1:8770`.

```bash
sure prove
sure run
```

```bash
curl http://127.0.0.1:8770/health
curl http://127.0.0.1:8770/user/7
curl -d 'hi' http://127.0.0.1:8770/echo
curl http://127.0.0.1:8770/nope          # 404
curl http://127.0.0.1:8770/user/         # miss
```
