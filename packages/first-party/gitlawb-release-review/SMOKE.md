# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkfAZP5ayqPdX9biypAAZAjtDM1AbztFTmUFNGVqjpn41N/gitlawb-release-review@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the gitlawb-release-review README and SKILL scope
