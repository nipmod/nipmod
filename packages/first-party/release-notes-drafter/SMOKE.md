# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkhLSkbSWSk4oN2QUwPMowX12uR16QGgS37EYskCWtgbsK/release-notes-drafter@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the release-notes-drafter README and SKILL scope
