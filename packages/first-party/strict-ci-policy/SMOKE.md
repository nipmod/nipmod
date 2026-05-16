# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkhmdBsWDz4gejutZzV3bHZUYXaf2UigNT7QN8MSotbHHN/strict-ci-policy@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the strict-ci-policy README and SKILL scope
