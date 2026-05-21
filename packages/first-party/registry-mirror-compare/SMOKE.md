# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkfJVpnZrHEGKvhSQz5SXaHPD3bM6ktHHB18u11vcDwAnS/registry-mirror-compare@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the registry-mirror-compare README and SKILL scope
