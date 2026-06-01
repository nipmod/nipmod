# Repository Split

Nipmod uses a public/private repository split.

## Public

- product positioning
- API usage examples
- agent workflow instructions
- public CLI source for local package review, deep scan, sandbox audit and sandbox runtime receipts
- security boundary documentation
- community and support files

## Private

- production site source
- API routes and backend implementation
- Supabase schema, migrations and RPC logic
- ranking, scoring and hosted API implementation
- internal operations, canaries and deployment tooling
- local editor, agent and MCP configuration

The public repository should be useful for developers and agents without exposing implementation details that increase operational or abuse risk.
