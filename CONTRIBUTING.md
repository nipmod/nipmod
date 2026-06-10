# Contributing

Thanks for helping improve Nipmod.

This public repository accepts changes to public documentation, CLI behavior, examples, Codex plugin material, MCP examples, security wording and public integration guides.

The hosted product, backend ranking logic, production infrastructure, keys, private schemas and operational runbooks are not part of this repository.

## Good First Contributions

- Improve public documentation or examples.
- Reproduce and minimize CLI bugs.
- Add tests for public CLI behavior.
- Clarify install-boundary, MCP or Codex integration docs.
- Report incorrect package metadata or source evidence through an issue.

## Security Boundary

Do not post secrets, exploit payloads against live systems, private customer data, wallet phrases, API keys or unpublished vulnerability details in issues or pull requests.

Use `SECURITY.md` for vulnerability reporting.

## Pull Requests

Before opening a pull request:

- Keep changes scoped.
- Add or update tests when changing CLI behavior.
- Preserve the public/private repository boundary.
- Do not add generated build output, dependency folders, private configuration or local credentials.

For CLI changes, run:

```bash
pnpm --dir cli install --frozen-lockfile
pnpm --dir cli typecheck
pnpm --dir cli test
pnpm --dir cli build
```
