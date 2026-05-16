# Smoke test

```bash
nipmod inspect pkg:did:key:z6MknNXQoTp1JBT2MMpTrGnBervGBCW4z8bWfRHUReN7EPWP/malicious-skill-fixtures@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the malicious-skill-fixtures README and SKILL scope
