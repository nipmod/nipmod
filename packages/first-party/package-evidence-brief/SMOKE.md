# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkfCMAxqkvoMNtoxmU3yon2YGnigvQxRz2QF3Ltfeq5xRK/package-evidence-brief@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the package-evidence-brief README and SKILL scope
