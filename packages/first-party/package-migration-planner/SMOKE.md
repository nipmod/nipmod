# Smoke test

```bash
nipmod inspect pkg:did:key:z6Mkp7vpuGY1bRKZNHH9qnuk8fPV5DtquE4q182BnYEAqG9z/package-migration-planner@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the package-migration-planner README and SKILL scope
