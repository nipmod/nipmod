# Smoke test

```bash
nipmod inspect pkg:did:key:z6Mkho169M47Pu8rZmLqkBpCEzGAW6SCA8MXsH6YwEAjtLM4/first-user-onboarding@0.1.0 --online
```

Expected:

- `trust: verified/100` after publication and witness rebuild
- permissions show `no permissions`
- install command uses `nipmod install ... --online`
- package output matches the first-user-onboarding README and SKILL scope
