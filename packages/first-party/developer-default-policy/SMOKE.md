# Smoke test

```bash
nipmod inspect pkg:did:key:z6MksFrmCtYGTqJzUMsi3i8aABgH7m97zf4mhfmhvfmF5pAe/developer-default-policy@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the developer-default-policy README and SKILL scope
