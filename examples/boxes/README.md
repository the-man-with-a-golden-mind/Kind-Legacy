# sure/boxes

A library: two modules in one package, several functions per file.

```
src/Boxes.sure    Boxes.empty, Boxes.push, Boxes.len, proofs
src/Audit.sure    Audit.report, proof, demo
```

```bash
cd examples/boxes
sure prove
sure run Audit.demo
```
