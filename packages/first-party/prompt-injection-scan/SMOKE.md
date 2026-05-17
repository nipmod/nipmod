# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkhS4uoDPQXWM6Be3p1nryphmQ1GDQrGVqyHuyqaSs2XWv/prompt-injection-scan@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the prompt-injection-scan README and SKILL scope
