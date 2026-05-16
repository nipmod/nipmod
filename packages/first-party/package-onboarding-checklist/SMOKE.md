# Smoke test

```bash
nipmod inspect pkg:did:key:z6Mkm5CnkZuC7XKBbB1UQxKsKQGmEktcpD7rWXPMnRnrrB8B/package-onboarding-checklist@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the package-onboarding-checklist README and SKILL scope
