# Smoke test

```bash
nipmod inspect pkg:did:key:z6Mknf1KVeVWRPXcHUFfL1P3NHQcdzXy2wKuaBjxX9Lr8Vmd/mcp-server-import-example@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the mcp-server-import-example README and SKILL scope
