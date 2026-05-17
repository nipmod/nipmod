# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkwNvgoxc794HjwtR9wbNYwXgnw8SoBQr19ve1NQqEZdEQ/agent-runtime-compat-check@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the agent-runtime-compat-check README and SKILL scope
