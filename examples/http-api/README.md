# HTTP API Example

This example shows the API-first Nipmod flow an agent can use from any host that can make HTTPS requests.

```bash
node --experimental-strip-types examples/http-api/search.ts "react"
```

For the agent-style output with trust factors and safety data:

```bash
node --experimental-strip-types examples/http-api/agent-flow.ts "react"
```

Flow:

1. Search packages.
2. Pick a source record.
3. Inspect the exact package.
4. Request an install plan.
5. Show trust factors and safety warnings before approval.

The examples print plans only. They do not install anything.
