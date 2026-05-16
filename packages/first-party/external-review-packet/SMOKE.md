# Smoke test

```bash
nipmod inspect pkg:did:key:z6MktDAiA6JWkGr5oLe9pDmygCL73aaa6yud93Hzyh2DUHjF/external-review-packet@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the external-review-packet README and SKILL scope
