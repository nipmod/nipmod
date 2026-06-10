## Summary

- 

## Scope

- [ ] Public docs only
- [ ] Public CLI behavior
- [ ] Codex/MCP integration material
- [ ] Security wording or disclosure process

## Checks

- [ ] No secrets, private repository content or generated build output added
- [ ] Public/private repository boundary preserved
- [ ] Tests updated or not needed
- [ ] Security impact considered

## Verification

```bash
pnpm --dir cli typecheck
pnpm --dir cli test
pnpm --dir cli build
```
