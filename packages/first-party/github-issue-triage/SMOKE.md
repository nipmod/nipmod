# Smoke test

```bash
nipmod inspect pkg:did:key:z6MkneCPKedfzXaRzEtGkFrniUy5aWrmhANfP9uwajn3kXUS/github-issue-triage@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the github-issue-triage README and SKILL scope
