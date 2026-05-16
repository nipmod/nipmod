# Smoke test

```bash
nipmod inspect pkg:did:key:z6Mknhqe5iXdzxNheEHf74zyZ9DVNiefnsyq4EQ5qRV4gaH2/gitlawb-review-tool-bundle@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod add ... --online`
- package output matches the gitlawb-review-tool-bundle README and SKILL scope
