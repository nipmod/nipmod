# HTTP API Example

This example shows the API-first Nipmod flow an agent can use from any host that can make HTTPS requests.

```bash
node --experimental-strip-types examples/http-api/search.ts "react"
```

For the agent-style output with inspect data, trust factors, install-plan safety and archive preview:

```bash
node --experimental-strip-types examples/http-api/agent-flow.ts "react"
```

Flow:

1. Search packages.
2. Read `selection.recommendedId` and candidate gates.
3. Inspect the exact package.
4. Request an install plan.
5. Prepare an archive preview after useful discovery.
6. Show trust factors, rank reasons and safety warnings before approval.

The examples print plans only. They do not install anything and they do not persist archive records.
