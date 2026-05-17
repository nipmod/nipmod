# Smoke test

```bash
nipmod inspect pkg:did:key:z6Mkr8jKUSoDpRJBu1Ap3s7ffBVhgJFwkjcQbwfAJz1R9UyE/launch-strict-policy-pack@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the launch-strict-policy-pack README and SKILL scope
