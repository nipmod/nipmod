# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkrEUHLE6XQq8e8W3EXKYVdznbsj4BJVGSKXuu8ahNu68j/security-advisory-triage@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the security-advisory-triage README and SKILL scope
