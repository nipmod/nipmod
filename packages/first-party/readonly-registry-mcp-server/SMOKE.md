# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkpGtx4yWYfinzs3KsyLERUNhBePzcmdk8JvPRHvdfUL3j/readonly-registry-mcp-server@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the readonly-registry-mcp-server README and SKILL scope
