# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkgXXLN2Qt3GKL9KJPo7SH7WGcQqRYcpT5MrwbTJ9qHpZu/repo-readme-audit@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
