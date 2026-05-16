# Smoke test

```bash
nipmod inspect pkg:did:key:z6Mkqm8Ub1wbA79siRozF1Q7j1DjixxFNAsHnSSfPaT2iA1C/dependency-risk-review@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
