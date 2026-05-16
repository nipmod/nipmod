# Smoke test

```bash
nipmod inspect pkg:did:key:z6Mkp52AN6L6AymVvV9bVJfmt5UG3Lwrx7JUm2VPfcTG2bJF/package-safety-eval-pack@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the package-safety-eval-pack README and SKILL scope
