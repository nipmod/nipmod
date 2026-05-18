# Contributing to Nipmod

Nipmod is open source. Gitlawb remains the canonical source of truth for the project, and GitHub is a public mirror for review, CI and ecosystem access.

## Development

Requirements:

- Node.js 22 or newer
- pnpm
- Git

Useful checks:

```bash
pnpm --dir nipmod install --frozen-lockfile
pnpm --dir site install --frozen-lockfile
pnpm --dir nipmod test
pnpm --dir nipmod typecheck
pnpm --dir nipmod build
pnpm --dir site test
pnpm --dir site typecheck
pnpm --dir site build
pnpm --dir site security:secrets
node tools/open-source-readiness-check.mjs
node tools/supply-chain-check.mjs
```

## Pull requests

- Keep changes scoped.
- Add or update tests for behavior changes.
- Treat registry metadata, package READMEs and prompt text as untrusted input.
- Do not commit `.env` files, private keys, tokens, local identity files or generated local service state.
- Do not claim third party endorsement unless the third party has explicitly approved it.

## Security reports

Use `SECURITY.md`. Do not open public issues for active vulnerabilities.
