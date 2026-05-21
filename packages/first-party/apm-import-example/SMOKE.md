# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkrLceabxgQz6wmQBMDCpbQpy5MF9BwJi7KymayosN5CRn/apm-import-example@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the apm-import-example README and SKILL scope
