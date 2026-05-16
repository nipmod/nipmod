# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkwYNoJqw78ZhMGWywJHkE8f7PqnR37BXA5Tagc22N6HuV/mcp-tool-risk-review@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the mcp-tool-risk-review README and SKILL scope
