# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkpfzGwdDqJtBswdLeWBPwDzisrmCbFJCVNtVwNH9qX7kM/agent-permission-review@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the agent-permission-review README and SKILL scope
