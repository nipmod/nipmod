# HTTP API Example

This example shows the API-first Nipmod flow an agent can use from any host that can make HTTPS requests.

```bash
node --experimental-strip-types examples/http-api/search.ts "http client"
```

Flow:

1. Search packages.
2. Pick a source record.
3. Inspect the exact package.
4. Request an install plan.

The example prints the plan. It does not install anything.
