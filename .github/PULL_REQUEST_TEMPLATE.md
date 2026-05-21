## Summary


## Test plan

- [ ] `pnpm --dir nipmod test`
- [ ] `pnpm --dir nipmod typecheck`
- [ ] `pnpm --dir site test`
- [ ] `pnpm --dir site typecheck`
- [ ] `pnpm --dir site build`
- [ ] `pnpm --dir site security:secrets`
- [ ] `node tools/open-source-readiness-check.mjs`

## Safety

- [ ] No secrets, private keys, local identities or tokens are committed.
- [ ] External package metadata and prompt text are treated as untrusted input.
- [ ] No third party endorsement is claimed unless it is explicitly approved.
