# sure/codec

JSON HTTP on `127.0.0.1:8774`. A body of decimal digits is a nat. `"42"` as a JSON string is a nat. Junk and empty parse to none.

```bash
sure prove
sure run
curl -d '42' http://127.0.0.1:8774/      # 42
curl -d '"42"' http://127.0.0.1:8774/    # 42
curl -d '12x' http://127.0.0.1:8774/     # json  (not a nat)
curl -d '' http://127.0.0.1:8774/        # none
curl -d '{"a":1}' http://127.0.0.1:8774/ # json
```
